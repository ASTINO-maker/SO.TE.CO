import { NextResponse } from "next/server";
import { renderQuotationMarkupFromRecord } from "../../../../../../lib/server/document-templates";
import { renderPdfBuffer } from "../../../../../../lib/server/pdf-renderer";
import { prisma } from "../../../../../../lib/server/prisma";

export const runtime = "nodejs";

const GLOBAL_SCOPE = "global";
const DOCUMENT_SETTING_KEYS = {
  headerCompanyName: "documents.header_company_name",
  headerCompanySubtitle: "documents.header_company_subtitle",
  headerAddressLine: "documents.header_address_line",
  headerPhone: "documents.header_phone",
  headerPhoneSecondary: "documents.header_phone_secondary",
  headerRc: "documents.header_rc",
  headerTaxId: "documents.header_tax_id",
  headerCapital: "documents.header_capital",
  headerArabicCompanyName: "documents.header_arabic_company_name",
  headerArabicAddressLine: "documents.header_arabic_address_line",
} as const;

function decimalToNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const numeric = Number.parseFloat(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  if (value && typeof value === "object" && "toString" in value) {
    const numeric = Number.parseFloat(String(value));
    return Number.isFinite(numeric) ? numeric : 0;
  }

  return 0;
}

function formatDisplayDate(value: Date | string | null | undefined) {
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

function formatMoney(value: unknown) {
  return `${decimalToNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })} DT`;
}

function buildAddress(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

async function getDocumentSettings(tenantId: string) {
  const entries = await prisma.setting.findMany({
    where: {
      tenantId,
      scopeKey: GLOBAL_SCOPE,
      key: {
        in: Object.values(DOCUMENT_SETTING_KEYS),
      },
      deletedAt: null,
    },
    select: {
      key: true,
      value: true,
    },
  });

  const settingsByKey = new Map(entries.map((entry) => [entry.key, entry.value]));
  const readString = (key: string, fallback: string) => {
    const rawValue = settingsByKey.get(key);
    if (typeof rawValue === "string") {
      return rawValue.trim() || fallback;
    }
    return fallback;
  };

  return {
    headerCompanyName: readString(DOCUMENT_SETTING_KEYS.headerCompanyName, "SO.TE.CO"),
    headerCompanySubtitle: readString(
      DOCUMENT_SETTING_KEYS.headerCompanySubtitle,
      "Société Tunisienne des Etudes et Constructions",
    ),
    headerAddressLine: readString(DOCUMENT_SETTING_KEYS.headerAddressLine, "Cité Bouhsina, Sousse"),
    headerPhone: readString(DOCUMENT_SETTING_KEYS.headerPhone, "+216 73 230 179"),
    headerPhoneSecondary: readString(DOCUMENT_SETTING_KEYS.headerPhoneSecondary, ""),
    headerRc: readString(DOCUMENT_SETTING_KEYS.headerRc, "B09242852018"),
    headerTaxId: readString(DOCUMENT_SETTING_KEYS.headerTaxId, "1588490B/A/M/000"),
    headerCapital: readString(DOCUMENT_SETTING_KEYS.headerCapital, "Capital 100 mille dinars"),
    headerArabicCompanyName: readString(
      DOCUMENT_SETTING_KEYS.headerArabicCompanyName,
      "الشركة التونسية للدراسات و البناء",
    ),
    headerArabicAddressLine: readString(DOCUMENT_SETTING_KEYS.headerArabicAddressLine, "سوسة"),
  };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    const quotation = await prisma.quotation.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        client: true,
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    if (!quotation) {
      return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
    }

    const settings = await getDocumentSettings(quotation.tenantId);

    const markup = renderQuotationMarkupFromRecord({
      number: quotation.number,
      status: quotation.status,
      issueDate: formatDisplayDate(quotation.issueDate),
      validUntil: formatDisplayDate(quotation.validUntil),
      totalAmount: formatMoney(quotation.totalAmount),
      title: quotation.title || quotation.reference || "Devis commercial",
      requestFor: quotation.reference || quotation.title || "le projet concerné",
      notes: quotation.clientNotes || quotation.internalNotes || "",
      client: {
        displayName: quotation.client.displayName,
        code: quotation.client.code,
        phone: quotation.client.phone || quotation.client.mobile || "-",
        email: quotation.client.email || "-",
        addressLine1: buildAddress(
          quotation.client.addressLine1,
          quotation.client.postalCode,
          quotation.client.city,
        ) || "-",
        city: quotation.client.city || "-",
      },
      lines: quotation.items.map((item) => ({
        label: item.itemName,
        quantity: decimalToNumber(item.quantity).toLocaleString("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 3,
        }),
        unitPrice: formatMoney(item.unitPrice),
        total: formatMoney(item.lineTotal),
      })),
      settings,
    });

    const pdf = await renderPdfBuffer(`${quotation.number}.pdf`, markup);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${quotation.number}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Quotation PDF generation failed", error);
    return NextResponse.json({ error: "Unable to generate quotation PDF." }, { status: 500 });
  }
}
