import type { StatusOption } from "./status-menu";

// UI status (display layer). Backend stores raw enum; certain UI codes are
// derived (UNPAID/PARTIAL) — see toApiInvoiceStatus.
export type UiQuotationStatus =
  | "DRAFT"
  | "SENT"
  | "UNDER_REVIEW"
  | "ACCEPTED"
  | "REJECTED"
  | "REFUSED"
  | "EXPIRED"
  | "CANCELLED";

export type UiInvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "UNPAID"
  | "PARTIAL"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "VOID"
  | "CANCELLED";

export const QUOTATION_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  UNDER_REVIEW: "En révision",
  ACCEPTED: "Accepté",
  REJECTED: "Refusé",
  REFUSED: "Refusé",
  EXPIRED: "Expiré",
  CANCELLED: "Annulé",
};

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  ISSUED: "Émise",
  UNPAID: "Impayée",
  PARTIAL: "Partiellement payée",
  PARTIALLY_PAID: "Partiellement payée",
  PAID: "Payée",
  OVERDUE: "En retard",
  VOID: "Annulée",
  CANCELLED: "Annulée",
};

// Quotation transitions — keyed by current UI status.
const QUOTATION_TRANSITIONS: Record<string, StatusOption[]> = {
  DRAFT: [
    { value: "SENT", label: "Marquer envoyé", description: "Envoi du devis au client", tone: "positive" },
    { value: "CANCELLED", label: "Annuler", tone: "danger" },
  ],
  SENT: [
    { value: "UNDER_REVIEW", label: "En révision", description: "Le client étudie l'offre", tone: "warning" },
    { value: "ACCEPTED", label: "Marquer accepté", description: "Bon pour facturation", tone: "positive" },
    { value: "REJECTED", label: "Marquer refusé", tone: "danger" },
    { value: "EXPIRED", label: "Marquer expiré", tone: "warning" },
    { value: "DRAFT", label: "Revenir en brouillon", tone: "neutral" },
    { value: "CANCELLED", label: "Annuler", tone: "danger" },
  ],
  UNDER_REVIEW: [
    { value: "ACCEPTED", label: "Marquer accepté", tone: "positive" },
    { value: "REJECTED", label: "Marquer refusé", tone: "danger" },
    { value: "EXPIRED", label: "Marquer expiré", tone: "warning" },
    { value: "CANCELLED", label: "Annuler", tone: "danger" },
  ],
  ACCEPTED: [
    { value: "CANCELLED", label: "Annuler", tone: "danger" },
  ],
  REJECTED: [
    { value: "DRAFT", label: "Revenir en brouillon", tone: "neutral" },
    { value: "CANCELLED", label: "Annuler", tone: "danger" },
  ],
  REFUSED: [
    { value: "DRAFT", label: "Revenir en brouillon", tone: "neutral" },
    { value: "CANCELLED", label: "Annuler", tone: "danger" },
  ],
  EXPIRED: [
    { value: "SENT", label: "Renvoyer au client", tone: "positive" },
    { value: "DRAFT", label: "Revenir en brouillon", tone: "neutral" },
    { value: "CANCELLED", label: "Annuler", tone: "danger" },
  ],
  CANCELLED: [
    { value: "DRAFT", label: "Restaurer en brouillon", tone: "neutral" },
  ],
};

// Invoice transitions — keyed by current UI status.
const INVOICE_TRANSITIONS: Record<string, StatusOption[]> = {
  DRAFT: [
    { value: "ISSUED", label: "Émettre la facture", description: "Bon pour envoi au client", tone: "positive" },
    { value: "CANCELLED", label: "Annuler", tone: "danger" },
  ],
  ISSUED: [
    { value: "PARTIALLY_PAID", label: "Partiellement payée", tone: "warning" },
    { value: "PAID", label: "Marquer payée", tone: "positive" },
    { value: "OVERDUE", label: "Marquer en retard", tone: "warning" },
    { value: "VOID", label: "Annuler définitivement", description: "La facture reste tracée", tone: "danger" },
    { value: "DRAFT", label: "Repasser en brouillon", tone: "neutral" },
  ],
  UNPAID: [
    { value: "PARTIALLY_PAID", label: "Partiellement payée", tone: "warning" },
    { value: "PAID", label: "Marquer payée", tone: "positive" },
    { value: "OVERDUE", label: "Marquer en retard", tone: "warning" },
    { value: "VOID", label: "Annuler définitivement", tone: "danger" },
  ],
  PARTIAL: [
    { value: "PAID", label: "Marquer payée", tone: "positive" },
    { value: "OVERDUE", label: "Marquer en retard", tone: "warning" },
    { value: "VOID", label: "Annuler définitivement", tone: "danger" },
  ],
  PARTIALLY_PAID: [
    { value: "PAID", label: "Marquer payée", tone: "positive" },
    { value: "OVERDUE", label: "Marquer en retard", tone: "warning" },
    { value: "VOID", label: "Annuler définitivement", tone: "danger" },
  ],
  OVERDUE: [
    { value: "PAID", label: "Marquer payée", tone: "positive" },
    { value: "PARTIALLY_PAID", label: "Partiellement payée", tone: "warning" },
    { value: "VOID", label: "Annuler définitivement", tone: "danger" },
  ],
  PAID: [
    { value: "ISSUED", label: "Rouvrir comme impayée", tone: "warning" },
  ],
  VOID: [
    { value: "DRAFT", label: "Restaurer en brouillon", tone: "neutral" },
  ],
  CANCELLED: [
    { value: "DRAFT", label: "Restaurer en brouillon", tone: "neutral" },
  ],
};

export function getQuotationTransitions(current: string): StatusOption[] {
  return QUOTATION_TRANSITIONS[current] ?? [];
}

export function getInvoiceTransitions(current: string): StatusOption[] {
  return INVOICE_TRANSITIONS[current] ?? [];
}

// Map UI status → API enum value accepted by the backend.
export function toApiInvoiceStatus(status: string): string {
  if (status === "UNPAID") return "ISSUED";
  if (status === "PARTIAL") return "PARTIALLY_PAID";
  return status;
}

export function toApiQuotationStatus(status: string): string {
  if (status === "REFUSED") return "REJECTED";
  return status;
}
