const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const postgresService = require("./postgres");

const APP_VERSION = app.getVersion();
const APP_TITLE = `SO.TE.CO ERP ${APP_VERSION}`;
const DEFAULT_WEB_PORT = "3000";
const DEFAULT_API_PORT = "4000";
const BOOT_TIMEOUT_MS = 120000;
const SETUP_TIMEOUT_MS = 20 * 60 * 1000;
const DIAGNOSTIC_TIMEOUT_MS = 2 * 60 * 1000;
const RUNTIME_MARKER_FILE = ".sotec-runtime-version";
const RUNTIME_BUNDLE_MARKER_FILE = ".sotec-runtime-bundle-id";

let mainWindow = null;
let activeRootDir = null;
let isBootstrapping = false;

function packagedWorkspaceRoot() {
  if (process.platform === "win32") {
    const appDataDir = process.env.APPDATA || app.getPath("appData");
    return path.join(appDataDir, "SO.TE.CO ERP", "workspace");
  }

  return path.join(app.getPath("userData"), "workspace");
}

function bundledRuntimeRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "runtime");
  }

  return path.resolve(__dirname, "../../..");
}

function runtimeContext(rootDir = null) {
  if (app.isPackaged) {
    const workspaceRoot = packagedWorkspaceRoot();
    const resolvedRootDir = rootDir || path.join(workspaceRoot, "app");
    return {
      rootDir: resolvedRootDir,
      workspaceRoot,
      dataDir: path.join(workspaceRoot, ".data"),
      envFile: path.join(workspaceRoot, ".env"),
      envTemplate: path.join(resolvedRootDir, ".env.example"),
      storageDir: path.join(workspaceRoot, "storage"),
      diagnosticsDir: path.join(workspaceRoot, ".data", "diagnostics"),
      preflightReport: path.join(workspaceRoot, ".data", "preflight.txt"),
      updateLog: path.join(workspaceRoot, ".data", "update.log"),
      runtimeMarker: path.join(workspaceRoot, RUNTIME_MARKER_FILE),
      runtimeSourceDir: bundledRuntimeRoot(),
    };
  }

  const resolvedRootDir = rootDir || bundledRuntimeRoot();
  return {
    rootDir: resolvedRootDir,
    workspaceRoot: resolvedRootDir,
    dataDir: path.join(resolvedRootDir, ".data"),
    envFile: path.join(resolvedRootDir, ".env"),
    envTemplate: path.join(resolvedRootDir, ".env.example"),
    storageDir: path.join(resolvedRootDir, "storage"),
    diagnosticsDir: path.join(resolvedRootDir, ".data", "diagnostics"),
    preflightReport: path.join(resolvedRootDir, ".data", "preflight.txt"),
    updateLog: path.join(resolvedRootDir, ".data", "update.log"),
    runtimeMarker: path.join(resolvedRootDir, RUNTIME_MARKER_FILE),
    runtimeSourceDir: resolvedRootDir,
  };
}

function currentContext(rootDir = null) {
  return runtimeContext(rootDir || activeRootDir || null);
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeWindowsBatchFiles(targetPath) {
  if (process.platform !== "win32" || !fs.existsSync(targetPath)) {
    return;
  }

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    if (targetPath.toLowerCase().endsWith(".bat")) {
      const content = fs.readFileSync(targetPath, "utf8");
      const normalized = content.replace(/\r?\n/g, "\r\n");
      if (normalized !== content) {
        fs.writeFileSync(targetPath, normalized, "utf8");
      }
    }
    return;
  }

  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    normalizeWindowsBatchFiles(path.join(targetPath, entry.name));
  }
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values = {};
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    values[key] = value;
  }

  return values;
}

function resolvePorts(rootDir) {
  const context = runtimeContext(rootDir);
  const envValues = parseEnvFile(context.envFile);
  return {
    webPort: String(envValues.WEB_PORT || process.env.WEB_PORT || DEFAULT_WEB_PORT),
    apiPort: String(envValues.API_PORT || process.env.API_PORT || DEFAULT_API_PORT),
  };
}

function serviceUrls(rootDir) {
  const { webPort, apiPort } = resolvePorts(rootDir);
  return {
    webPort,
    apiPort,
    webUrl: `http://localhost:${webPort}/login`,
    apiHealthUrl: `http://localhost:${apiPort}/api/v1/health`,
  };
}

