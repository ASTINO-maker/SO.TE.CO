// Tunisian number / currency formatting helpers.
// Convention: space as thousands separator, comma as decimal separator,
// up to 3 fractional digits (millimes), "TND" suffix.

const TND_DECIMALS = 3;

function normalizeNumericText(value: string) {
  const cleaned = value
    .trim()
    .replace(/[\u00a0\u202f\s]/g, "")
    .replace(/[^\d,.*+\-]/g, "")
    .replace(/\*/g, "");

  if (!cleaned) return "";

  const commaIndex = cleaned.lastIndexOf(",");
  const dotIndex = cleaned.lastIndexOf(".");

  if (commaIndex >= 0 && dotIndex >= 0) {
    // The last separator is treated as the decimal separator; earlier separators
    // are thousands separators. This accepts both 1.234,567 and 1,234.567.
    const decimalIndex = Math.max(commaIndex, dotIndex);
    const integerPart = cleaned.slice(0, decimalIndex).replace(/[.,]/g, "");
    const fractionPart = cleaned.slice(decimalIndex + 1).replace(/[.,]/g, "");
    return fractionPart ? `${integerPart}.${fractionPart}` : integerPart;
  }

  if (commaIndex >= 0) {
    // French/Tunisian input uses a comma for decimals. Spaces are the preferred
    // thousands separator, so "1 234,500" correctly becomes 1234.5.
    const firstComma = cleaned.indexOf(",");
    if (firstComma !== commaIndex) {
      const groups = cleaned.replace(/^[+\-]/, "").split(",");
      const looksLikeThousands = groups.slice(1).every((part) => part.length === 3);
      if (looksLikeThousands) return cleaned.replace(/,/g, "");
    }
    return `${cleaned.slice(0, commaIndex).replace(/,/g, "")}.${cleaned.slice(commaIndex + 1)}`;
  }

  if (dotIndex >= 0) {
    const firstDot = cleaned.indexOf(".");
    if (firstDot !== dotIndex) {
      const groups = cleaned.replace(/^[+\-]/, "").split(".");
      const looksLikeThousands = groups.slice(1).every((part) => part.length === 3);
      if (looksLikeThousands) return cleaned.replace(/\./g, "");
    }
  }

  return cleaned;
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const normalized = normalizeNumericText(String(value));
  if (!normalized) return 0;

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function groupIntegerPart(intPart: string) {
  const sign = intPart.startsWith("-") ? "-" : intPart.startsWith("+") ? "+" : "";
  const digits = sign ? intPart.slice(1) : intPart;
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
}

export function formatTndAmount(
  value: number | string | null | undefined,
  options: { decimals?: number; trimTrailingZeros?: boolean } = {},
): string {
  const decimals = Math.max(0, Math.min(6, options.decimals ?? TND_DECIMALS));
  const num = toNumber(value);
  const zeroThreshold = 0.5 * 10 ** -decimals;
  const normalizedNum = Math.abs(num) < zeroThreshold ? 0 : num;
  const fixed = normalizedNum.toFixed(decimals);
  const [intPart = "0", fracPart = ""] = fixed.split(".");
  const grouped = groupIntegerPart(intPart);
  const fraction = options.trimTrailingZeros ? fracPart.replace(/0+$/, "") : fracPart;
  return fraction ? `${grouped},${fraction}` : grouped;
}

/** Formal accounting display. Keeps millimes by default (for example 1 234,500 TND). */
export function formatTnd(
  value: number | string | null | undefined,
  options: { decimals?: number; suffix?: string; trimTrailingZeros?: boolean } = {},
): string {
  const suffix = options.suffix ?? "TND";
  const amount = formatTndAmount(value, options);
  return suffix ? `${amount} ${suffix}` : amount;
}

/**
 * Compact operational display for cards, dashboards and list views.
 * Zero is rendered cleanly as "0 TND" while non-zero values keep only useful millimes.
 */
export function formatTndCompact(
  value: number | string | null | undefined,
  options: { suffix?: string; zeroDisplay?: string } = {},
): string {
  const num = toNumber(value);
  const suffix = options.suffix ?? "TND";

  if (Math.abs(num) < 0.0005) {
    return options.zeroDisplay ?? (suffix ? `0 ${suffix}` : "0");
  }

  return formatTnd(num, {
    decimals: TND_DECIMALS,
    suffix,
    trimTrailingZeros: true,
  });
}

export function formatTnQuantity(
  value: number | string | null | undefined,
  unitLabel?: string | null,
): string {
  const formatted = formatTndAmount(value, {
    decimals: TND_DECIMALS,
    trimTrailingZeros: true,
  });
  const unit = (unitLabel ?? "").trim();
  return unit ? `${formatted} ${unit}` : formatted;
}

export function parseTndInput(value: string | number | null | undefined): number {
  return toNumber(value);
}
