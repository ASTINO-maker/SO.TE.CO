"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Download, Printer, X } from "lucide-react";
import { StatusBadge } from "../admin/status-badge";
import { Button } from "../ui/button";
import { DrawerShell } from "../ui/drawer";

const PDF_BLOB_CACHE_TTL_MS = 60_000;
const pdfBlobCache = new Map<string, { blob: Blob; expiresAt: number }>();
const inflightPdfRequests = new Map<string, Promise<Blob>>();

export interface ViewerInfoRow {
  label: string;
  value: string;
  emphasis?: boolean;
}

export interface ViewerListItem {
  title: string;
  meta: string;
}

export interface PrintHtmlDocumentResult {
  status: "printed" | "blocked" | "invalid-markup" | "error";
  message: string;
}

const PREVIEW_STYLE = `
  <style id="codex-preview-fit">
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #f7f1e7 !important;
      overflow: hidden !important;
    }

    body {
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }

    .page {
      margin: 0 auto !important;
      box-shadow: none !important;
      zoom: 0.68;
      transform-origin: top center;
    }
  </style>
`;

export async function downloadPdfDocument(filename: string, markup: string) {
  const pdfFilename = normalizePdfFilename(filename);
  const blob = await requestPdfBlob(pdfFilename, markup);
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = pdfFilename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  }, 1500);
}

async function requestPdfBlob(filename: string, markup: string) {
  const cacheKey = `${filename}::${markup}`;
  const now = Date.now();
  const cached = pdfBlobCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.blob;
  }

  pdfBlobCache.delete(cacheKey);

  const inflight = inflightPdfRequests.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const requestPromise = fetch("/api/render-pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename,
      markup,
    }),
  })
    .then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Unable to generate the PDF.");
      }

      return response.blob();
    })
    .then((blob) => {
      pdfBlobCache.set(cacheKey, {
        blob,
        expiresAt: Date.now() + PDF_BLOB_CACHE_TTL_MS,
      });
      return blob;
    })
    .finally(() => {
      inflightPdfRequests.delete(cacheKey);
    });

  inflightPdfRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

function hasRenderableMarkup(markup: string) {
  const normalized = markup.trim().toLowerCase();
  return Boolean(normalized) && normalized.includes("<html") && normalized.includes("<body");
}

function waitForPrintWindowReady(printWindow: Window) {
  const readinessPromise = new Promise<void>((resolve) => {
    const doc = printWindow.document;
    if (doc.readyState === "complete") {
      resolve();
      return;
    }

    const onReady = () => {
      if (doc.readyState === "complete") {
        doc.removeEventListener("readystatechange", onReady);
        printWindow.removeEventListener("load", onReady);
        resolve();
      }
    };

    doc.addEventListener("readystatechange", onReady);
    printWindow.addEventListener("load", onReady);
  });

  const timeoutPromise = new Promise<void>((resolve) => {
    window.setTimeout(resolve, 2000);
  });

  return Promise.race([readinessPromise, timeoutPromise]);
}

async function waitForAssets(printWindow: Window) {
  const doc = printWindow.document;
  const imagePromises = Array.from(doc.images).map((image) => {
    if (image.complete) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const done = () => {
        image.removeEventListener("load", done);
        image.removeEventListener("error", done);
        resolve();
      };

      image.addEventListener("load", done);
      image.addEventListener("error", done);
    });
  });

  await Promise.all(imagePromises);

  if (doc.fonts?.ready) {
    await doc.fonts.ready;
  }
}

