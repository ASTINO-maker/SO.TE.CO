// Lightweight CSV export helper for client-side downloads.
// Uses semicolon delimiter + UTF-8 BOM for best Excel compatibility on
// French/Tunisian locales.

const DELIMITER = ";";
const BOM = "﻿";

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (text.includes(DELIMITER) || text.includes("\n") || text.includes("\r") || text.includes('"')) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function rowsToCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.map(escapeCell).join(DELIMITER)];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(DELIMITER));
  }
  return BOM + lines.join("\r\n");
}

export function downloadCsv(filename: string, content: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.toLowerCase().endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function buildCsvFilename(prefix: string): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${prefix}-${yyyy}${mm}${dd}.csv`;
}
