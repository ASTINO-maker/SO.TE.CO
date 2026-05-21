import { NextResponse } from "next/server";
import { renderInvoiceMarkupFromRecord } from "../../../../../../lib/server/document-templates";
import { renderPdfBuffer } from "../../../../../../lib/server/pdf-renderer";
import { prisma } from "../../../../../../lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  invoiceFooterConditions: "documents.invoice_footer_conditions",
  bankIban: "documents.bank_iban",
  bankBic: "documents.bank_bic",
  bankAccountHolder: "documents.bank_account_holder",
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

function mapInvoiceStatus(status: string, balanceDue: unknown) {
  const remaining = decimalToNumber(balanceDue);

  if (status === "PAID") {
    return "PAID";
  }
  if (status === "PARTIALLY_PAID") {
    return "PARTIAL";
  }
  if (status === "ISSUED" && remaining > 0) {
    return "UNPAID";
  }
  if (status === "OVERDUE") {
    return "OVERDUE";
  }

  return status;
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
    invoiceFooterConditions: readString(DOCUMENT_SETTING_KEYS.invoiceFooterConditions, ""),
    bankIban: readString(DOCUMENT_SETTING_KEYS.bankIban, ""),
    bankBic: readString(DOCUMENT_SETTING_KEYS.bankBic, ""),
    bankAccountHolder: readString(DOCUMENT_SETTING_KEYS.bankAccountHolder, ""),
  };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    const invoice = await prisma.invoice.findFirst({
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

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    }

    const settings = await getDocumentSettings(invoice.tenantId);

    const markup = renderInvoiceMarkupFromRecord({
      number: invoice.number,
      status: mapInvoiceStatus(invoice.status, invoice.balanceDue),
      issueDate: formatDisplayDate(invoice.issueDate),
      dueDate: formatDisplayDate(invoice.dueDate),
      totalAmount: formatMoney(invoice.totalAmount),
      paidAmount: formatMoney(invoice.paidAmount),
      balanceDue: formatMoney(invoice.balanceDue),
      paymentTerms: "Bank transfer - 30 days",
      scope: invoice.customerNotes || invoice.internalNotes || "Invoice",
      client: {
        displayName: invoice.client.displayName,
        code: invoice.client.code,
        phone: invoice.client.phone || invoice.client.mobile || "-",
        email: invoice.client.email || "-",
        addressLine1: buildAddress(invoice.client.addressLine1, invoice.client.postalCode, invoice.client.city) || "-",
        city: invoice.client.city || "-",
      },
      lines: invoice.items.map((item) => ({
        label: item.itemName,
        quantity: decimalToNumber(item.quantity).toLocaleString("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 3,
        }),
        unitPrice: formatMoney(item.unitPrice),
        total: formatMoney(item.lineTotal),
        taxRate: decimalToNumber(item.taxRate),
        subtotalHt: decimalToNumber(item.lineSubtotal),
      })),
      settings,
      assetBaseUrl: new URL(request.url).origin,
    });

    const pdf = await renderPdfBuffer(`${invoice.number}.pdf`, markup);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Invoice PDF generation failed", error);
    return NextResponse.json({ error: "Unable to generate invoice PDF." }, { status: 500 });
  }
}
