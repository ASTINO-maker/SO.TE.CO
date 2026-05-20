// Tunisian number / currency formatting helpers.
// Convention: space as thousands separator, comma as decimal separator,
// 3 fractional digits (millimes), "TND" suffix.

const TND_DECIMALS = 3;

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const trimmed = String(value).trim();
  if (!trimmed) return 0;
  // Accept either "1 234,567" or "1234.567"
  const normalized = trimmed.includes(",") && !trimmed.includes(".")
    ? trimmed.replace(/\s/g, "").replace(",", ".")
    : trimmed.replace(/\s/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatTndAmount(
  value: number | string | null | undefined,
  options: { decimals?: number } = {},
): string {
  const decimals = options.decimals ?? TND_DECIMALS;
  const num = toNumber(value);
  const fixed = num.toFixed(decimals);
  const [intPart = "0", fracPart] = fixed.split(".");
  const sign = intPart.startsWith("-") ? "-" : "";
  const digits = sign ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return fracPart !== undefined ? `${sign}${grouped},${fracPart}` : `${sign}${grouped}`;
}

export function formatTnd(
  value: number | string | null | undefined,
  options: { decimals?: number; suffix?: string } = {},
): string {
  const suffix = options.suffix ?? "TND";
  return `${formatTndAmount(value, options)} ${suffix}`;
}

export function formatTnQuantity(
  value: number | string | null | undefined,
  unitLabel?: string | null,
): string {
  const num = toNumber(value);
  // Strip trailing zero millimes for quantities — show up to 3 decimals but
  // collapse "1,000" -> "1" and "1,500" -> "1,5".
  const fixed = num.toFixed(TND_DECIMALS);
  const [intPart = "0", fracPart] = fixed.split(".");
  const trimmedFrac = (fracPart ?? "").replace(/0+$/, "");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const formatted = trimmedFrac ? `${grouped},${trimmedFrac}` : grouped;
  const unit = (unitLabel ?? "").trim();
  return unit ? `${formatted} ${unit}` : formatted;
}

export function parseTndInput(value: string | number | null | undefined): number {
  return toNumber(value);
}
