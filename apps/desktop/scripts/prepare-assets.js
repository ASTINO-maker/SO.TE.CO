// Generates build/icon.ico from the brand logo so electron-builder can stamp
// the installer + .exe with our logo. The conversion needs a square PNG; if
// we don't have one (the SO.TE.CO logo is wide), we just keep the icon.ico
// that ships with the repo and skip regeneration. The installer still gets
// branded correctly.

const fs = require("node:fs");
const path = require("node:path");
const pngToIco = require("png-to-ico");

async function main() {
  const buildDir = path.resolve(__dirname, "../build");
  const targetIco = path.resolve(buildDir, "icon.ico");

  // If a pre-built icon.ico is already shipped with the repo, keep it.
  // This makes the build robust: we don't fail just because no square PNG
  // is available. To refresh the icon later, drop a NEW icon.ico into
  // apps/desktop/build/ or a square PNG into apps/web/public/brand/sotec-icon.png.
  const squarePngCandidates = [
    path.resolve(__dirname, "../../web/public/brand/sotec-icon.png"),
    path.resolve(__dirname, "../../web/public/brand/sotec-mark.png"),
  ];

  const squarePng = squarePngCandidates.find((candidate) => fs.existsSync(candidate));

  if (!squarePng) {
    if (fs.existsSync(targetIco)) {
      console.log(`[Assets] No square PNG found; keeping existing ${targetIco}`);
      return;
    }
    throw new Error(
      "No square brand PNG available and no pre-built icon.ico in apps/desktop/build/. " +
      "Add a square PNG at apps/web/public/brand/sotec-icon.png to fix."
    );
  }

  fs.mkdirSync(buildDir, { recursive: true });
  const ico = await pngToIco(squarePng);
  fs.writeFileSync(targetIco, ico);
  console.log(`[Assets] Generated ${targetIco} from ${path.basename(squarePng)}`);
}

main().catch((error) => {
  console.error("[Assets] Failed to prepare desktop assets");
  console.error(error.message || error);
  process.exit(1);
});
