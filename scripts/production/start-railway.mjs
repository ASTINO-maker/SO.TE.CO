import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = process.cwd();
const apiPort = process.env.API_PORT || "4000";
const publicDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
const publicUrl = publicDomain ? `https://${publicDomain}` : undefined;

process.env.NODE_ENV ||= "production";
process.env.API_PORT = apiPort;
process.env.PORT ||= "3000";
process.env.HOSTNAME ||= "0.0.0.0";
process.env.NEXT_PUBLIC_API_URL ||= "/api/v1";
process.env.API_INTERNAL_URL ||= `http://127.0.0.1:${apiPort}`;
process.env.LOCAL_STORAGE_PATH ||= resolve(rootDir, "storage");

if (publicUrl) {
  process.env.APP_URL ||= publicUrl;
  process.env.APP_BASE_URL ||= publicUrl;
  process.env.NEXT_PUBLIC_APP_URL ||= publicUrl;
  process.env.CORS_ORIGIN ||= publicUrl;
}

mkdirSync(process.env.LOCAL_STORAGE_PATH, { recursive: true });

function spawnProcess(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit",
    ...options,
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    console.error(`${name} exited`, { code, signal });
    shutdown(code ?? 1);
  });

  return child;
}

function runOnce(name, command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env: process.env,
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }

      rejectRun(new Error(`${name} failed with exit code ${code}`));
    });
  });
}

let shuttingDown = false;
const children = [];

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => process.exit(code), 1_500).unref();
}

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

await runOnce("prisma migrate deploy", process.execPath, [
  "node_modules/prisma/build/index.js",
  "migrate",
  "deploy",
  "--schema",
  "packages/database/prisma/schema.prisma",
]);

children.push(
  spawnProcess("api", process.execPath, ["apps/api/dist/apps/api/src/main.js"]),
  spawnProcess("web", process.execPath, ["apps/web/.next/standalone/apps/web/server.js"]),
);
