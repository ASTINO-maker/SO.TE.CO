import { NextResponse } from "next/server";
import { renderPdfBuffer } from "../../../lib/server/pdf-renderer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { filename?: string; markup?: string };
    const filename = normalizeFilename(body.filename);
    const markup = typeof body.markup === "string" ? body.markup.trim() : "";

    if (!markup) {
      return NextResponse.json({ error: "Missing document markup." }, { status: 400 });
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
  const base = typeof filename === "string" && filename.trim() ? filename.trim() : "document.pdf";
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}