export async function printHtmlDocument(title: string, markup: string): Promise<PrintHtmlDocumentResult> {
  if (!hasRenderableMarkup(markup)) {
    return {
      status: "invalid-markup",
      message: "L'apercu du document est indisponible. Actualisez et reessayez.",
    };
  }

  const printWindow = window.open("about:blank", "_blank", "width=1200,height=900");
  if (!printWindow) {
    return {
      status: "blocked",
      message: "Le popup est bloque par le navigateur. Autorisez les popups et reessayez.",
    };
  }

  try {
    printWindow.document.open();
    printWindow.document.write(markup);
    printWindow.document.close();
    printWindow.document.title = title;
    await waitForPrintWindowReady(printWindow);
    await waitForAssets(printWindow);
    printWindow.focus();
    printWindow.print();
    printWindow.onafterprint = () => {
      window.setTimeout(() => {
        printWindow.close();
      }, 150);
    };

    return {
      status: "printed",
      message: `${title} envoyé à l'impression.`,
    };
  } catch {
    return {
      status: "error",
      message: "L'impression a echoue. Reessayez ou telechargez le PDF.",
    };
  }
}

function normalizePdfFilename(filename: string) {
  const cleaned = filename.replace(/\.[^.]+$/u, "");
  return `${cleaned}.pdf`;
}

function createPreviewMarkup(markup: string) {
  if (markup.includes("</head>")) {
    return markup.replace("</head>", `${PREVIEW_STYLE}</head>`);
  }

  return markup;
}

