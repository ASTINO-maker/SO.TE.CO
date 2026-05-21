import { formatTnd as formatTndShared } from "@sotec/config";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatFormalDate(value: Date | string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTnd(value: number | string) {
  return formatTndShared(toNumericValue(value));
}

function formatInvoiceTnd(value: number | string, options: { decimals?: number } = {}) {
  return formatTndShared(toNumericValue(value), options);
}

function toNumericValue(value: number | string) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const sanitized = String(value).replace(/[^\d,.-]/g, "").trim();
  if (!sanitized) {
    return 0;
  }

  const hasComma = sanitized.includes(",");
  const hasDot = sanitized.includes(".");
  let normalized = sanitized;

  if (hasComma && hasDot) {
    normalized =
      sanitized.lastIndexOf(",") > sanitized.lastIndexOf(".")
        ? sanitized.replace(/\./g, "").replace(",", ".")
        : sanitized.replace(/,/g, "");
  } else if (hasComma) {
    normalized = /^-?\d{1,3}(,\d{3})+$/.test(sanitized)
      ? sanitized.replace(/,/g, "")
      : sanitized.replace(",", ".");
  }

  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

type TvaBreakdownRow = { rate: number; baseHt: number; tva: number };

function computeTvaBreakdown(
  lines: Array<{ taxRate?: number | string; subtotalHt?: number | string; total?: string }>,
  totalBaseFallback: number,
  fodecValue: number,
): { rows: TvaBreakdownRow[]; totalTva: number; totalBase: number } {
  const grouped = new Map<number, number>();
  let totalBase = 0;

  for (const line of lines) {
    const rawRate = line.taxRate;
    if (rawRate === undefined || rawRate === null || rawRate === "") {
      continue;
    }
    const rate = round3(toNumericValue(rawRate));
    const subtotal = round3(toNumericValue(line.subtotalHt ?? 0));
    grouped.set(rate, round3((grouped.get(rate) ?? 0) + subtotal));
    totalBase = round3(totalBase + subtotal);
  }

  if (grouped.size === 0) {
    return { rows: [], totalTva: 0, totalBase: 0 };
  }

  const fodecShareEnabled = totalBase > 0 && fodecValue > 0;
  const rows: TvaBreakdownRow[] = [];
  let totalTva = 0;

  for (const [rate, baseLines] of [...grouped.entries()].sort((a, b) => a[0] - b[0])) {
    const fodecShare = fodecShareEnabled ? round3((baseLines / totalBase) * fodecValue) : 0;
    const baseWithFodec = round3(baseLines + fodecShare);
    const tva = round3((baseWithFodec * rate) / 100);
    totalTva = round3(totalTva + tva);
    rows.push({ rate, baseHt: baseWithFodec, tva });
  }

  return { rows, totalTva, totalBase: round3(totalBase + fodecValue) };
}

function getBaseUrl(assetBaseUrl?: string) {
  const explicitBaseUrl =
    assetBaseUrl ??
    (typeof window !== "undefined" ? window.location.origin : undefined) ??
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : undefined);

  return (explicitBaseUrl || "http://localhost:3000").replace(/\/+$/u, "");
}

function getBrandLogoUrl(assetBaseUrl?: string) {
  return `${getBaseUrl(assetBaseUrl)}/brand/sotec-logo.png`;
}

