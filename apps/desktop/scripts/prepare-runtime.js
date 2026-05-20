const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "../../..");
const desktopRoot = path.resolve(__dirname, "..");
const stageRoot = path.join(desktopRoot, ".runtime-bundle");
const runtimeBundleMarkerFile = ".sotec-runtime-bundle-id";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function ensureExists(relativePath) {
  const target = path.join(repoRoot, relativePath);
  if (!fs.existsSync(target)) {
    throw new Error(`Required runtime asset is missing: ${relativePath}`);
  }
  return target;
}

function copyRelative(sourceRelativePath, targetRelativePath = sourceRelativePath) {
  const source = ensureExists(sourceRelativePath);
  const target = path.join(stageRoot, targetRelativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true, force: true });
  normalizeWindowsBatchFiles(target);
}

function normalizeWindowsBatchFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const normalized = content.replace(/\r?\n/g, "\r\n");
  if (normalized !== content) {
    fs.writeFileSync(filePath, normalized, "utf8");
  }
}

function normalizeWindowsBatchFiles(targetPath) {
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    if (targetPath.toLowerCase().endsWith(".bat")) {
      normalizeWindowsBatchFile(targetPath);
    }
    return;
  }

  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    normalizeWindowsBatchFiles(path.join(targetPath, entry.name));
  }
}

function resolveInstalledPackageRoot(packageName) {
  const packageJsonPath = require.resolve(`${packageName}/package.json`, { paths: [repoRoot] });
  return fs.realpathSync(path.dirname(packageJsonPath));
}

function externalApiDependencies() {
  const apiPackage = readJson(path.join(repoRoot, "apps/api/package.json"));
  const dependencies = {};

  for (const [name, version] of Object.entries(apiPackage.dependencies || {})) {
    if (!name.startsWith("@sotec/")) {
      dependencies[name] = version;
    }
  }

  return dependencies;
}

function installRuntimeDependencies() {
  writeJson(path.join(stageRoot, "package.json"), {
    name: "sotec-runtime",
    private: true,
    dependencies: externalApiDependencies(),
  });

  const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const install = spawnSync(
    pnpmCommand,
    [
      "install",
      "--prod",
      "--ignore-workspace",
      "--no-frozen-lockfile",
      "--no-lockfile",
      "--config.node-linker=hoisted",
    ],
    {
      cwd: stageRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );

  if (install.error) {
    throw install.error;
  }

  if (install.status !== 0) {
    throw new Error("Failed to install staged runtime dependencies");
  }
}

function generateWorkspacePrismaClient() {
  const prismaCli = require.resolve("prisma/build/index.js", { paths: [repoRoot] });
  const schemaPath = path.join(repoRoot, "packages", "database", "prisma", "schema.prisma");
  const nodeCommand = process.execPath;
  const generate = spawnSync(nodeCommand, [prismaCli, "generate", "--schema", schemaPath], {
    cwd: repoRoot,
    stdio: "inherit",
  });

  if (generate.status !== 0) {
    throw new Error("Failed to generate the workspace Prisma client");
  }
}

function keepOnlyEntries(dirPath, keepEntries) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  for (const entry of fs.readdirSync(dirPath)) {
    if (!keepEntries.has(entry)) {
      fs.rmSync(path.join(dirPath, entry), { recursive: true, force: true });
    }
  }
}

function copyPrismaRuntime() {
  generateWorkspacePrismaClient();

  const prismaClientRoot = resolveInstalledPackageRoot("@prisma/client");
  const generatedClientRoot = fs.realpathSync(path.resolve(prismaClientRoot, "..", "..", ".prisma", "client"));
  const stagedPrismaClientRoot = path.join(stageRoot, "node_modules", "@prisma", "client");
  const stagedGeneratedClientRoot = path.join(stageRoot, "node_modules", ".prisma", "client");

  // Sanity: the generated client must contain the Windows engine, otherwise
  // the installer would ship a Prisma client that crashes on the client PC
  // with "could not find query engine for runtime windows".
  const windowsEngine = path.join(generatedClientRoot, "query_engine-windows.dll.node");
  if (!fs.existsSync(windowsEngine)) {
    throw new Error(
      `Prisma did not generate the Windows query engine.\n` +
      `Expected: ${windowsEngine}\n` +
      `Confirm packages/database/prisma/schema.prisma has "windows" in binaryTargets.`
    );
  }

  fs.mkdirSync(path.dirname(stagedPrismaClientRoot), { recursive: true });
  fs.mkdirSync(path.dirname(stagedGeneratedClientRoot), { recursive: true });
  fs.cpSync(prismaClientRoot, stagedPrismaClientRoot, { recursive: true, force: true });
  fs.cpSync(generatedClientRoot, stagedGeneratedClientRoot, { recursive: true, force: true });

  keepOnlyEntries(stagedPrismaClientRoot, new Set(["client.js", "default.js", "index.js", "package.json", "runtime"]));
  keepOnlyEntries(path.join(stagedPrismaClientRoot, "runtime"), new Set(["library.js", "library.mjs"]));
  keepOnlyEntries(
    stagedGeneratedClientRoot,
    new Set(["client.js", "default.js", "index.js", "package.json", "query_engine-windows.dll.node", "schema.prisma"])
  );
}