function serviceEnv(rootDir, extraEnv = {}) {
  const context = runtimeContext(rootDir);
  const envValues = parseEnvFile(context.envFile);
  const { webPort, apiPort } = resolvePorts(rootDir);
  const pgBin = path.join(resourcesRoot(), "postgres", "bin");
  const augmentedPath = fs.existsSync(pgBin)
    ? `${pgBin}${path.delimiter}${process.env.PATH || ""}`
    : process.env.PATH || "";

  return {
    ...process.env,
    ...envValues,
    PATH: augmentedPath,
    WEB_PORT: webPort,
    API_PORT: apiPort,
    APP_URL: envValues.APP_URL || `http://localhost:${webPort}`,
    APP_BASE_URL: envValues.APP_BASE_URL || `http://localhost:${webPort}`,
    API_URL: envValues.API_URL || `http://localhost:${apiPort}`,
    NEXT_PUBLIC_API_URL: envValues.NEXT_PUBLIC_API_URL || `http://localhost:${apiPort}`,
    NEXT_PUBLIC_APP_URL: envValues.NEXT_PUBLIC_APP_URL || `http://localhost:${webPort}`,
    LOCAL_STORAGE_PATH: context.storageDir,
    STORAGE_DRIVER: envValues.STORAGE_DRIVER || "local",
    SOTECO_APP_VERSION: APP_VERSION,
    SOTECO_WORKSPACE_DIR: context.workspaceRoot,
    SOTECO_DATA_DIR: context.dataDir,
    SOTECO_ENV_FILE: context.envFile,
    SOTECO_ENV_TEMPLATE: context.envTemplate,
    SOTECO_STORAGE_DIR: context.storageDir,
    ...(app.isPackaged && process.platform === "win32" ? { SOTECO_DESKTOP_MODE: "1" } : {}),
    ...extraEnv,
  };
}

function syncBundledRuntimeIfNeeded() {
  if (!app.isPackaged) {
    return bundledRuntimeRoot();
  }

  const context = runtimeContext();
  const sourceRoot = context.runtimeSourceDir;
  const targetRoot = context.rootDir;
  const targetMarker = context.runtimeMarker;
  const sourceMarkerPath = path.join(sourceRoot, RUNTIME_BUNDLE_MARKER_FILE);
  const sourceMarkerValue = fs.existsSync(sourceMarkerPath)
    ? fs.readFileSync(sourceMarkerPath, "utf8").trim()
    : APP_VERSION;
  const markerValue = fs.existsSync(targetMarker)
    ? fs.readFileSync(targetMarker, "utf8").trim()
    : "";
  const mustRefresh =
    markerValue !== sourceMarkerValue ||
    !fs.existsSync(path.join(targetRoot, "package.json")) ||
    !fs.existsSync(path.join(targetRoot, "scripts", "maintenance", "run-migrations.js"));

  ensureDirectory(context.workspaceRoot);

  if (!mustRefresh) {
    normalizeWindowsBatchFiles(targetRoot);
    return targetRoot;
  }

  fs.rmSync(targetRoot, { recursive: true, force: true });
  // Copy the runtime bundle EXCEPT the Postgres binaries: those stay
  // read-only inside <resources>/runtime/postgres/ and are referenced
  // directly. Duplicating ~150MB into AppData on every install would be
  // wasteful and could fail on constrained drives.
  fs.cpSync(sourceRoot, targetRoot, {
    recursive: true,
    force: true,
    filter: (src) => {
      const rel = path.relative(sourceRoot, src);
      return !(rel === "postgres" || rel.startsWith("postgres" + path.sep));
    },
  });
  normalizeWindowsBatchFiles(targetRoot);
  fs.writeFileSync(targetMarker, `${sourceMarkerValue}\n`, "utf8");
  return targetRoot;
}