function baseDocumentCss() {
  return `
      * { box-sizing: border-box; }
      body { margin: 0; padding: 10px; background: #ebe3d3; color: #0f172a; font-family: "Inter", "Arial", sans-serif; }
      .page { width: 210mm; height: 297mm; margin: 0 auto; background: #ffffff; padding: 11mm 10mm; box-shadow: 0 20px 50px rgba(35, 28, 16, 0.12); display: flex; flex-direction: column; }
      .page-spacer { flex: 1 1 auto; min-height: 6mm; }
      .page > .invoice-pro-closing,
      .page > .quote-closing,
      .page > .invoice-simple-page-footer { margin-top: auto; }
      .masthead { display: grid; grid-template-columns: minmax(0,1.25fr) minmax(180px,0.75fr); gap: 10px; align-items: start; padding-bottom: 7px; border-bottom: 1px solid #d7dde5; }
      .brand-block { display: flex; gap: 9px; align-items: flex-start; min-width: 0; }
      .logo-shell { width: 46px; min-width: 46px; padding: 0; background: transparent; }
      .logo-shell img { display: block; width: 100%; height: auto; }
      .brand-name { font-size: 15px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
      .brand-subtitle { margin-top: 3px; font-size: 8.6px; font-weight: 600; color: #475569; }
      .company-meta { margin-top: 5px; font-size: 8px; line-height: 1.32; color: #475569; }
      .arabic-panel { font-size: 8px; line-height: 1.35; color: #475569; direction: rtl; text-align: right; align-self: end; unicode-bidi: isolate; }
      .arabic-panel .arabic-line { display: block; white-space: nowrap; }
      .arabic-panel .ar-label { direction: rtl; unicode-bidi: isolate; }
      .arabic-panel .ar-value { direction: ltr; unicode-bidi: isolate; display: inline-block; }
      .invoice-simple-top { display: grid; grid-template-columns: 1.08fr 0.92fr; gap: 32px; align-items: start; }
      .invoice-simple-brand { display: flex; gap: 14px; align-items: flex-start; }
      .invoice-simple-brand .logo-shell { width: 74px; min-width: 74px; }
      .invoice-simple-right { text-align: right; }
      .invoice-simple-right .document-title { margin-top: 0; font-size: 20px; }
      .invoice-simple-right .document-number { margin-top: 4px; }
      .invoice-simple-meta { margin-top: 3px; font-size: 9px; color: #475569; line-height: 1.32; }
      .invoice-simple-blocks { margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .invoice-simple-section { min-height: 42px; }
      .invoice-simple-label { font-size: 9.6px; font-weight: 700; color: #1f2937; margin-bottom: 3px; }
      .invoice-simple-copy { font-size: 8.9px; line-height: 1.32; color: #475569; }
      .invoice-simple-period { margin-top: 9px; font-size: 9.2px; line-height: 1.45; color: #334155; }
      .invoice-simple-period strong { color: #0f172a; }
      .invoice-simple-table { margin-top: 10px; }
      .invoice-simple-table thead th { background: #eef2f6; border-top: 1px solid #d7dde5; border-bottom: 1px solid #d7dde5; font-size: 10px; color: #334155; }
      .invoice-simple-table tbody td { border-bottom: 1px solid #e5e7eb; }
      .invoice-simple-totals { margin-top: 8px; display: grid; justify-content: end; }
      .invoice-simple-totals-inner { min-width: 250px; }
      .invoice-simple-total-row { display: flex; justify-content: space-between; gap: 10px; padding: 2px 0; font-size: 9.6px; color: #334155; }
      .invoice-simple-total-row strong { color: #0f172a; }
      .invoice-simple-grand { margin-top: 2px; padding-top: 5px; border-top: 1px solid #cbd5e1; font-size: 12.8px; font-weight: 800; color: #0f172a; }
      .invoice-simple-bottom { margin-top: 22px; display: grid; grid-template-columns: 1fr 1fr; gap: 34px; }
      .invoice-simple-footer { margin-top: 26px; font-size: 12px; line-height: 1.7; color: #475569; }
      .invoice-simple-page-footer { margin-top: 22px; display: flex; justify-content: space-between; gap: 20px; font-size: 8.4px; color: #94a3b8; }
      .invoice-pro-top { margin-top: 10px; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(220px, 0.85fr); gap: 12px; align-items: start; }
      .invoice-pro-title { border-bottom: 1px solid #d7dde5; padding-bottom: 8px; }
      .invoice-pro-chip { display: inline-flex; font-size: 8px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #64748b; }
      .invoice-pro-title h1 { margin: 4px 0 0; font-size: 20px; line-height: 1.05; letter-spacing: -0.02em; color: #0f172a; }
      .invoice-pro-title p { margin: 6px 0 0; font-size: 9.4px; line-height: 1.5; color: #475569; }
      .invoice-pro-meta { border: 1px solid #d7dde5; border-radius: 12px; padding: 9px 11px; background: #fbfbfa; }
      .invoice-pro-meta-row { display: flex; justify-content: space-between; gap: 10px; padding: 4px 0; border-bottom: 1px solid #e7ebf0; font-size: 10px; }
      .invoice-pro-meta-row:last-child { border-bottom: 0; }
      .invoice-pro-meta-row span { color: #64748b; font-weight: 600; }
      .invoice-pro-meta-row strong { color: #0f172a; text-align: right; font-weight: 800; }
      .invoice-pro-blocks { margin-top: 10px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
      .invoice-pro-card { border: 1px solid #d7dde5; border-radius: 12px; padding: 10px 11px; background: #ffffff; min-height: 96px; }
      .invoice-pro-card .section-title { font-size: 7.8px; letter-spacing: 0.16em; }
      .invoice-pro-card h3 { margin: 5px 0 0; font-size: 13px; line-height: 1.2; color: #0f172a; }
      .invoice-pro-card p { margin: 5px 0 0; font-size: 9.4px; line-height: 1.48; color: #475569; }
      .invoice-pro-intro { margin-top: 9px; padding: 7px 9px; border-left: 2px solid #d7dde5; background: #f8fafc; font-size: 9.6px; line-height: 1.5; color: #334155; }
      .invoice-pro-table { margin-top: 11px; }
      .invoice-pro-table thead th { padding: 6px 8px; font-size: 7.4px; letter-spacing: 0.14em; background: #eef2f6; }
      .invoice-pro-table tbody td { padding: 5px 8px; font-size: 8.8px; }
      .invoice-pro-table thead th:nth-child(1),
      .invoice-pro-table tbody td:nth-child(1) { width: auto; text-align: left; }
      .invoice-pro-table thead th:nth-child(2),
      .invoice-pro-table tbody td:nth-child(2) { width: 9%; text-align: center; }
      .invoice-pro-table thead th:nth-child(3),
      .invoice-pro-table tbody td:nth-child(3),
      .invoice-pro-table thead th:nth-child(4),
      .invoice-pro-table tbody td:nth-child(4) { width: 17%; text-align: right; }
      .invoice-pro-table tbody td:nth-child(2),
      .invoice-pro-table tbody td:nth-child(3),
      .invoice-pro-table tbody td:nth-child(4),
      .invoice-pro-table thead th:nth-child(2),
      .invoice-pro-table thead th:nth-child(3),
      .invoice-pro-table thead th:nth-child(4) { font-variant-numeric: tabular-nums; }
      .invoice-pro-notes { margin-top: 10px; padding: 8px 10px; border: 1px dashed #d7dde5; border-radius: 10px; background: #fbfaf6; }
      .invoice-pro-notes .section-title { font-size: 7.8px; letter-spacing: 0.16em; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
      .invoice-pro-notes p { margin: 0; font-size: 9.4px; line-height: 1.5; color: #334155; }
      .invoice-pro-tva-recap { margin-top: 10px; }
      .invoice-pro-tva-recap .section-title { font-size: 7.8px; letter-spacing: 0.16em; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
      .invoice-tva-table { width: 60%; border-collapse: collapse; font-size: 9.6px; }
      .invoice-tva-table thead th { background: #eef2f6; border-top: 1px solid #d7dde5; border-bottom: 1px solid #d7dde5; padding: 5px 8px; font-size: 8.4px; letter-spacing: 0.1em; text-transform: uppercase; color: #334155; text-align: right; }
      .invoice-tva-table thead th:first-child { text-align: left; }
      .invoice-tva-table tbody td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-variant-numeric: tabular-nums; }
      .invoice-tva-table tbody td:first-child { text-align: left; }
      .invoice-tva-table tr.invoice-tva-total td { font-weight: 700; background: #f8fafc; }
      .invoice-pro-summary { margin-top: 10px; display: grid; justify-content: end; }
      .invoice-pro-totals { border: 1px solid #0f172a; border-radius: 12px; padding: 8px 10px; background: #ffffff; }
      .invoice-pro-total-row { display: flex; justify-content: space-between; gap: 10px; padding: 4px 0; border-bottom: 1px solid #e2e8f0; font-size: 9.6px; }
      .invoice-pro-total-row:last-child { border-bottom: 0; }
      .invoice-pro-total-row span { color: #64748b; font-weight: 600; }
      .invoice-pro-total-row strong { color: #0f172a; font-size: 10.4px; font-variant-numeric: tabular-nums; }
      .invoice-pro-total-row.grand { padding-top: 6px; margin-top: 2px; }
      .invoice-pro-total-row.grand strong { font-size: 13px; font-weight: 800; }
      .invoice-pro-bottom { margin-top: 12px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
      .invoice-pro-footer-card { border: 1px solid #d7dde5; border-radius: 12px; padding: 9px 10px; background: #fbfbfa; min-height: 68px; }
      .invoice-pro-footer-card p { margin: 4px 0 0; font-size: 9.2px; line-height: 1.45; color: #475569; }
      .invoice-pro-closing { margin-top: 10px; border-top: 1px solid #d7dde5; padding-top: 8px; display: flex; justify-content: space-between; gap: 12px; align-items: flex-end; }
      .invoice-pro-closing-copy { font-size: 9px; line-height: 1.42; color: #334155; }
      .invoice-pro-closing-copy strong { color: #0f172a; }
      .invoice-pro-closing-meta { text-align: right; font-size: 8px; color: #94a3b8; line-height: 1.32; }
      .invoice-header-grid { display: grid; grid-template-columns: 1.2fr 0.9fr; gap: 18px; align-items: start; padding-bottom: 14px; border-bottom: 1px solid #d7dde5; }
      .invoice-rail { border: 1px solid #e3d4bd; border-radius: 22px; padding: 16px 18px; }
      .invoice-meta-grid { margin-top: 14px; display: grid; gap: 10px; }
      .invoice-meta-row { display: flex; justify-content: space-between; gap: 16px; font-size: 12px; }
      .invoice-meta-row span:first-child { color: #64748b; font-weight: 600; }
      .invoice-meta-row span:last-child { text-align: right; font-weight: 700; }
      .invoice-summary-grid { margin-top: 14px; display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 14px; }
      .pill-note { margin-top: 10px; display: inline-flex; padding: 4px 10px; border-radius: 999px; background: #f5ebdc; color: #8d6a2d; font-size: 10px; font-weight: 700; }
      .title-block { padding: 7px 0 8px; border-bottom: 1px solid #d7dde5; }
      .document-chip { display: inline-flex; align-items: center; padding: 0; color: #64748b; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
      .document-title { margin-top: 3px; font-size: 15px; font-weight: 800; letter-spacing: 0.02em; line-height: 1.14; }
      .document-number { margin-top: 2px; font-size: 8.8px; color: #64748b; }
      .status-pill { margin-top: 8px; display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 999px; background: #f1f5f9; color: #334155; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
      .meta-grid { margin-top: 14px; display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; }
      .meta-row { display: flex; justify-content: space-between; gap: 16px; font-size: 12px; }
      .meta-cell { border-top: 1px solid #e2e8f0; padding-top: 10px; }
      .meta-cell .meta-label { display: block; margin-bottom: 4px; }
      .meta-cell .meta-value { display: block; text-align: left; }
      .meta-label { color: #64748b; font-weight: 600; }
      .meta-value { text-align: right; font-weight: 700; }
      .intro-bar { margin-top: 14px; display: flex; justify-content: space-between; gap: 18px; font-size: 12px; color: #475569; }
      .section-title { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #64748b; }
      .billing-grid { margin-top: 14px; display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 14px; }
      .panel { border: 1px solid #d7dde5; padding: 14px 16px; }
      .panel h3 { margin: 8px 0 0; font-size: 18px; font-weight: 700; line-height: 1.3; }
      .panel p { margin: 8px 0 0; font-size: 12px; line-height: 1.65; color: #475569; }
      .project-note { margin-top: 10px; display: inline-flex; padding: 4px 8px; background: #f8fafc; color: #475569; font-size: 10px; font-weight: 600; }
      table { width: 100%; border-collapse: collapse; margin-top: 18px; }
      thead th { padding: 7px 8px; border-top: 1px solid #0f172a; border-bottom: 1px solid #0f172a; color: #0f172a; font-size: 8px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; text-align: left; }
      thead th:nth-child(1), tbody td:nth-child(1) { width: 14%; text-align: center; }
      thead th:nth-child(3), tbody td:nth-child(3), thead th:nth-child(4), tbody td:nth-child(4) { width: 17%; text-align: right; }
      tbody td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; font-size: 9px; vertical-align: top; }
      .designation-title { font-weight: 700; color: #1f2937; }
      .designation-sub { margin-top: 2px; color: #64748b; font-size: 8.4px; }
      .ledger-grid { margin-top: 18px; display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 14px; }
      .terms-list { margin-top: 12px; display: grid; gap: 10px; }
      .terms-row { display: flex; justify-content: space-between; gap: 14px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
      .terms-row:last-child { border-bottom: 0; padding-bottom: 0; }
      .terms-row span:first-child { color: #64748b; font-weight: 600; }
      .terms-row span:last-child { text-align: right; font-weight: 700; }
      .totals-card { border: 1px solid #0f172a; padding: 16px; }
      .totals-row { display: flex; justify-content: space-between; gap: 14px; padding: 9px 0; border-bottom: 1px solid #e2e8f0; font-size: 12.5px; }
      .totals-row:last-child { border-bottom: 0; padding-bottom: 0; }
      .totals-row strong { font-size: 20px; letter-spacing: -0.02em; color: #0f172a; }
      .totals-label { color: #64748b; font-weight: 600; }
      .totals-value { font-weight: 800; }
      .footer-note { margin-top: 16px; border-top: 1px solid #d7dde5; padding-top: 14px; font-size: 11.5px; line-height: 1.7; color: #475569; }
      .footer-note strong { color: #0f172a; }
      .quote-top { margin-top: 10px; display: grid; grid-template-columns: minmax(0, 1.32fr) minmax(205px, 0.68fr); gap: 10px; align-items: start; }
      .quote-meta { border: 1px solid #d7dde5; border-radius: 10px; padding: 8px 10px; background: #fafaf9; }
      .quote-meta-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 4px 0; border-bottom: 1px solid #e7ebf0; font-size: 10.2px; }
      .quote-meta-row:last-child { border-bottom: 0; padding-bottom: 0; }
      .quote-meta-row span { color: #64748b; font-weight: 600; }
      .quote-meta-row strong { text-align: right; color: #0f172a; font-size: 10.6px; overflow-wrap: anywhere; }
      .quote-identity-grid { margin-top: 10px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
      .quote-card { border: 1px solid #d7dde5; border-radius: 10px; padding: 9px 10px; background: #ffffff; min-width: 0; }
      .quote-card h3 { margin: 4px 0 0; font-size: 13.2px; font-weight: 700; line-height: 1.25; color: #0f172a; overflow-wrap: anywhere; }
      .quote-card p { margin: 5px 0 0; font-size: 10px; line-height: 1.45; color: #475569; overflow-wrap: anywhere; }
      .quote-card .section-title { font-size: 8px; letter-spacing: 0.16em; }
      .quote-intro { margin-top: 8px; padding: 7px 9px; border-left: 2px solid #d7dde5; background: #f8fafc; font-size: 10px; line-height: 1.45; color: #334155; }
      .quote-table { margin-top: 10px; }
      .quote-table thead th { padding: 5px 7px; font-size: 7.2px; }
      .quote-table tbody td { padding: 4px 7px; font-size: 8.4px; }
      .quote-table thead th:nth-child(1),
      .quote-table tbody td:nth-child(1) { width: auto; text-align: left; }
      .quote-table thead th:nth-child(2),
      .quote-table tbody td:nth-child(2) { width: 8%; text-align: center; }
      .quote-table thead th:nth-child(3),
      .quote-table tbody td:nth-child(3),
      .quote-table thead th:nth-child(4),
      .quote-table tbody td:nth-child(4) { width: 16%; text-align: right; }
      .quote-table tbody td:nth-child(2),
      .quote-table tbody td:nth-child(3),
      .quote-table tbody td:nth-child(4),
      .quote-table thead th:nth-child(2),
      .quote-table thead th:nth-child(3),
      .quote-table thead th:nth-child(4) { font-variant-numeric: tabular-nums; }
      .quote-table .designation-title { font-size: 8.6px; line-height: 1.25; }
      .quote-table tbody td { overflow-wrap: anywhere; }
      .quote-summary { margin-top: 8px; margin-left: auto; width: min(220px, 100%); border: 1px solid #0f172a; border-radius: 10px; padding: 7px 9px; }
      .quote-summary-row { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; border-bottom: 1px solid #e2e8f0; font-size: 9.4px; }
      .quote-summary-row:last-child { border-bottom: 0; }
      .quote-summary-row span { color: #64748b; font-weight: 600; }
      .quote-summary-row strong { color: #0f172a; font-size: 10.4px; font-variant-numeric: tabular-nums; }
      .quote-note { margin-top: 8px; border: 1px solid #d7dde5; border-radius: 10px; padding: 8px 10px; background: #f8fafc; }
      .quote-note p { margin: 5px 0 0; font-size: 9.6px; line-height: 1.45; color: #334155; overflow-wrap: anywhere; }
      .quote-tail { margin-top: 10px; display: grid; gap: 6px; }
      .quote-bottom-grid { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 8px; align-items: stretch; }
      .quote-bottom-card { border: 1px solid #d7dde5; border-radius: 10px; padding: 7px 9px; background: #f8fafc; min-height: 54px; }
      .quote-bottom-card .section-title { font-size: 7.8px; letter-spacing: 0.16em; }
      .quote-bottom-card p { margin: 4px 0 0; font-size: 9.2px; line-height: 1.4; color: #334155; overflow-wrap: anywhere; }
      .quote-closing { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; border-top: 1px solid #d7dde5; padding-top: 6px; }
      .quote-closing-copy { font-size: 8.8px; line-height: 1.35; color: #334155; }
      .quote-closing-copy strong { color: #0f172a; }
      .quote-closing-meta { text-align: right; font-size: 8px; line-height: 1.3; color: #94a3b8; }
      .quote-masthead .brand-name { font-size: 15px; }
      .quote-masthead .brand-subtitle { font-size: 9px; line-height: 1.3; }
      .quote-masthead .company-meta { font-size: 8px; line-height: 1.35; }
      .quote-masthead .arabic-panel { font-size: 8px; line-height: 1.35; }
      .quote-title-block .document-chip { font-size: 8px; }
      .quote-title-block .document-title { font-size: 18px; margin-top: 2px; }
      .quote-title-block .invoice-simple-meta { font-size: 9px; line-height: 1.35; }
      @media (max-width: 640px) {
        .masthead, .billing-grid, .ledger-grid, .meta-grid, .invoice-header-grid, .invoice-summary-grid, .invoice-simple-top, .invoice-simple-blocks, .invoice-simple-bottom, .invoice-pro-top, .invoice-pro-blocks, .invoice-pro-bottom { grid-template-columns: 1fr; }
        .quote-top, .quote-identity-grid, .quote-bottom-grid { grid-template-columns: 1fr; }
        .quote-closing, .invoice-pro-closing { flex-direction: column; align-items: flex-start; }
        .quote-closing-meta { text-align: left; }
        .invoice-pro-closing-meta { text-align: left; }
      }
      @page { size: A4 portrait; margin: 0; }
      @media print { body { padding: 0; background: white; } .page { width: 210mm; height: 297mm; padding: 10mm 9mm; box-shadow: none; page-break-after: avoid; } }
  `;
}