function writeRuntimeBundleMarker() {
  const desktopPackage = readJson(path.join(desktopRoot, "package.json"));
  const webBuildId = fs.readFileSync(path.join(repoRoot, "apps/web/.next/BUILD_ID"), "utf8").trim();

  fs.writeFileSync(
    path.join(stageRoot, runtimeBundleMarkerFile),
    `desktop=${desktopPackage.version}\nweb=${webBuildId}\n`,
    "utf8"
  );
}

function writeLocalRuntimePackage(packageName, sourceSubdir) {
  const sourceRoot = path.join(repoRoot, sourceSubdir);
  const sourcePackage = readJson(path.join(sourceRoot, "package.json"));
  const scopedPath = packageName.split("/");
  const targetRoot = path.join(stageRoot, "node_modules", ...scopedPath);

  fs.mkdirSync(targetRoot, { recursive: true });
  fs.cpSync(path.join(sourceRoot, "dist"), path.join(targetRoot, "dist"), { recursive: true, force: true });

  writeJson(path.join(targetRoot, "package.json"), {
    name: sourcePackage.name,
    private: true,
    version: sourcePackage.version,
    main: sourcePackage.main || "dist/index.js",
    types: sourcePackage.types,
  });
}

function wipeStageExceptPostgres() {
  // Keep the cached Postgres extraction so repeat builds don't re-download
  // ~300MB. Wipe everything else so we always pick up fresh app code.
  if (!fs.existsSync(stageRoot)) {
    fs.mkdirSync(stageRoot, { recursive: true });
    return;
  }
  for (const entry of fs.readdirSync(stageRoot)) {
    if (entry === "postgres") continue;
    fs.rmSync(path.join(stageRoot, entry), { recursive: true, force: true });
  }
}

function runWorkspaceBuild(filterName, label) {
  console.log(`[Runtime] Building ${label}...`);
  const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = spawnSync(pnpmCommand, ["--filter", filterName, "build"], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`Failed to build ${label}`);
  }
}

function ensureRequiredOutputs() {
  // Self-healing: if a build output is missing, run the build that produces it.
  // This makes `pnpm dist:win` work whether called directly or as part of the
  // root `build:installer` chain.
  if (!fs.existsSync(path.join(repoRoot, "packages/database/node_modules/.prisma/client"))
      && !fs.existsSync(path.join(repoRoot, "node_modules/.prisma/client"))) {
    runWorkspaceBuild("@sotec/database", "@sotec/database");
  }
  if (!fs.existsSync(path.join(repoRoot, "apps/api/dist/apps/api/src/main.js"))) {
    runWorkspaceBuild("@sotec/api", "@sotec/api");
  }
  if (!fs.existsSync(path.join(repoRoot, "apps/web/.next/standalone"))
      || !fs.existsSync(path.join(repoRoot, "apps/web/.next/BUILD_ID"))) {
    runWorkspaceBuild("@sotec/web", "@sotec/web");
  }
}

function main() {
  ensureRequiredOutputs();

  const requiredFiles = [
    ".env.example",
    "apps/api/dist/apps/api/src/main.js",
    "apps/web/.next/BUILD_ID",
    "apps/web/.next/standalone",
    "apps/web/.next/static",
    "apps/web/public",
    "packages/database/prisma/schema.prisma",
    "packages/database/prisma/migrations",
    "scripts/maintenance/local-stop.bat",
    "scripts/maintenance/run-migrations.js",
  ];

  for (const file of requiredFiles) {
    ensureExists(file);
  }

  wipeStageExceptPostgres();

  copyRelative(".env.example");
  copyRelative("apps/api/dist");
  copyRelative("apps/web/.next/standalone");
  copyRelative("apps/web/.next/static");
  copyRelative("apps/web/public");
  copyRelative("packages/database/prisma/schema.prisma");
  copyRelative("packages/database/prisma/migrations");
  copyRelative("scripts/maintenance/local-stop.bat");
  copyRelative("scripts/maintenance/run-migrations.js");

  installRuntimeDependencies();
  copyPrismaRuntime();
  writeLocalRuntimePackage("@sotec/config", "packages/config");
  writeLocalRuntimePackage("@sotec/contracts", "packages/contracts");
  // The API imports PrismaClient from @sotec/database; without this the
  // bundled API crashes at runtime with "Cannot find module @sotec/database".
  writeLocalRuntimePackage("@sotec/database", "packages/database");
  writeRuntimeBundleMarker();

  // Bundled PostgreSQL: staged at .runtime-bundle/postgres/ via cached ZIP.
  const pg = spawnSync(process.execPath, [path.join(__dirname, "download-postgres.js")], {
    stdio: "inherit",
  });
  if (pg.status !== 0) {
    throw new Error("Failed to stage bundled PostgreSQL");
  }

  console.log(`[Runtime] Prepared staged bundle at ${stageRoot}`);
}

main();
