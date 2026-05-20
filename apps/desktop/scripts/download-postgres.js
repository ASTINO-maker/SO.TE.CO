// Downloads the EnterpriseDB Windows ZIP build of PostgreSQL into the staged
// runtime bundle. Runs once per version; subsequent builds reuse the cached
// extraction in .runtime-bundle/postgres/ unless --force is passed.
//
// The bundled cluster is a vanilla binary distribution; we initialize the
// data directory at first launch from inside Electron (see src/postgres.js).

const fs = require("node:fs");
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const POSTGRES_VERSION = "16.4-1";
const POSTGRES_URL = `https://get.enterprisedb.com/postgresql/postgresql-${POSTGRES_VERSION}-windows-x64-binaries.zip`;

const desktopRoot = path.resolve(__dirname, "..");
const bundleRoot = path.join(desktopRoot, ".runtime-bundle");
const stagedDir = path.join(bundleRoot, "postgres");
const cacheRoot = path.join(os.homedir(), ".sotec-build-cache");
const cachedZip = path.join(cacheRoot, `postgresql-${POSTGRES_VERSION}-windows-x64-binaries.zip`);
const versionMarker = path.join(stagedDir, ".version");

function log(message) {
  console.log(`[postgres] ${message}`);
}

function download(url, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  return new Promise((resolve, reject) => {
    const tmp = `${destination}.partial`;
    const file = fs.createWriteStream(tmp);
    const request = (currentUrl) => {
      https.get(currentUrl, (response) => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
          file.close(() => {});
          request(response.headers.location);
          return;
        }
        if (response.statusCode !== 200) {
          file.close(() => {});
          fs.unlinkSync(tmp);
          reject(new Error(`Download failed: HTTP ${response.statusCode} for ${currentUrl}`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            fs.renameSync(tmp, destination);
            resolve();
          });
        });
      }).on("error", (err) => {
        file.close(() => {});
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
        reject(err);
      });
    };
    request(url);
  });
}

function extract(zipPath, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  // PowerShell Expand-Archive is the only stock cross-platform option that
  // works on a stock Windows machine, but the build host might be macOS/Linux.
  if (process.platform === "win32") {
    const result = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${targetDir}' -Force`,
      ],
      { stdio: "inherit" }
    );
    if (result.status !== 0) {
      throw new Error("Expand-Archive failed");
    }
    return;
  }
  // macOS / Linux build host: use the system `unzip`.
  const result = spawnSync("unzip", ["-q", "-o", zipPath, "-d", targetDir], { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error("unzip failed (install `unzip` on the build host)");
  }
}

function markerMatches() {
  if (!fs.existsSync(versionMarker)) return false;
  try {
    return fs.readFileSync(versionMarker, "utf8").trim() === POSTGRES_VERSION;
  } catch {
    return false;
  }
}

function pruneExtractedTree(extractedRoot) {
  // EDB zip extracts to <targetDir>/pgsql/. Move its contents up one level.
  const inner = path.join(extractedRoot, "pgsql");
  if (!fs.existsSync(inner)) return;
  for (const entry of fs.readdirSync(inner)) {
    fs.renameSync(path.join(inner, entry), path.join(extractedRoot, entry));
  }
  fs.rmdirSync(inner);

  // Drop the bits we never run on the client to keep the installer small:
  // include only the lib + share + bin pieces actually needed at runtime.
  const dropDirs = ["doc", "include", "pgAdmin 4", "StackBuilder", "symbols"];
  for (const name of dropDirs) {
    const candidate = path.join(extractedRoot, name);
    if (fs.existsSync(candidate)) {
      fs.rmSync(candidate, { recursive: true, force: true });
    }
  }
}

async function main() {
  const force = process.argv.includes("--force");

  if (!force && markerMatches()) {
    log(`Bundle already contains PostgreSQL ${POSTGRES_VERSION}, skipping.`);
    return;
  }

  if (!fs.existsSync(cachedZip) || force) {
    log(`Downloading PostgreSQL ${POSTGRES_VERSION} (~300MB) ...`);
    await download(POSTGRES_URL, cachedZip);
    log(`Cached at ${cachedZip}`);
  } else {
    log(`Using cached ZIP at ${cachedZip}`);
  }

  log("Extracting...");
  fs.rmSync(stagedDir, { recursive: true, force: true });
  extract(cachedZip, stagedDir);
  pruneExtractedTree(stagedDir);

  fs.writeFileSync(versionMarker, `${POSTGRES_VERSION}\n`, "utf8");
  log(`Staged at ${stagedDir}`);
}

main().catch((err) => {
  console.error(`[postgres] FAILED: ${err.message}`);
  process.exit(1);
});