function runCommand(command, args, cwd, windowsHide = true, envOverrides = {}, timeoutMs = 0, label = "command") {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(command, args, {
      cwd,
      windowsHide,
      env: { ...process.env, ...envOverrides },
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    let timeoutHandle = null;
    if (timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        try {
          child.kill();
        } catch (_error) {
          // no-op
        }
        reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 60000)} minutes`));
      }, timeoutMs);
    }

    child.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      reject(error);
    });

    child.on("exit", (code) => {
      if (settled) {
        return;
      }

      settled = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `Command failed with exit code ${code}`));
      }
    });
  });
}

function runCommandLogged(
  command,
  args,
  cwd,
  logFilePath,
  windowsHide = true,
  envOverrides = {},
  timeoutMs = 0,
  label = "command"
) {
  return new Promise((resolve, reject) => {
    ensureDirectory(path.dirname(logFilePath));
    const logFd = fs.openSync(logFilePath, "a");
    let settled = false;

    const child = spawn(command, args, {
      cwd,
      windowsHide,
      env: { ...process.env, ...envOverrides },
      stdio: ["ignore", logFd, logFd],
    });

    let timeoutHandle = null;
    if (timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        try {
          child.kill();
        } catch (_error) {
          // no-op
        }
        fs.closeSync(logFd);
        reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 60000)} minutes`));
      }, timeoutMs);
    }

    child.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      fs.closeSync(logFd);
      reject(error);
    });

    child.on("exit", (code) => {
      if (settled) {
        return;
      }

      settled = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      fs.closeSync(logFd);

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} failed with exit code ${code}`));
      }
    });
  });
}

function isServiceUp(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 3000 }, (res) => {
      const ok = res.statusCode >= 200 && res.statusCode < 500;
      res.resume();
      resolve(ok);
    });

    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });

    req.on("error", () => {
      resolve(false);
    });
  });
}

async function waitForUrl(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServiceUp(url)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  return false;
}

function dataLogPath(rootDir, name) {
  return path.join(runtimeContext(rootDir).dataDir, name);
}

function pidFilePath(rootDir, serviceName) {
  return path.join(runtimeContext(rootDir).dataDir, `${serviceName}.pid`);
}

function readPidFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const value = fs.readFileSync(filePath, "utf8").trim();
    if (!value) {
      return null;
    }

    const pid = Number(value);
    return Number.isFinite(pid) ? pid : null;
  } catch (_error) {
    return null;
  }
}

function isPidRunning(pid) {
  if (!pid) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (_error) {
    return false;
  }
}

function removePidFile(filePath) {
  try {
    fs.rmSync(filePath, { force: true });
  } catch (_error) {
    // no-op
  }
}

function cleanupPidFile(rootDir, serviceName) {
  const filePath = pidFilePath(rootDir, serviceName);
  const pid = readPidFile(filePath);
  if (pid && !isPidRunning(pid)) {
    removePidFile(filePath);
  }
}

function appendLog(filePath, content) {
  ensureDirectory(path.dirname(filePath));
  fs.appendFileSync(filePath, content, "utf8");
}

function electronNodeEnv(rootDir, extraEnv = {}) {
  return serviceEnv(rootDir, {
    ELECTRON_RUN_AS_NODE: "1",
    ...extraEnv,
  });
}

function spawnBackgroundProcess({ rootDir, serviceName, cwd, entryPoint, args = [], logFilePath, extraEnv = {} }) {
  ensureDirectory(path.dirname(logFilePath));
  cleanupPidFile(rootDir, serviceName);

  const logFd = fs.openSync(logFilePath, "a");
  const child = spawn(process.execPath, [entryPoint, ...args], {
    cwd,
    detached: true,
    windowsHide: true,
    env: electronNodeEnv(rootDir, extraEnv),
    stdio: ["ignore", logFd, logFd],
  });
  fs.closeSync(logFd);
  child.unref();

  fs.writeFileSync(pidFilePath(rootDir, serviceName), `${child.pid}\n`, "utf8");
  return child.pid;
}

function resolveRequiredPath(rootDir, relativePath, label) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing ${label}: ${absolutePath}`);
  }
  return absolutePath;
}

function resolveApiEntry(rootDir) {
  return resolveRequiredPath(rootDir, "apps/api/dist/apps/api/src/main.js", "API runtime entry");
}

function resolveMigrationRunner(rootDir) {
  return resolveRequiredPath(rootDir, "scripts/maintenance/run-migrations.js", "Database migration runner");
}