function renderDocumentShell(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <style>${baseDocumentCss()}</style>
  </head>
  <body>
    <div class="page">${body}</div>
  </body>
</html>`;
}

function mapInvoiceStatus(status: string) {
  return (
    {
      DRAFT: "DRAFT",
      ISSUED: "UNPAID",
      PARTIALLY_PAID: "PARTIAL",
      PAID: "PAID",
      OVERDUE: "OVERDUE",
      VOID: "VOID",
      CANCELLED: "CANCELLED",
    }[status] ?? status
  );
}

function mapQuotationStatus(status: string) {
  return (
    {
      DRAFT: "Brouillon",
      SENT: "Envoyé",
      UNDER_REVIEW: "En révision",
      ACCEPTED: "Accepté",
      REJECTED: "Refusé",
      EXPIRED: "Expiré",
      CANCELLED: "Annulé",
    }[status] ?? status
  );
}

export function renderInvoiceMarkupFromRecord(invoice: {
  number: string;
  status: string;
  issueDate: Date | string;
  dueDate?: Date | string | null;
  totalAmount: number | string;
  paidAmount: number | string;
  balanceDue: number | string;
  paymentTerms: string;
  scope: string;
  notes?: string | null;
  client: {
    displayName: string;
    code: string;
    phone?: string | null;
    email?: string | null;
    addressLine1?: string | null;
    city?: string | null;
  };
  lines: Array<{
    label: string;
    quantity: string;
    unitPrice: string;
    total: string;
    taxRate?: number | string;
    subtotalHt?: number | string;
  }>;
  settings?: {
    headerCompanyName?: string | null;
    headerCompanySubtitle?: string | null;
    headerAddressLine?: string | null;
    headerPhone?: string | null;
    headerPhoneSecondary?: string | null;
    headerRc?: string | null;
    headerTaxId?: string | null;
    headerCapital?: string | null;
    headerArabicCompanyName?: string | null;
    headerArabicAddressLine?: string | null;
    invoiceFooterConditions?: string | null;
    bankIban?: string | null;
    bankBic?: string | null;
    bankAccountHolder?: string | null;
  };
  assetBaseUrl?: string;
}) {
  const logoUrl = getBrandLogoUrl(invoice.assetBaseUrl);
  const issueDate = formatFormalDate(invoice.issueDate);
  const status = escapeHtml(mapInvoiceStatus(invoice.status));
  const scope = escapeHtml(invoice.scope || "Document commercial");
  const customerNotes = invoice.notes ? escapeHtml(invoice.notes) : "";
  const totalBaseValue = round3(toNumericValue(invoice.totalAmount));
  const fodecValue = round3(totalBaseValue * 0.01);
  const totalHtValue = round3(totalBaseValue + fodecValue);

  const tvaBreakdown = computeTvaBreakdown(invoice.lines, totalBaseValue, fodecValue);
  const tvaValue = tvaBreakdown.totalTva > 0
    ? tvaBreakdown.totalTva
    : round3(totalHtValue * 0.19);
  const timberValue = 1;
  const totalTtcValue = round3(totalHtValue + tvaValue + timberValue);
  const totalAmount = formatInvoiceTnd(totalBaseValue);
  const fodecAmount = formatInvoiceTnd(fodecValue);
  const totalHtAmount = formatInvoiceTnd(totalHtValue);
  const tvaAmount = formatInvoiceTnd(tvaValue);
  const timberAmount = formatInvoiceTnd(timberValue, { decimals: 0 });
  const totalTtcAmount = formatInvoiceTnd(totalTtcValue);
  const paidAmount = formatInvoiceTnd(invoice.paidAmount);
  const balanceDue = formatInvoiceTnd(invoice.balanceDue);
  const invoiceLines = invoice.lines.map((line) => ({
    ...line,
    unitPrice: formatInvoiceTnd(line.unitPrice),
    total: formatInvoiceTnd(line.total),
  }));
  const headerCompanyName = escapeHtml(invoice.settings?.headerCompanyName?.trim() || "SO.TE.CO");
  const headerCompanySubtitle = escapeHtml(
    invoice.settings?.headerCompanySubtitle?.trim() || "Société Tunisienne des Etudes et Constructions",
  );
  const headerAddressLine = escapeHtml(invoice.settings?.headerAddressLine?.trim() || "Cité Bouhsina, Sousse");
  const headerPhone = escapeHtml(invoice.settings?.headerPhone?.trim() || "+216 73 230 179");
  const headerPhoneSecondary = escapeHtml(invoice.settings?.headerPhoneSecondary?.trim() || "");
  const headerPhonesDisplay = headerPhoneSecondary ? `${headerPhone} / ${headerPhoneSecondary}` : headerPhone;
  const headerRc = escapeHtml(invoice.settings?.headerRc?.trim() || "B09242852018");
  const headerTaxId = escapeHtml(invoice.settings?.headerTaxId?.trim() || "1588490B/A/M/000");
  const headerCapital = escapeHtml(invoice.settings?.headerCapital?.trim() || "Capital 100 mille dinars");
  const headerArabicCompanyName = escapeHtml(
    invoice.settings?.headerArabicCompanyName?.trim() || "الشركة التونسية للدراسات و البناء",
  );
  const headerArabicAddressLine = escapeHtml(invoice.settings?.headerArabicAddressLine?.trim() || "سوسة");
  const footerConditions = escapeHtml(invoice.settings?.invoiceFooterConditions?.trim() || "");
  const bankIban = escapeHtml(invoice.settings?.bankIban?.trim() || "");
  const bankBic = escapeHtml(invoice.settings?.bankBic?.trim() || "");
  const bankAccountHolder = escapeHtml(invoice.settings?.bankAccountHolder?.trim() || "");
  const showConditions = Boolean(footerConditions);
  const showBankDetails = Boolean(bankIban || bankBic || bankAccountHolder);

  return renderDocumentShell(
    invoice.number,
    `
      <div class="masthead quote-masthead">
        <div class="brand-block">
          <div class="logo-shell"><img src="${logoUrl}" alt="SO.TE.CO" /></div>
          <div>
            <div class="brand-name">${headerCompanyName}</div>
            <div class="brand-subtitle">${headerCompanySubtitle}</div>
            <div class="company-meta">
              ${headerAddressLine}<br/>
              Tél: ${headerPhonesDisplay}<br/>
              RC: ${headerRc}<br/>
              Matricule fiscal: ${headerTaxId}<br/>
              ${headerCapital}
            </div>
          </div>
        </div>
        <div class="arabic-panel" lang="ar" dir="rtl">
          <span class="arabic-line"><span class="ar-label">${headerArabicCompanyName}</span></span>
          <span class="arabic-line"><span class="ar-label">الهاتف:</span> <span class="ar-value">${headerPhonesDisplay}</span></span>
          <span class="arabic-line"><span class="ar-label">العنوان:</span> ${headerArabicAddressLine}</span>
          <span class="arabic-line"><span class="ar-label">السجل التجاري:</span> <span class="ar-value">${headerRc}</span></span>
          <span class="arabic-line"><span class="ar-label">المعرف الجبائي:</span> <span class="ar-value">${headerTaxId}</span></span>
        </div>
      </div>

      <div class="invoice-pro-top">
        <div class="invoice-pro-title">
          <div class="invoice-pro-chip">Document comptable</div>
          <h1>Facture client</h1>
          <p>
            Facture établie pour <strong>${escapeHtml(invoice.client.displayName)}</strong> au titre du dossier
            <strong> ${scope}</strong>. Merci de reprendre la référence <strong>${escapeHtml(invoice.number)}</strong>
            dans tout échange ou règlement.
          </p>
        </div>

        <div class="invoice-pro-meta">
          <div class="invoice-pro-meta-row">
            <span>N° facture</span>
            <strong>${escapeHtml(invoice.number)}</strong>
          </div>
          <div class="invoice-pro-meta-row">
            <span>Date d'émission</span>
            <strong>${issueDate}</strong>
          </div>
          <div class="invoice-pro-meta-row">
            <span>Réf. client</span>
            <strong>${escapeHtml(invoice.client.code)}</strong>
          </div>
          <div class="invoice-pro-meta-row">
            <span>Échéance</span>
            <strong>${formatFormalDate(invoice.dueDate)}</strong>
          </div>
          <div class="invoice-pro-meta-row">
            <span>Devise</span>
            <strong>DT</strong>
          </div>
        </div>
      </div>

      <div class="invoice-pro-blocks">
        <div class="invoice-pro-card">
          <div class="section-title">Client facturé</div>
          <h3>${escapeHtml(invoice.client.displayName)}</h3>
          <p>
            Code client: ${escapeHtml(invoice.client.code)}<br/>
            Adresse: ${escapeHtml(invoice.client.addressLine1 || "-")}<br/>
            Ville: ${escapeHtml(invoice.client.city || "-")}<br/>
            Téléphone: ${escapeHtml(invoice.client.phone || "-")}<br/>
            Email: ${escapeHtml(invoice.client.email || "-")}
          </p>
        </div>

        <div class="invoice-pro-card">
          <div class="section-title">Référence dossier</div>
          <h3>${scope}</h3>
          <p>
            Statut: <strong>${status}</strong><br/>
            Société émettrice: ${headerCompanyName}<br/>
            Bureau: ${headerAddressLine}<br/>
            Contact: ${headerPhonesDisplay}<br/>
            Modalité de règlement: ${escapeHtml(invoice.paymentTerms || "Virement bancaire")}
          </p>
        </div>
      </div>

      <div class="invoice-pro-intro">
        Cette facture reprend les prestations, fournitures ou travaux validés au profit du client.
        Les montants ci-dessous sont exprimés en
        <strong>dinar tunisien (DT)</strong> et calculés selon les règles fiscales en vigueur.
      </div>

      <table class="invoice-simple-table invoice-pro-table">
        <thead>
          <tr>
            <th>Désignation</th>
            <th>Quantité</th>
            <th>Prix unitaire HT</th>
            <th>Total HT</th>
          </tr>
        </thead>
        <tbody>
          ${invoiceLines
            .map(
              (line) => `
                <tr>
                  <td><div class="designation-title">${escapeHtml(line.label)}</div></td>
                  <td>${escapeHtml(line.quantity)}</td>
                  <td>${escapeHtml(line.unitPrice)}</td>
                  <td>${escapeHtml(line.total)}</td>
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>

      ${
        tvaBreakdown.rows.length > 0
          ? `
      <div class="invoice-pro-tva-recap">
        <div class="section-title">Récapitulatif TVA</div>
        <table class="invoice-tva-table">
          <thead>
            <tr>
              <th>Base HT</th>
              <th>Taux TVA</th>
              <th>Montant TVA</th>
            </tr>
          </thead>
          <tbody>
            ${tvaBreakdown.rows
              .map(
                (row) => `
                  <tr>
                    <td>${formatInvoiceTnd(row.baseHt)}</td>
                    <td>${row.rate.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}%</td>
                    <td>${formatInvoiceTnd(row.tva)}</td>
                  </tr>`,
              )
              .join("")}
            <tr class="invoice-tva-total">
              <td>${formatInvoiceTnd(tvaBreakdown.totalBase)}</td>
              <td>Total</td>
              <td>${formatInvoiceTnd(tvaBreakdown.totalTva)}</td>
            </tr>
          </tbody>
        </table>
      </div>`
          : ""
      }

      <div class="invoice-pro-summary">
        <div class="invoice-pro-totals">
          <div class="invoice-pro-total-row"><span>Sous-total</span><strong>${totalAmount}</strong></div>
          <div class="invoice-pro-total-row"><span>Fodec 1%</span><strong>${fodecAmount}</strong></div>
          <div class="invoice-pro-total-row"><span>Total HT</span><strong>${totalHtAmount}</strong></div>
          <div class="invoice-pro-total-row"><span>${tvaBreakdown.rows.length > 1 ? "TVA (voir détail)" : "TVA"}</span><strong>${tvaAmount}</strong></div>
          <div class="invoice-pro-total-row"><span>Timbre 1 DT</span><strong>${timberAmount}</strong></div>
          <div class="invoice-pro-total-row grand"><span>Total TTC</span><strong>${totalTtcAmount}</strong></div>
        </div>
      </div>

      ${
        showConditions || showBankDetails
          ? `
      <div class="invoice-pro-bottom">
        ${
          showConditions
            ? `
        <div class="invoice-pro-footer-card">
          <div class="section-title">Conditions de facturation</div>
          <p>${footerConditions.replaceAll("\n", "<br/>")}</p>
        </div>`
            : "<div></div>"
        }
        ${
          showBankDetails
            ? `
        <div class="invoice-pro-footer-card">
          <div class="section-title">Coordonnées bancaires</div>
          <p>
            ${bankIban ? `IBAN: ${bankIban}<br/>` : ""}
            ${bankBic ? `BIC: ${bankBic}<br/>` : ""}
            ${bankAccountHolder ? `Titulaire: ${bankAccountHolder}` : ""}
          </p>
        </div>`
            : "<div></div>"
        }
      </div>`
          : ""
      }

      ${customerNotes ? `<div class="invoice-pro-notes"><div class="section-title">Notes</div><p>${customerNotes.replaceAll("\n", "<br/>")}</p></div>` : ""}

      <div class="invoice-pro-closing">
        <div class="invoice-pro-closing-copy">
          <strong>Arrêtée la présente facture à la somme de ${totalTtcAmount} TTC.</strong><br/>
          Document commercial et comptable établi par <strong>${headerCompanyName}</strong>. Merci de régler cette facture selon les délais convenus.
        </div>
        <div class="invoice-pro-closing-meta">
          <div>Facture ${escapeHtml(invoice.number)}</div>
          <div>Page 1 sur 1</div>
        </div>
      </div>
    `,
  );
}

export function renderQuotationMarkupFromRecord(quotation: {
  number: string;
  status: string;
  issueDate: Date | string;
  validUntil?: Date | string | null;
  totalAmount: number | string;
  title: string;
  requestFor?: string;
  notes?: string | null;
  client: {
    displayName: string;
    code: string;
    phone?: string | null;
    email?: string | null;
    addressLine1?: string | null;
    city?: string | null;
  };
  lines: Array<{ label: string; quantity: string; unitPrice: string; total: string }>;
  settings?: {
    headerCompanyName?: string | null;
    headerCompanySubtitle?: string | null;
    headerAddressLine?: string | null;
    headerPhone?: string | null;
    headerPhoneSecondary?: string | null;
    headerRc?: string | null;
    headerTaxId?: string | null;
    headerCapital?: string | null;
    headerArabicCompanyName?: string | null;
    headerArabicAddressLine?: string | null;
  };
  assetBaseUrl?: string;
}) {
  const logoUrl = getBrandLogoUrl(quotation.assetBaseUrl);
  const issueDate = formatFormalDate(quotation.issueDate);
  const scope = escapeHtml(quotation.title || "Devis commercial");
  const requestFor = escapeHtml(quotation.requestFor?.trim() || quotation.title || "le projet concerné");
  const note = escapeHtml(quotation.notes?.trim() || "");
  const totalBaseValue = round3(toNumericValue(quotation.totalAmount));
  const fodecValue = round3(totalBaseValue * 0.01);
  const totalHtValue = round3(totalBaseValue + fodecValue);
  const tvaValue = round3(totalHtValue * 0.19);
  const timberValue = 1;
  const totalTtcValue = round3(totalHtValue + tvaValue + timberValue);
  const totalBaseAmount = formatInvoiceTnd(totalBaseValue);
  const fodecAmount = formatInvoiceTnd(fodecValue);
  const totalHtAmount = formatInvoiceTnd(totalHtValue);
  const tvaAmount = formatInvoiceTnd(tvaValue);
  const timberAmount = formatInvoiceTnd(timberValue, { decimals: 0 });
  const totalTtcAmount = formatInvoiceTnd(totalTtcValue);
  const headerCompanyName = escapeHtml(quotation.settings?.headerCompanyName?.trim() || "SO.TE.CO");
  const headerCompanySubtitle = escapeHtml(
    quotation.settings?.headerCompanySubtitle?.trim() || "Société Tunisienne des Etudes et Constructions",
  );
  const headerAddressLine = escapeHtml(quotation.settings?.headerAddressLine?.trim() || "Cité Bouhsina, Sousse");
  const headerPhone = escapeHtml(quotation.settings?.headerPhone?.trim() || "+216 73 230 179");
  const headerPhoneSecondary = escapeHtml(quotation.settings?.headerPhoneSecondary?.trim() || "");
  const headerPhonesDisplay = headerPhoneSecondary ? `${headerPhone} / ${headerPhoneSecondary}` : headerPhone;
  const headerRc = escapeHtml(quotation.settings?.headerRc?.trim() || "B09242852018");
  const headerTaxId = escapeHtml(quotation.settings?.headerTaxId?.trim() || "1588490B/A/M/000");
  const headerCapital = escapeHtml(quotation.settings?.headerCapital?.trim() || "Capital 100 mille dinars");
  const headerArabicCompanyName = escapeHtml(
    quotation.settings?.headerArabicCompanyName?.trim() || "الشركة التونسية للدراسات و البناء",
  );
  const headerArabicAddressLine = escapeHtml(quotation.settings?.headerArabicAddressLine?.trim() || "سوسة");

  return renderDocumentShell(
    quotation.number,
    `
      <div class="masthead quote-masthead" style="padding-bottom: 5px;">
        <div class="brand-block">
          <div class="logo-shell"><img src="${logoUrl}" alt="SO.TE.CO" /></div>
          <div>
            <div class="brand-name">${headerCompanyName}</div>
            <div class="brand-subtitle">${headerCompanySubtitle}</div>
            <div class="company-meta">
              ${headerAddressLine}  |  Tél: ${headerPhonesDisplay}<br/>
              RC: ${headerRc}  |  Matricule fiscal: ${headerTaxId}  |  ${headerCapital}
            </div>
          </div>
        </div>
        <div class="arabic-panel" lang="ar" dir="rtl">
          <span class="arabic-line"><span class="ar-label">${headerArabicCompanyName}</span></span>
          <span class="arabic-line"><span class="ar-label">الهاتف:</span> <span class="ar-value">${headerPhonesDisplay}</span></span>
          <span class="arabic-line"><span class="ar-label">العنوان:</span> ${headerArabicAddressLine}</span>
        </div>
      </div>

      <div class="quote-top">
        <div class="title-block quote-title-block">
          <div class="document-chip">Devis professionnel</div>
          <div class="document-title">Devis client</div>
          <div class="invoice-simple-meta">
            Offre établie pour ${escapeHtml(quotation.client.displayName)} concernant le chantier <strong>${scope}</strong>.
          </div>
        </div>

        <div class="quote-meta">
          <div class="quote-meta-row">
            <span>N° devis</span>
            <strong>${escapeHtml(quotation.number)}</strong>
          </div>
          <div class="quote-meta-row">
            <span>Date d'émission</span>
            <strong>${issueDate}</strong>
          </div>
          <div class="quote-meta-row">
            <span>Réf. client</span>
            <strong>${escapeHtml(quotation.client.code)}</strong>
          </div>
          <div class="quote-meta-row">
            <span>Devise</span>
            <strong>DT</strong>
          </div>
        </div>
      </div>

      <div class="quote-identity-grid">
        <div class="quote-card">
          <div class="section-title">Client</div>
          <h3>${escapeHtml(quotation.client.displayName)}</h3>
          <p>
            Référence: ${escapeHtml(quotation.client.code)}<br/>
            Adresse: ${escapeHtml(quotation.client.addressLine1 || "-")}<br/>
            Ville: ${escapeHtml(quotation.client.city || "-")}<br/>
            Téléphone: ${escapeHtml(quotation.client.phone || "-")}<br/>
            Email: ${escapeHtml(quotation.client.email || "-")}
          </p>
        </div>

        <div class="quote-card">
          <div class="section-title">Projet / chantier</div>
          <h3>${scope}</h3>
          <p>
            Objet de la demande: ${requestFor}<br/>
            Société émettrice: ${headerCompanyName}<br/>
            Bureau: ${headerAddressLine}<br/>
            Contact: ${headerPhonesDisplay}
          </p>
        </div>
      </div>

      <div class="quote-intro">
        Suite à votre demande de prix pour <strong>${requestFor}</strong>, nous vous prions de trouver ci-dessous
        notre meilleure offre en <strong>dinar tunisien (DT)</strong> pour le chantier <strong>${scope}</strong>.
      </div>

      <table class="invoice-simple-table quote-table">
        <thead>
          <tr>
            <th>Désignation</th>
            <th>Quantité</th>
            <th>P.U. HT</th>
            <th>Montant H.T</th>
          </tr>
        </thead>
        <tbody>
          ${quotation.lines
            .map(
              (line) => `
                <tr>
                  <td><div class="designation-title">${escapeHtml(line.label)}</div></td>
                  <td>${escapeHtml(line.quantity)}</td>
                  <td>${escapeHtml(line.unitPrice)}</td>
                  <td>${escapeHtml(line.total)}</td>
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>

      <div class="quote-summary">
        <div class="quote-summary-row"><span>Sous-total</span><strong>${totalBaseAmount}</strong></div>
        <div class="quote-summary-row"><span>Fodec 1%</span><strong>${fodecAmount}</strong></div>
        <div class="quote-summary-row"><span>Total HT</span><strong>${totalHtAmount}</strong></div>
        <div class="quote-summary-row"><span>TVA 19%</span><strong>${tvaAmount}</strong></div>
        <div class="quote-summary-row"><span>Timbre</span><strong>${timberAmount}</strong></div>
        <div class="quote-summary-row"><span>Total TTC</span><strong>${totalTtcAmount}</strong></div>
      </div>

      <div class="quote-tail">
        <div class="quote-bottom-grid">
          <div class="quote-bottom-card">
            <div class="section-title">Observations</div>
            <p>${note ? note.replaceAll("\n", "<br/>") : "Aucune observation complémentaire."}</p>
          </div>

          <div class="quote-bottom-card">
            <div class="section-title">Conditions commerciales</div>
            <p>
              Les montants sont exprimés en dinar tunisien (DT).<br/>
              TVA calculée au taux de 19% selon la réglementation en vigueur.<br/>
              Toute confirmation doit reprendre la référence <strong>${escapeHtml(quotation.number)}</strong>.
            </p>
          </div>
        </div>

        <div class="quote-closing">
          <div class="quote-closing-copy">
            <strong>Arrêté le présent devis à la somme de ${totalTtcAmount} TTC.</strong><br/>
            Document commercial SO.TE.CO établi pour le chantier <strong>${scope}</strong>.
          </div>
          <div class="quote-closing-meta">
            <div>Document commercial SO.TE.CO</div>
            <div>Page 1 sur 1</div>
          </div>
        </div>
      </div>
    `,
  );
}
