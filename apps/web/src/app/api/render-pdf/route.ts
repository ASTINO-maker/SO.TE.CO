import { basename } from "node:path";
import { NextResponse } from "next/server";
import { authenticateServerRequest } from "../../../lib/server/api-auth";
import { renderPdfBuffer } from "../../../lib/server/pdf-renderer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MARKUP_BYTES = 1_000_000;
const UNSAFE_MARKUP_PATTERN = /<(?:script|iframe|object|embed)\b|(?:file|javascript):/iu;

export async function POST(request: Request) {
  const principal = await authenticateServerRequest(request);
  if (!principal) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const canRenderBusinessDocuments = [
    "clients.read",
    "quotations.read",
    "invoices.read",
    "delivery_notes.read",
  ].some((permission) => principal.permissions.includes(permission));

  if (!canRenderBusinessDocuments) {
    return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MARKUP_BYTES * 1.25) {
    return NextResponse.json({ error: "Document markup is too large." }, { status: 413 });
  }

  try {
    const body = (await request.json()) as { filename?: string; markup?: string };
    const filename = normalizeFilename(body.filename);
    const markup = typeof body.markup === "string" ? body.markup.trim() : "";

    if (!markup) {
      return NextResponse.json({ error: "Missing document markup." }, { status: 400 });
    }

    if (Buffer.byteLength(markup, "utf8") > MAX_MARKUP_BYTES) {
      return NextResponse.json({ error: "Document markup is too large." }, { status: 413 });
    }

    if (UNSAFE_MARKUP_PATTERN.test(markup)) {
      return NextResponse.json({ error: "Unsafe document markup." }, { status: 400 });
    }

    const pdfBuffer = await renderPdfBuffer(filename, markup);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function normalizeFilename(filename?: string) {
  const raw = typeof filename === "string" && filename.trim() ? filename.trim() : "document.pdf";
  const safeBase = basename(raw)
    .replace(/[^\p{L}\p{N}._ -]+/gu, "_")
    .replace(/^\.+/u, "")
    .slice(0, 120) || "document.pdf";
  return safeBase.toLowerCase().endsWith(".pdf") ? safeBase : `${safeBase}.pdf`;
}