function resolveWebServerEntry(rootDir) {
  const standaloneRoot = path.join(rootDir, "apps/web/.next/standalone");
  if (!fs.existsSync(standaloneRoot)) {
    throw new Error("Missing Next standalone runtime in the packaged bundle");
  }

  const queue = [standaloneRoot];
  while (queue.length > 0) {
    const currentDir = queue.shift();
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const candidate = path.join(currentDir, entry.name);
      if (entry.isFile() && entry.name === "server.js") {
        return candidate;
      }
      if (entry.isDirectory()) {
        queue.push(candidate);
      }
    }
  }

  throw new Error("Missing Next standalone server entry in the packaged runtime");
}

async function runDatabaseMigrations(rootDir) {
  const setupLog = dataLogPath(rootDir, "setup.log");
  const migrationRunner = resolveMigrationRunner(rootDir);

  appendLog(setupLog, `\n===== database migrations ${new Date().toISOString()} =====\n`);
  await runCommandLogged(
    process.execPath,
    [migrationRunner],
    rootDir,
    setupLog,
    true,
    electronNodeEnv(rootDir),
    SETUP_TIMEOUT_MS,
    "database migrations"
  );
}

async function ensureApiService(rootDir) {
  const { apiHealthUrl, apiPort } = serviceUrls(rootDir);
  if (await isServiceUp(apiHealthUrl)) {
    return;
  }

  const apiLog = dataLogPath(rootDir, "api.log");
  appendLog(apiLog, `\n===== api start ${new Date().toISOString()} =====\n`);

  spawnBackgroundProcess({
    rootDir,
    serviceName: "api",
    cwd: rootDir,
    entryPoint: resolveApiEntry(rootDir),
    logFilePath: apiLog,
    extraEnv: {
      NODE_ENV: "production",
      API_PORT: apiPort,
    },
  });
}

async function ensureWebService(rootDir) {
  const { webUrl, webPort } = serviceUrls(rootDir);
  if (await isServiceUp(webUrl)) {
    return;
  }

  const webLog = dataLogPath(rootDir, "web.log");
  const webEntry = resolveWebServerEntry(rootDir);
  appendLog(webLog, `\n===== web start ${new Date().toISOString()} =====\n`);

  spawnBackgroundProcess({
    rootDir,
    serviceName: "web",
    cwd: path.dirname(webEntry),
    entryPoint: webEntry,
    logFilePath: webLog,
    extraEnv: {
      NODE_ENV: "production",
      PORT: webPort,
      HOSTNAME: "127.0.0.1",
    },
  });
}

function resourcesRoot() {
  // electron-builder copies `.runtime-bundle/` to `<resources>/runtime/`.
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "runtime");
  }
  return path.join(__dirname, "..", ".runtime-bundle");
}

function envFilePath(rootDir) {
  return runtimeContext(rootDir).envFile;
}

function upsertEnv(rootDir, updates) {
  // Replace-or-append KEY=VALUE lines in the workspace .env. We never delete
  // existing keys; the API/web are the source of truth for which keys matter.
  const target = envFilePath(rootDir);
  const lines = fs.existsSync(target) ? fs.readFileSync(target, "utf8").split(/\r?\n/) : [];
  const written = new Set();
  const rewritten = lines.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match) return line;
    const key = match[1];
    if (updates[key] === undefined) return line;
    written.add(key);
    return `${key}=${updates[key]}`;
  });
  for (const [key, value] of Object.entries(updates)) {
    if (!written.has(key)) {
      rewritten.push(`${key}=${value}`);
    }
  }
  fs.writeFileSync(target, rewritten.filter((l, i, arr) => !(l === "" && i === arr.length - 1)).join("\n") + "\n", "utf8");
}

async function ensureBundledPostgres(rootDir) {
  const context = runtimeContext(rootDir);
  if (!fs.existsSync(context.envFile) && fs.existsSync(context.envTemplate)) {
    fs.copyFileSync(context.envTemplate, context.envFile);
  }
  const pgCtx = postgresService.buildContext({
    workspaceRoot: context.workspaceRoot,
    resourcesDir: resourcesRoot(),
  });
  const url = await postgresService.start(pgCtx);
  upsertEnv(rootDir, { DATABASE_URL: url });
}

async function startLocalServices(rootDir) {
  if (process.platform === "win32") {
    await ensureBundledPostgres(rootDir);
    await runDatabaseMigrations(rootDir);
    await ensureApiService(rootDir);
    return;
  }

  throw new Error("The packaged SO.TE.CO desktop delivery is supported on Windows only.");
}

