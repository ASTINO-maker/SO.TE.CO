import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const execFileAsync = promisify(execFile);
const CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PDF_CACHE_TTL_MS = 60_000;
const PDF_VIRTUAL_TIME_BUDGET_MS = Number.parseInt(process.env.PDF_VIRTUAL_TIME_BUDGET_MS ?? "600", 10);
const pdfBufferCache = new Map<string, { buffer: Buffer; expiresAt: number }>();
const inflightRenderCache = new Map<string, Promise<Buffer>>();

export async function renderPdfBuffer(filename: string, markup: string) {
  const cacheKey = createHash("sha1").update(filename).update("\0").update(markup).digest("hex");
  const now = Date.now();
  const cached = pdfBufferCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.buffer;
  }

  pdfBufferCache.delete(cacheKey);

  const inflight = inflightRenderCache.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const renderPromise = renderPdfBufferUncached(filename, markup)
    .then((buffer) => {
      pdfBufferCache.set(cacheKey, {
        buffer,
        expiresAt: Date.now() + PDF_CACHE_TTL_MS,
      });
      return buffer;
    })
    .finally(() => {
      inflightRenderCache.delete(cacheKey);
    });

  inflightRenderCache.set(cacheKey, renderPromise);
  return renderPromise;
}

async function renderPdfBufferUncached(filename: string, markup: string) {
  const workdir = join(tmpdir(), `sotec-pdf-${randomUUID()}`);
  const htmlPath = join(workdir, "document.html");
  const pdfPath = join(workdir, filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`);

  await mkdir(workdir, { recursive: true });
  await writeFile(htmlPath, markup, "utf8");

  try {
    await execFileAsync(CHROME_BIN, [
      "--headless",
      "--disable-gpu",
      "--allow-file-access-from-files",
      "--run-all-compositor-stages-before-draw",
      `--virtual-time-budget=${Number.isFinite(PDF_VIRTUAL_TIME_BUDGET_MS) ? Math.max(150, PDF_VIRTUAL_TIME_BUDGET_MS) : 600}`,
      "--no-pdf-header-footer",
      `--print-to-pdf=${pdfPath}`,
      `file://${htmlPath}`,
    ]);

    return await readFile(pdfPath);
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}
