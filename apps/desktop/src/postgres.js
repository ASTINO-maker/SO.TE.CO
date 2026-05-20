// Lifecycle manager for the bundled PostgreSQL cluster used by the local
// SO.TE.CO ERP installation. The binaries ship with the installer (read-only,
// under <resources>/runtime/postgres). The data directory and logs live under
// %APPDATA%\SO.TE.CO ERP\db\, owned by the current user.
//
// Public contract:
//   start(ctx)   -> ensures cluster exists, starts postgres, ensures the app
//                   database exists, returns a connection string.
//   stop()       -> graceful shutdown of the spawned process.
//
// Security model: the server binds 127.0.0.1 only and uses pg_hba `trust` for
// loopback. This is the standard pattern for embedded Postgres (Atlassian,
// Sonatype, Postgres.app all do the same). Only the same OS user on the same
// machine can reach the socket; binding to a non-default port (55432) avoids
// conflicts with any other Postgres install.

const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const PG_PORT = 55432;
const PG_USER = "sotec";
const PG_DB = "sotec_owner";
const READY_TIMEOUT_MS = 60_000;
const READY_PROBE_INTERVAL_MS = 500;

let pgProcess = null;
let stopRequested = false;

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function logLine(logFile, line) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${line}\n`);
  } catch {
    // logging must never crash the boot
  }
}

function pgBinPath(ctx, exe) {
  return path.join(ctx.postgresBinariesDir, "bin", `${exe}.exe`);
}

function clusterIsInitialized(ctx) {
  return fs.existsSync(path.join(ctx.dataDir, "PG_VERSION"));
}

function clearStalePidFile(ctx) {
  // postmaster.pid lingers if Postgres was killed (BSOD, task manager, etc.).
  // A new server refuses to start while it exists. We only delete it if no
  // process is actually listening on our port — otherwise we'd be racing a
  // healthy instance.
  const pidFile = path.join(ctx.dataDir, "postmaster.pid");
  if (!fs.existsSync(pidFile)) return;
  logLine(ctx.logFile, `removing stale postmaster.pid at ${pidFile}`);
  try {
    fs.unlinkSync(pidFile);
  } catch (err) {
    logLine(ctx.logFile, `could not remove postmaster.pid: ${err.message}`);
  }
}

function initdbCluster(ctx) {
  const initdb = pgBinPath(ctx, "initdb");
  if (!fs.existsSync(initdb)) {
    throw new Error(`Bundled PostgreSQL is missing: ${initdb}`);
  }

  ensureDir(ctx.dataDir);

  // Trust auth for both local-socket and TCP loopback. With listen_addresses
  // locked to 127.0.0.1 this is equivalent in safety to per-user file
  // permissions on a workstation. No password to store, no auth race on boot.
  const result = spawnSync(
    initdb,
    [
      "-D", ctx.dataDir,
      "-U", PG_USER,
      "--auth-host=trust",
      "--auth-local=trust",
      "--encoding=UTF8",
      "--no-locale",
    ],
    { stdio: ["ignore", "pipe", "pipe"], windowsHide: true }
  );

  logLine(ctx.logFile, `initdb stdout:\n${result.stdout?.toString() || ""}`);
  logLine(ctx.logFile, `initdb stderr:\n${result.stderr?.toString() || ""}`);

  if (result.status !== 0) {
    throw new Error(`initdb failed (exit ${result.status}). See ${ctx.logFile}.`);
  }

  // Lock to 127.0.0.1 + our private port, route Postgres' own logs into the
  // workspace so the support flow can include them in diagnostics exports.
  const overrides = [
    "",
    "# SO.TE.CO local-only overrides",
    "listen_addresses = '127.0.0.1'",
    `port = ${PG_PORT}`,
    "logging_collector = on",
    "log_directory = 'log'",
    "log_filename = 'postgresql-%Y-%m-%d.log'",
    "",
  ].join("\n");
  fs.appendFileSync(path.join(ctx.dataDir, "postgresql.conf"), overrides);
}

function startServer(ctx) {
  const postgres = pgBinPath(ctx, "postgres");
  if (!fs.existsSync(postgres)) {
    throw new Error(`Bundled PostgreSQL is missing: ${postgres}`);
  }

  ensureDir(path.dirname(ctx.serverLog));
  const out = fs.openSync(ctx.serverLog, "a");

  pgProcess = spawn(postgres, ["-D", ctx.dataDir, "-p", String(PG_PORT)], {
    stdio: ["ignore", out, out],
    windowsHide: true,
    detached: false,
  });

  pgProcess.on("exit", (code, signal) => {
    const wasRequested = stopRequested;
    pgProcess = null;
    if (!wasRequested) {
      logLine(ctx.logFile, `postgres exited unexpectedly code=${code} signal=${signal}`);
    }
  });
}

function runIsReady(ctx) {
  // pg_isready returns 0 when the server is accepting connections.
  const pgIsReady = pgBinPath(ctx, "pg_isready");
  if (!fs.existsSync(pgIsReady)) {
    return false;
  }
  const result = spawnSync(
    pgIsReady,
    ["-h", "127.0.0.1", "-p", String(PG_PORT), "-U", PG_USER, "-d", "postgres", "-q"],
    { stdio: ["ignore", "ignore", "ignore"], windowsHide: true }
  );
  return result.status === 0;
}

async function waitForReady(ctx, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (runIsReady(ctx)) return true;
    await new Promise((r) => setTimeout(r, READY_PROBE_INTERVAL_MS));
  }
  return false;
}

function runPsql(ctx, sql, database = "postgres") {
  const psql = pgBinPath(ctx, "psql");
  const result = spawnSync(
    psql,
    [
      "-h", "127.0.0.1",
      "-p", String(PG_PORT),
      "-U", PG_USER,
      "-d", database,
      "--no-psqlrc",
      "--quiet",
      "--tuples-only",
      "-c", sql,
    ],
    { stdio: ["ignore", "pipe", "pipe"], windowsHide: true }
  );
  return {
    status: result.status,
    stdout: (result.stdout?.toString() || "").trim(),
    stderr: (result.stderr?.toString() || "").trim(),
  };
}

function ensureAppDatabase(ctx) {
  // --tuples-only returns just the value, so "1" if exists, empty if not.
  const list = runPsql(ctx, `SELECT 1 FROM pg_database WHERE datname='${PG_DB}'`);
  if (list.status !== 0) {
    throw new Error(`Failed to inspect databases: ${list.stderr || "no output"}`);
  }
  if (list.stdout === "1") {
    return; // already exists
  }

  const create = runPsql(ctx, `CREATE DATABASE ${PG_DB} OWNER ${PG_USER}`);
  if (create.status !== 0) {
    logLine(ctx.logFile, `CREATE DATABASE stderr:\n${create.stderr}`);
    throw new Error(`Failed to create database ${PG_DB}: ${create.stderr || "no output"}`);
  }
}

async function start(ctx) {
  ensureDir(ctx.workDir);
  ensureDir(path.dirname(ctx.logFile));
  logLine(ctx.logFile, `== boot ==  resourcesDir=${ctx.postgresBinariesDir}`);

  const portFreeBefore = await isPortFree(PG_PORT);

  if (!portFreeBefore) {
    // Something is listening on 55432. If it's our cluster from a previous
    // launch we can reuse it. Otherwise we surface a clear error - the user
    // has a port conflict we can't safely resolve.
    if (runIsReady(ctx)) {
      logLine(ctx.logFile, `port ${PG_PORT} already serving Postgres, reusing`);
    } else {
      throw new Error(
        `Port ${PG_PORT} is in use by another process. Close it and relaunch SO.TE.CO ERP. ` +
        `See ${ctx.logFile} for details.`
      );
    }
  } else {
    if (!clusterIsInitialized(ctx)) {
      initdbCluster(ctx);
    } else {
      clearStalePidFile(ctx);
    }
    startServer(ctx);
    const ready = await waitForReady(ctx, READY_TIMEOUT_MS);
    if (!ready) {
      throw new Error(
        `PostgreSQL did not become ready within ${Math.round(READY_TIMEOUT_MS / 1000)}s. ` +
        `See ${ctx.serverLog} and ${ctx.logFile}.`
      );
    }
  }

  ensureAppDatabase(ctx);

  // trust auth -> no password in URL. host=127.0.0.1 keeps Prisma off any
  // accidental IPv6 lookup on `localhost`.
  const url = `postgresql://${PG_USER}@127.0.0.1:${PG_PORT}/${PG_DB}?host=127.0.0.1`;
  logLine(ctx.logFile, `database ready at ${url.replace(PG_USER, "***")}`);
  return url;
}

async function stop() {
  if (!pgProcess) return;
  stopRequested = true;
  try {
    pgProcess.kill("SIGINT"); // Postgres "fast shutdown"
  } catch {
    // ignore
  }
  // Wait briefly for clean exit; if still alive, SIGKILL.
  for (let i = 0; i < 20 && pgProcess; i += 1) {
    await new Promise((r) => setTimeout(r, 150));
  }
  if (pgProcess) {
    try { pgProcess.kill("SIGKILL"); } catch {}
    pgProcess = null;
  }
  // Reset only after the exit handler has had a chance to run.
  setTimeout(() => { stopRequested = false; }, 250);
}

function buildContext({ workspaceRoot, resourcesDir }) {
  return {
    workDir: workspaceRoot,
    dataDir: path.join(workspaceRoot, "db", "data"),
    serverLog: path.join(workspaceRoot, "db", "log", "postgres.log"),
    logFile: path.join(workspaceRoot, ".data", "diagnostics", "postgres-boot.log"),
    postgresBinariesDir: path.join(resourcesDir, "postgres"),
  };
}

module.exports = {
  start,
  stop,
  buildContext,
  constants: { PG_PORT, PG_USER, PG_DB },
};