function stopLocalServices(rootDir) {
  const envOverrides = serviceEnv(rootDir);

  if (process.platform === "win32") {
    const script = path.join(rootDir, "scripts", "maintenance", "local-stop.bat");
    spawn("cmd.exe", ["/c", script], {
      cwd: rootDir,
      windowsHide: true,
      stdio: "ignore",
      env: envOverrides,
    });
    return;
  }
}

function loadingHtml() {
  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>${APP_TITLE}</title>
        <style>
          :root { color-scheme: light; }
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            font-family: "Segoe UI", Tahoma, sans-serif;
            background: radial-gradient(circle at 20% 20%, #dbeafe 0%, #f8fafc 40%, #eef2ff 100%);
            color: #0f172a;
          }
          .card {
            width: min(560px, 90vw);
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
          }
          h1 { margin: 0 0 8px; font-size: 24px; }
          p { margin: 0; color: #334155; line-height: 1.5; }
          .meta { margin-top: 10px; font-size: 13px; color: #64748b; }
          .bar {
            margin-top: 16px;
            height: 6px;
            background: #e2e8f0;
            border-radius: 999px;
            overflow: hidden;
          }
          .bar::before {
            content: "";
            display: block;
            height: 100%;
            width: 40%;
            background: linear-gradient(90deg, #2563eb, #0ea5e9);
            animation: slide 1.2s ease-in-out infinite;
          }
          @keyframes slide {
            0% { transform: translateX(-120%); }
            100% { transform: translateX(280%); }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>SO.TE.CO ERP</h1>
          <p>Demarrage du systeme local en cours...</p>
          <p class="meta">Version ${APP_VERSION}</p>
          <p class="meta">Le premier lancement prepare le poste local de maniere silencieuse.</p>
          <div class="bar"></div>
        </div>
      </body>
    </html>
  `;
}

function readLogTail(filePath, maxLines = 20) {
  try {
    if (!fs.existsSync(filePath)) {
      return "";
    }

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
    return lines.slice(-maxLines).join("\n");
  } catch (_error) {
    return "";
  }
}

function buildStartupFailureMessage(rootDir, error) {
  const context = runtimeContext(rootDir);
  const candidates = [
    path.join(context.dataDir, "setup.log"),
    path.join(rootDir, ".data", "setup.log"),
  ];

  let setupLogPath = "";
  let setupLogTail = "";

  for (const candidate of candidates) {
    const tail = readLogTail(candidate, 20);
    if (tail) {
      setupLogPath = candidate;
      setupLogTail = tail;
      break;
    }
  }

  let message = `Le demarrage des services a echoue.\n\n${error.message}`;

  if (setupLogTail) {
    message += `\n\nExtrait setup.log (dernieres lignes):\n${setupLogTail}`;
    message += `\n\nLog complet:\n${setupLogPath}`;
  } else {
    message += "\n\nAucun setup.log lisible n'a ete trouve.";
  }

  if (app.isPackaged) {
    message += `\n\nDossier de travail:\n${context.workspaceRoot}`;
  }

  return message;
}

function escapePowerShellPath(filePath) {
  return filePath.replace(/'/g, "''");
}

function redactEnvContent(content) {
  return content
    .split(/\r?\n/)
    .map((line) => {
      if (!line || line.trim().startsWith("#") || !line.includes("=")) {
        return line;
      }

      const separatorIndex = line.indexOf("=");
      const key = line.slice(0, separatorIndex);
      if (/(DATABASE_URL|PASSWORD|SECRET|TOKEN|KEY)/i.test(key)) {
        return `${key}=***REDACTED***`;
      }
      return line;
    })
    .join("\n");
}

function writeDiagnosticFiles(exportDir, context) {
  const urls = serviceUrls(context.rootDir);
  const lines = [
    `app_version=${APP_VERSION}`,
    `platform=${process.platform}`,
    `runtime_root=${context.rootDir}`,
    `workspace_root=${context.workspaceRoot}`,
    `data_dir=${context.dataDir}`,
    `env_file=${context.envFile}`,
    `storage_dir=${context.storageDir}`,
    `web_url=${urls.webUrl}`,
    `api_health_url=${urls.apiHealthUrl}`,
  ];
  fs.writeFileSync(path.join(exportDir, "app-info.txt"), `${lines.join("\n")}\n`, "utf8");

  if (fs.existsSync(context.envFile)) {
    const redactedEnv = redactEnvContent(fs.readFileSync(context.envFile, "utf8"));
    fs.writeFileSync(path.join(exportDir, "env.redacted.txt"), `${redactedEnv}\n`, "utf8");
  }

  const logFiles = ["setup.log", "api.log", "web.log", "update.log", "preflight.txt"];
  for (const fileName of logFiles) {
    const source = path.join(context.dataDir, fileName);
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(exportDir, fileName));
    }
  }
}

async function exportDiagnosticsBundle() {
  const rootDir = activeRootDir || syncBundledRuntimeIfNeeded();
  const context = runtimeContext(rootDir);
  ensureDirectory(context.diagnosticsDir);

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const exportDir = path.join(context.diagnosticsDir, `diagnostics-${stamp}`);
  const zipPath = path.join(app.getPath("desktop"), `SO.TE.CO-diagnostics-${APP_VERSION}-${stamp}.zip`);

  ensureDirectory(exportDir);
  writeDiagnosticFiles(exportDir, context);

  if (process.platform === "win32") {
    const command = `Compress-Archive -Path '${escapePowerShellPath(path.join(exportDir, "*"))}' -DestinationPath '${escapePowerShellPath(zipPath)}' -Force`;
    await runCommand(
      "powershell.exe",
      ["-NoProfile", "-Command", command],
      rootDir,
      true,
      serviceEnv(rootDir),
      DIAGNOSTIC_TIMEOUT_MS,
      "diagnostic export"
    );
    shell.showItemInFolder(zipPath);
    return zipPath;
  }

  shell.openPath(exportDir);
  return exportDir;
}

async function runPreflight() {
  if (process.platform !== "win32") {
    throw new Error("Le preflight automatise Windows n'est disponible que sur Windows.");
  }

  const rootDir = activeRootDir || syncBundledRuntimeIfNeeded();
  const context = runtimeContext(rootDir);
  const lines = [];
  const stamp = new Date().toISOString();
  lines.push(`SO.TE.CO ERP preflight ${stamp}`);
  lines.push(`workspace=${context.workspaceRoot}`);
  lines.push(`bundled-postgres=${path.join(resourcesRoot(), "postgres", "bin", "postgres.exe")}`);

  const urls = serviceUrls(rootDir);
  lines.push(`api=${await isServiceUp(urls.apiHealthUrl) ? "up" : "down"}`);
  lines.push(`web=${await isServiceUp(urls.webUrl) ? "up" : "down"}`);

  fs.mkdirSync(path.dirname(context.preflightReport), { recursive: true });
  fs.writeFileSync(context.preflightReport, lines.join("\n") + "\n", "utf8");
  return context.preflightReport;
}

async function restartServicesFromMenu() {
  if (isBootstrapping) {
    return;
  }

  const rootDir = activeRootDir || syncBundledRuntimeIfNeeded();
  const confirmation = await dialog.showMessageBox({
    type: "question",
    buttons: ["Reparer", "Annuler"],
    defaultId: 0,
    cancelId: 1,
    title: APP_TITLE,
    message: "Relancer les services et reparer l'installation locale ?",
    detail: "Cette operation arrete les services locaux, relance la preparation et redemarre l'application.",
  });

  if (confirmation.response !== 0) {
    return;
  }

  stopLocalServices(rootDir);
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await bootstrap(true);
}

function openDataFolder() {
  const context = currentContext();
  shell.openPath(context.workspaceRoot);
}

function openSetupLog() {
  const context = currentContext();
  const setupLog = path.join(context.dataDir, "setup.log");
  if (fs.existsSync(setupLog)) {
    shell.openPath(setupLog);
    return;
  }

  dialog.showMessageBox({
    type: "info",
    title: APP_TITLE,
    message: "Aucun setup.log n'est disponible pour le moment.",
  });
}

function createApplicationMenu() {
  const template = [
    {
      label: "SO.TE.CO ERP",
      submenu: [
        {
          label: `Version ${APP_VERSION}`,
          enabled: false,
        },
        { type: "separator" },
        {
          label: "Ouvrir le dossier de donnees",
          click: () => openDataFolder(),
        },
        {
          label: "Ouvrir setup.log",
          click: () => openSetupLog(),
        },
        { type: "separator" },
        {
          role: "quit",
          label: "Quitter",
        },
      ],
    },
    {
      label: "Maintenance",
      submenu: [
        {
          label: "Reparer l'installation locale",
          click: () => {
            restartServicesFromMenu().catch((error) => {
              dialog.showErrorBox(APP_TITLE, buildStartupFailureMessage(activeRootDir || bundledRuntimeRoot(), error));
            });
          },
        },
        {
          label: "Lancer le preflight Windows",
          click: () => {
            runPreflight()
              .then((reportPath) => {
                dialog.showMessageBox({
                  type: "info",
                  title: APP_TITLE,
                  message: "Preflight termine.",
                  detail: `Rapport: ${reportPath}`,
                });
                shell.openPath(reportPath);
              })
              .catch((error) => {
                dialog.showErrorBox(APP_TITLE, error.message);
              });
          },
        },
        {
          label: "Exporter les diagnostics",
          click: () => {
            exportDiagnosticsBundle()
              .then((outputPath) => {
                dialog.showMessageBox({
                  type: "info",
                  title: APP_TITLE,
                  message: "Export diagnostic termine.",
                  detail: `Fichier: ${outputPath}`,
                });
              })
              .catch((error) => {
                dialog.showErrorBox(APP_TITLE, error.message);
              });
          },
        },
      ],
    },
    {
      label: "Aide",
      submenu: [
        {
          label: "Afficher le dossier de travail",
          click: () => openDataFolder(),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    autoHideMenuBar: true,
    show: false,
    title: APP_TITLE,
    backgroundColor: "#f8fafc",
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function bootstrap(forceRestart = false) {
  if (isBootstrapping) {
    return;
  }

  isBootstrapping = true;

  let rootDir;
  try {
    rootDir = syncBundledRuntimeIfNeeded();
  } catch (error) {
    isBootstrapping = false;
    dialog.showErrorBox(APP_TITLE, `Impossible de preparer le runtime local.\n\n${error.message}`);
    app.quit();
    return;
  }

  activeRootDir = rootDir;

  if (!mainWindow) {
    createWindow();
  }
  await mainWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(loadingHtml())}`);

  try {
    if (forceRestart) {
      stopLocalServices(rootDir);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    await startLocalServices(rootDir);
  } catch (error) {
    isBootstrapping = false;
    dialog.showErrorBox(APP_TITLE, buildStartupFailureMessage(rootDir, error));
    app.quit();
    return;
  }

  const urls = serviceUrls(rootDir);
  const [apiReady, webReady] = await Promise.all([
    waitForUrl(urls.apiHealthUrl, BOOT_TIMEOUT_MS),
    (async () => {
      await ensureWebService(rootDir);
      return waitForUrl(urls.webUrl, BOOT_TIMEOUT_MS);
    })(),
  ]);

  if (!apiReady) {
    dialog.showErrorBox(
      APP_TITLE,
      `Le service API ne demarre pas.\n\nVerifiez les logs dans:\n${runtimeContext(rootDir).dataDir}`
    );
    app.quit();
    return;
  }

  if (!webReady) {
    dialog.showErrorBox(
      APP_TITLE,
      `Le service web met trop de temps a demarrer.\n\nVerifiez les logs dans:\n${runtimeContext(rootDir).dataDir}`
    );
    app.quit();
    return;
  }

  try {
    await mainWindow.loadURL(urls.webUrl);
  } catch (_error) {
    await mainWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(loadingHtml())}`);
  }

  isBootstrapping = false;
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    createApplicationMenu();
    bootstrap().catch((error) => {
      dialog.showErrorBox(APP_TITLE, error.message);
      app.quit();
    });
  });

  app.on("before-quit", () => {
    if (activeRootDir) {
      stopLocalServices(activeRootDir);
    }
    // Best-effort: bundled Postgres is a managed child process, stop it last
    // so API/web get a clean shutdown sequence first.
    postgresService.stop().catch(() => {});
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      bootstrap().catch((error) => {
        dialog.showErrorBox(APP_TITLE, error.message);
        app.quit();
      });
    }
  });
}