export function DocumentViewerDrawer({
  open,
  title,
  subtitle,
  status,
  overview,
  client,
  related,
  documentHtml,
  onClose,
  onDownload,
  onPrint,
  extraActions,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  status?: string;
  overview: ViewerInfoRow[];
  client: ViewerInfoRow[];
  related?: ViewerListItem[];
  documentHtml: string;
  onClose: () => void;
  onDownload: () => void;
  onPrint: () => void | Promise<void>;
  extraActions?: ReactNode;
}) {
  const iframeMarkup = useMemo(() => createPreviewMarkup(documentHtml), [documentHtml]);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string>("");
  const [pdfPreviewError, setPdfPreviewError] = useState("");
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);

  useEffect(() => {
    if (!open || !hasRenderableMarkup(documentHtml)) {
      return;
    }

    let isActive = true;
    let objectUrl = "";
    setPdfPreviewLoading(true);
    setPdfPreviewError("");

    void requestPdfBlob(normalizePdfFilename(title), documentHtml)
      .then((blob) => {
        if (!isActive) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setPdfPreviewUrl(objectUrl);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        const message = error instanceof Error ? error.message : "Impossible de générer l'aperçu PDF.";
        setPdfPreviewError(message);
        setPdfPreviewUrl("");
      })
      .finally(() => {
        if (isActive) {
          setPdfPreviewLoading(false);
        }
      });

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [documentHtml, open, title]);

  async function handleDownloadClick() {
    setDownloadLoading(true);
    try {
      await Promise.resolve(onDownload());
    } finally {
      setDownloadLoading(false);
    }
  }

  async function handlePrintClick() {
    setPrintLoading(true);
    try {
      await Promise.resolve(onPrint());
    } finally {
      setPrintLoading(false);
    }
  }

  return (
    <DrawerShell
      open={open}
      title={title}
      description={subtitle}
      panelClassName="max-w-[min(98vw,1360px)]"
      bodyClassName="bg-[#f7f1e7] p-0"
    >
      <div className="grid gap-5 p-6 pb-8">
        <div className="sticky top-0 z-10 rounded-[1.4rem] border border-black/6 bg-white/95 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-slate-900">{title}</p>
                {status ? <StatusBadge status={status} /> : null}
              </div>
              {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
            </div>
            <Button type="button" variant="ghost" className="h-9 rounded-xl px-3" onClick={onClose}>
              <X className="h-4 w-4" />
              Fermer
            </Button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid gap-4">
            {overview.length ? <DetailSection title="Résumé du document" rows={overview} /> : null}

            <div className="rounded-[1.4rem] border border-black/6 bg-white px-4 py-3 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Aperçu PDF</p>
              <p className="mt-1 text-sm text-slate-500">Même rendu que le fichier téléchargé ou imprimé.</p>
            </div>

            <div className="overflow-hidden rounded-[1.75rem] border border-[#d8ccb7] bg-[linear-gradient(180deg,#ecdfcb_0%,#f7f1e7_100%)] p-5 shadow-sm">
              <div className="mx-auto w-full max-w-[760px] overflow-hidden rounded-[1.3rem] border border-black/8 bg-white shadow-[0_24px_80px_rgba(33,24,8,0.12)]">
                {pdfPreviewUrl ? (
                  <iframe key={`${title}-${pdfPreviewUrl}`} title={title} src={pdfPreviewUrl} className="h-[980px] min-h-[980px] w-full bg-white" />
                ) : pdfPreviewLoading ? (
                  <div className="flex h-[980px] min-h-[980px] items-center justify-center bg-white text-sm text-slate-500">
                    Génération de l'aperçu PDF...
                  </div>
                ) : pdfPreviewError ? (
                  <div className="flex h-[980px] min-h-[980px] items-center justify-center bg-white px-6 text-center text-sm text-rose-600">
                    {pdfPreviewError}
                  </div>
                ) : (
                  <iframe
                    key={`${title}-${documentHtml.length}`}
                    title={title}
                    srcDoc={iframeMarkup}
                    className="h-[980px] min-h-[980px] w-full bg-white"
                  />
                )}
              </div>
            </div>
          </div>

          <aside className="grid gap-4 xl:sticky xl:top-24 xl:self-start">
            <ActionPanel
              onDownload={handleDownloadClick}
              onPrint={handlePrintClick}
              onClose={onClose}
              extraActions={extraActions}
              downloadLoading={downloadLoading}
              printLoading={printLoading}
            />
            <DetailSection title="Informations client" rows={client} />

            {related?.length ? (
              <div className="rounded-[1.4rem] border border-black/6 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">Historique lié</p>
                <div className="mt-3 space-y-2">
                  {related.map((item) => (
                    <div
                      key={`${item.title}-${item.meta}`}
                      className="rounded-xl border border-black/6 bg-[#fcfbf8] px-3 py-3"
                    >
                      <p className="text-sm font-medium text-slate-800">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.meta}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </DrawerShell>
  );
}

function DetailSection({
  title,
  rows,
}: {
  title: string;
  rows: ViewerInfoRow[];
}) {
  return (
    <div className="rounded-[1.4rem] border border-black/6 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-3 divide-y divide-black/6 overflow-hidden rounded-[1rem] border border-black/6 bg-[#fcfbf8]">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm">
            <span className="text-slate-500">{row.label}</span>
            <span className={row.emphasis ? "font-semibold text-[#ff5b21]" : "font-medium text-slate-800"}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionPanel({
  onDownload,
  onPrint,
  onClose,
  extraActions,
  downloadLoading,
  printLoading,
}: {
  onDownload: () => void | Promise<void>;
  onPrint: () => void | Promise<void>;
  onClose: () => void;
  extraActions?: ReactNode;
  downloadLoading?: boolean;
  printLoading?: boolean;
}) {
  return (
    <div className="rounded-[1.4rem] border border-black/6 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">Actions rapides</p>
      <p className="mt-1 text-sm text-slate-500">Téléchargement, impression et actions métier.</p>
      <div className="mt-4 grid gap-3">
        {extraActions ? <div className="grid gap-3">{extraActions}</div> : null}
        <Button
          type="button"
          variant="outline"
          className="h-10 justify-start rounded-xl px-3"
          onClick={() => void onPrint()}
          disabled={printLoading}
        >
          <Printer className="h-4 w-4" />
          {printLoading ? "Impression en cours..." : "Imprimer le document"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 justify-start rounded-xl px-3"
          onClick={() => void onDownload()}
          disabled={downloadLoading}
        >
          <Download className="h-4 w-4" />
          {downloadLoading ? "Téléchargement en cours..." : "Télécharger le PDF"}
        </Button>
        <Button type="button" variant="ghost" className="h-10 justify-start rounded-xl px-3" onClick={onClose}>
          <X className="h-4 w-4" />
          Fermer le panneau
        </Button>
      </div>
    </div>
  );
}
