"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCheck, Copy, Download, Eye, Pencil, Plus, Search, Send, Trash2 } from "lucide-react";
import { formatTnd, formatTnQuantity } from "@sotec/config";
import { apiClient } from "../../lib/api/client";
import type { ApiError, PaginatedResponse } from "../../lib/api/types";
import { renderQuotationMarkupFromRecord } from "../../lib/server/document-templates";
import { cn } from "../../lib/utils";
import { buildCsvFilename, downloadCsv, rowsToCsv } from "../../lib/csv-export";
import { StatusBadge } from "../admin/status-badge";
import { FormField } from "../admin/form-field";
import {
  DocumentViewerDrawer,
  downloadPdfDocument,
  printHtmlDocument,
  type ViewerInfoRow,
  type ViewerListItem,
} from "./document-viewer-drawer";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { useConfirmDialog } from "../ui/confirm-dialog";
import { DialogShell } from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

interface QuotationClientDetails {
  contact: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  clientCode: string;
}

export interface QuotationRecord {
  id: string;
  number: string;
  client: string;
  clientDetails: QuotationClientDetails;
  date: string;
  validUntil: string;
  amount: string;
  items: number;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REFUSED" | "EXPIRED";
  scope: string;
  chantier: string;
  notes: string;
  lines: { label: string; quantity: string; unit?: string; unitPrice: string; total: string }[];
  linkedActivity: ViewerListItem[];
}

interface NewQuotationFormState {
  client: string;
  issueDate: string;
  validUntil: string;
  chantier: string;
  scope: string;
  amount: string;
  itemCount: string;
  note: string;
}

type QuotationFormErrors = Partial<Record<"client" | "lines", string>>;

type QuotationLineErrors = Record<
  string,
  Partial<Record<"description" | "unitPrice", string>>
>;

interface PersistedQuotationClient {
  name: string;
  code?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
}

interface DocumentSettings {
  headerCompanyName: string;
  headerCompanySubtitle: string;
  headerAddressLine: string;
  headerPhone: string;
  headerPhoneSecondary: string;
  headerRc: string;
  headerTaxId: string;
  headerCapital: string;
  headerArabicCompanyName: string;
  headerArabicAddressLine: string;
  invoiceFooterConditions: string;
  bankIban: string;
  bankBic: string;
  bankAccountHolder: string;
}

interface DraftQuotationPreview {
  number: string;
  status: string;
  issueDate: string;
  validUntil: string;
  client: string;
  clientDetails: QuotationClientDetails;
  chantier: string;
  scope: string;
  note: string;
  total: string;
  lines: { label: string; quantity: string; unit?: string; unitPrice: string; total: string }[];
}

function createDefaultNewQuotationForm(client = ""): NewQuotationFormState {
  return {
    client,
    issueDate: "",
    validUntil: "",
    chantier: "",
    scope: "",
    amount: "",
    itemCount: "1",
    note: "",
  };
}

function createDefaultDraftLines() {
  return [
    { id: "quotation-line-1", description: "Portee principale", quantity: "1", unit: "u", unitPrice: "6400" },
    { id: "quotation-line-2", description: "Fabrication et installation", quantity: "1", unit: "u", unitPrice: "2200" },
  ];
}

function serializeQuotationDialogState(
  form: NewQuotationFormState,
  lines: Array<{ id: string; description: string; quantity: string; unit: string; unitPrice: string }>,
  editingQuotationId: string | null,
) {
  return JSON.stringify({
    form,
    lines,
    editingQuotationId: editingQuotationId ?? "",
  });
}

function createQuotationMarkup(quotation: QuotationRecord, settings?: DocumentSettings) {
  return renderQuotationMarkupFromRecord({
    number: quotation.number,
    status: quotation.status,
    issueDate: quotation.date,
    validUntil: quotation.validUntil,
    totalAmount: parseQuotationNumber(quotation.amount),
    title: quotation.scope || quotation.chantier,
    requestFor: quotation.scope,
    notes: quotation.notes,
    client: {
      displayName: quotation.client,
      code: quotation.clientDetails.clientCode,
      phone: quotation.clientDetails.phone,
      email: quotation.clientDetails.email,
      addressLine1: quotation.clientDetails.address,
      city: quotation.clientDetails.city,
    },
    lines: quotation.lines.map((line) => ({
      ...line,
    })),
    settings,
  });
}

export function QuotationsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const action = searchParams.get("action") ?? "";
  const isNewAction = action === "new";
  const baseHref = "/sales/quotations";
  const actionHref = `${baseHref}?action=`;
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [clients, setClients] = useState<PersistedQuotationClient[]>([]);
  const [documentSettings, setDocumentSettings] = useState<DocumentSettings>({
    headerCompanyName: "",
    headerCompanySubtitle: "",
    headerAddressLine: "",
    headerPhone: "",
    headerPhoneSecondary: "",
    headerRc: "",
    headerTaxId: "",
    headerCapital: "",
    headerArabicCompanyName: "",
    headerArabicAddressLine: "",
    invoiceFooterConditions: "",
    bankIban: "",
    bankBic: "",
    bankAccountHolder: "",
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showViewer, setShowViewer] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [editingQuotationId, setEditingQuotationId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<QuotationFormErrors>({});
  const [lineErrors, setLineErrors] = useState<QuotationLineErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [newQuotationForm, setNewQuotationForm] = useState<NewQuotationFormState>(createDefaultNewQuotationForm());
  const [draftLines, setDraftLines] = useState(createDefaultDraftLines);
  const quotationDialogInitialRef = useRef<string | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  useEffect(() => {
    void Promise.all([
      apiClient.get<PaginatedResponse<QuotationRecord>>("/sales/quotations", { page: 1, pageSize: 100 }),
      apiClient.get<PaginatedResponse<PersistedQuotationClient>>("/crm/clients", { page: 1, pageSize: 100 }),
      apiClient.get<DocumentSettings>("/settings/documents"),
    ])
      .then(([quotationResponse, clientResponse, settingsResponse]) => {
        setQuotations(quotationResponse.data);
        setClients(clientResponse.data);
        setDocumentSettings(settingsResponse);
        const firstClientName = clientResponse.data[0]?.name ?? "";
        setNewQuotationForm((current) => (current.client ? current : createDefaultNewQuotationForm(firstClientName)));
        const firstQuotation = quotationResponse.data[0];
        if (firstQuotation) {
          setSelectedId((current) => current || firstQuotation.id);
        }
      })
      .catch((error) => {
        setLoadError(getApiErrorMessage(error, "Impossible de charger les devis."));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return quotations.filter((quotation) => {
      const matchesTerm =
        !term ||
        [quotation.number, quotation.client, quotation.scope, quotation.amount, quotation.chantier]
          .join(" ")
          .toLowerCase()
          .includes(term);
      const matchesStatus = statusFilter === "ALL" || quotation.status === statusFilter;
      return matchesTerm && matchesStatus;
    });
  }, [quotations, search, statusFilter]);

  const filteredIds = useMemo(() => filtered.map((quotation) => quotation.id), [filtered]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIdSet.has(id));

  const clientOptions = useMemo(() => {
    return clients.map((client) => client.name).filter(Boolean);
  }, [clients]);

  const serializedQuotationDialogState = useMemo(
    () => serializeQuotationDialogState(newQuotationForm, draftLines, editingQuotationId),
    [newQuotationForm, draftLines, editingQuotationId],
  );
  const isQuotationDialogDirty =
    showNewDialog &&
    quotationDialogInitialRef.current !== null &&
    quotationDialogInitialRef.current !== serializedQuotationDialogState;

  const selectedQuotation =
    quotations.find((quotation) => quotation.id === selectedId) ?? filtered[0] ?? quotations[0] ?? null;
  const isEditingQuotation = Boolean(editingQuotationId);

  const draftCount = quotations.filter((quotation) => quotation.status === "DRAFT").length;
  const sentCount = quotations.filter((quotation) => quotation.status === "SENT").length;
  const acceptedCount = quotations.filter((quotation) => quotation.status === "ACCEPTED").length;
  const filteredAmountTotal = filtered.reduce((sum, quotation) => sum + parseQuotationNumber(quotation.amount), 0);
  const draftTotal = draftLines.reduce(
    (sum, line) => sum + parseQuotationNumber(line.quantity) * parseQuotationNumber(line.unitPrice),
    0,
  );

  const draftPreviewQuotation = useMemo<DraftQuotationPreview>(() => {
    const clientName = newQuotationForm.client || "Sélectionner un client";
    const clientDirectory = clients.find((client) => client.name === clientName);
    const validLines = draftLines
      .map((line) => ({
        description: line.description.trim(),
        quantityValue: Math.max(1, parseQuotationNumber(line.quantity)),
        unitLabel: (line.unit ?? "").trim() || "u",
        unitPriceValue: parseQuotationNumber(line.unitPrice),
      }))
      .filter((line) => line.description);

    return {
      number: "DEVIS N° Q-2026-DRAFT",
      status: "DRAFT",
      issueDate: newQuotationForm.issueDate ? formatFormalQuotationDate(newQuotationForm.issueDate) : "À définir",
      validUntil: newQuotationForm.validUntil ? formatFormalQuotationDate(newQuotationForm.validUntil) : "À définir",
      client: clientName,
      clientDetails: buildQuotationClientDetails(clientName, clientDirectory),
      chantier: newQuotationForm.chantier.trim() || "Chantier à définir",
      scope: newQuotationForm.scope.trim() || "Portée commerciale à définir",
      note: newQuotationForm.note.trim(),
      total: formatQuotationTnd(draftTotal),
      lines: validLines.length
        ? validLines.map((line) => ({
            label: line.description,
            quantity: formatTnQuantity(line.quantityValue, line.unitLabel),
            unit: line.unitLabel,
            unitPrice: formatQuotationTnd(line.unitPriceValue),
            total: formatQuotationTnd(line.quantityValue * line.unitPriceValue),
          }))
        : [{ label: "Aucune ligne ajoutée", quantity: "-", unit: "", unitPrice: "-", total: formatQuotationTnd(0) }],
    };
  }, [clients, draftLines, draftTotal, newQuotationForm]);

  function updateDraftLine(id: string, field: "description" | "quantity" | "unit" | "unitPrice", value: string) {
    setDraftLines((current) =>
      current.map((line) => (line.id === id ? { ...line, [field]: value } : line)),
    );
    setLineErrors((current) => {
      const currentLineErrors = current[id];
      if (!currentLineErrors?.[field as "description" | "unitPrice"]) {
        return current;
      }

      const nextLineErrors = { ...currentLineErrors };
      delete nextLineErrors[field as "description" | "unitPrice"];
      return { ...current, [id]: nextLineErrors };
    });
    if (field === "description" || field === "unitPrice") {
      setFieldErrors((current) => ({ ...current, lines: undefined }));
    }
  }

  function addDraftLine() {
    setDraftLines((current) => [
      ...current,
      { id: `quotation-line-${current.length + 1}`, description: "", quantity: "1", unit: "u", unitPrice: "" },
    ]);
  }

  function removeDraftLine(id: string) {
    setDraftLines((current) => (current.length > 1 ? current.filter((line) => line.id !== id) : current));
  }

  function openViewer(quotation: QuotationRecord) {
    setSelectedId(quotation.id);
    setShowViewer(true);
  }

  function openNewQuotationDialog() {
    const nextForm = createDefaultNewQuotationForm(clientOptions[0] ?? "");
    const nextDraftLines = createDefaultDraftLines();
    setDialogError("");
    setFieldErrors({});
    setLineErrors({});
    setEditingQuotationId(null);
    setNewQuotationForm(nextForm);
    setDraftLines(nextDraftLines);
    quotationDialogInitialRef.current = serializeQuotationDialogState(nextForm, nextDraftLines, null);
    setShowNewDialog(true);
    router.replace(`${actionHref}new`, { scroll: false });
  }

  function closeNewQuotationDialog() {
    const nextForm = createDefaultNewQuotationForm(clientOptions[0] ?? "");
    const nextDraftLines = createDefaultDraftLines();
    setDialogError("");
    setFieldErrors({});
    setLineErrors({});
    setEditingQuotationId(null);
    setNewQuotationForm(nextForm);
    setDraftLines(nextDraftLines);
    setShowNewDialog(false);
    setSubmitting(false);
    quotationDialogInitialRef.current = null;
    if (isNewAction) {
      router.replace(baseHref, { scroll: false });
    }
  }

  function openEditQuotationDialog(quotation: QuotationRecord) {
    const nextForm = {
      client: quotation.client,
      issueDate: toDateInputValue(quotation.date, "2026-04-01"),
      validUntil: toDateInputValue(quotation.validUntil, "2026-05-01"),
      chantier: quotation.chantier,
      scope: quotation.scope,
      amount: String(parseQuotationNumber(quotation.amount)),
      itemCount: String(Math.max(1, quotation.items)),
      note: quotation.notes,
    };
    const nextDraftLines =
      quotation.lines.length
        ? quotation.lines.map((line, index) => ({
            id: `quotation-edit-line-${index + 1}`,
            description: line.label,
            quantity: String(parseQuotationNumber(line.quantity) || 1),
            unit: (line.unit ?? extractUnitFromQuantityLabel(line.quantity)) || "u",
            unitPrice: String(parseQuotationNumber(line.unitPrice) || 0),
          }))
        : [{ id: "quotation-edit-line-1", description: "", quantity: "1", unit: "u", unitPrice: "" }];
    setEditingQuotationId(quotation.id);
    setDialogError("");
    setFieldErrors({});
    setLineErrors({});
    setSubmitting(false);
    setNewQuotationForm(nextForm);
    setDraftLines(nextDraftLines);
    quotationDialogInitialRef.current = serializeQuotationDialogState(nextForm, nextDraftLines, quotation.id);
    setShowNewDialog(true);
    if (isNewAction) {
      router.replace(baseHref, { scroll: false });
    }
  }

  function toggleQuotationSelection(quotationId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(quotationId) ? current : [...current, quotationId];
      }

      return current.filter((id) => id !== quotationId);
    });
  }

  function toggleSelectAllQuotations(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        filteredIds.forEach((id) => next.add(id));
      } else {
        filteredIds.forEach((id) => next.delete(id));
      }
      return Array.from(next);
    });
  }

  async function handleDeleteQuotation(quotation: QuotationRecord) {
    const confirmed = await confirm({
      title: `Supprimer ${quotation.number} ?`,
      description: "Ce devis sera supprimé définitivement.",
      confirmLabel: "Supprimer le devis",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    try {
      await apiClient.del<{ success: boolean }>(`/sales/quotations/${quotation.id}`);
      setQuotations((current) => current.filter((item) => item.id !== quotation.id));
      setSelectedIds((current) => current.filter((id) => id !== quotation.id));
      if (selectedId === quotation.id) {
        setSelectedId("");
        setShowViewer(false);
      }
      setFeedback(`${quotation.number} supprimé.`);
    } catch (error) {
      setFeedback(getApiErrorMessage(error, "Impossible de supprimer le devis."));
    }
  }

  async function handleDeleteSelectedQuotations() {
    if (!selectedIds.length) {
      return;
    }

    const selectedSet = new Set(selectedIds);
    const quotationsToDelete = quotations.filter((quotation) => selectedSet.has(quotation.id));
    if (!quotationsToDelete.length) {
      setSelectedIds([]);
      return;
    }

    const confirmed = await confirm({
      title: `Supprimer ${quotationsToDelete.length} devis ?`,
      description: "Les devis sélectionnés seront supprimés définitivement.",
      confirmLabel: "Supprimer la sélection",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    const previousQuotations = quotations;
    const selectedWasDeleted = selectedId ? selectedSet.has(selectedId) : false;

    setQuotations((current) => current.filter((quotation) => !selectedSet.has(quotation.id)));
    setSelectedIds([]);
    if (selectedWasDeleted) {
      setSelectedId("");
      setShowViewer(false);
    }

    try {
      await Promise.all(
        quotationsToDelete.map((quotation) => apiClient.del<{ success: boolean }>(`/sales/quotations/${quotation.id}`)),
      );
      setFeedback(`${quotationsToDelete.length} devis supprimé${quotationsToDelete.length > 1 ? "s" : ""}.`);
    } catch (error) {
      setQuotations(previousQuotations);
      if (selectedWasDeleted && selectedId) {
        setSelectedId(selectedId);
      }
      setFeedback(getApiErrorMessage(error, "Impossible de supprimer la selection de devis."));
    }
  }

  useEffect(() => {
    if (isNewAction && !showNewDialog) {
      const nextForm = createDefaultNewQuotationForm(clientOptions[0] ?? "");
      const nextDraftLines = createDefaultDraftLines();
      setEditingQuotationId(null);
      setDialogError("");
      setFieldErrors({});
      setLineErrors({});
      setSubmitting(false);
      setNewQuotationForm(nextForm);
      setDraftLines(nextDraftLines);
      quotationDialogInitialRef.current = serializeQuotationDialogState(nextForm, nextDraftLines, null);
      setShowNewDialog(true);
      return;
    }

    if (!isNewAction && showNewDialog && !editingQuotationId) {
      setShowNewDialog(false);
      quotationDialogInitialRef.current = null;
    }
  }, [isNewAction, showNewDialog, editingQuotationId, clientOptions]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => quotations.some((quotation) => quotation.id === id)));
  }, [quotations]);

  async function handleDownload(quotation: QuotationRecord) {
    try {
      await downloadPdfDocument(quotation.number, createQuotationMarkup(quotation, documentSettings));
      setFeedback(`${quotation.number} téléchargé en PDF.`);
    } catch (error) {
      setFeedback(getApiErrorMessage(error, "Impossible de telecharger le PDF du devis."));
    }
  }

  async function handlePrint(quotation: QuotationRecord) {
    const result = await printHtmlDocument(quotation.number, createQuotationMarkup(quotation, documentSettings));
    setFeedback(result.status === "printed" ? `${quotation.number} envoyé à l'impression.` : result.message);
  }

  async function handleSend(quotation: QuotationRecord) {
    try {
      const updated = await apiClient.patch<QuotationRecord>(`/sales/quotations/${quotation.id}`, {
        status: "SENT",
      });
      setQuotations((current) =>
        current.map((item) => (item.id === quotation.id ? updated : item)),
      );
      setFeedback(`${quotation.number} marqué comme envoyé.`);
    } catch (error) {
      setFeedback(getApiErrorMessage(error, "Impossible de mettre a jour le statut du devis."));
    }
  }

  function handleExportCsv() {
    if (!filtered.length) {
      setFeedback("Aucun devis à exporter.");
      return;
    }
    const headers = [
      "Numéro",
      "Date",
      "Validité",
      "Client",
      "Chantier",
      "Objet",
      "Statut",
      "Lignes",
      "Montant",
      "Notes",
    ];
    const rows = filtered.map((quotation) => [
      quotation.number,
      quotation.date,
      quotation.validUntil,
      quotation.client,
      quotation.chantier,
      quotation.scope,
      quotation.status,
      quotation.items,
      quotation.amount,
      quotation.notes,
    ]);
    downloadCsv(buildCsvFilename("devis"), rowsToCsv(headers, rows));
    setFeedback(`${filtered.length} devis exportés en CSV.`);
  }

  function handleDuplicate(quotation: QuotationRecord) {
    const nextId = `quotation-copy-${Date.now()}`;
    const duplicate: QuotationRecord = {
      ...quotation,
      id: nextId,
      number: `Q-2026-${String(quotations.length + 140).padStart(4, "0")}`,
      date: formatQuotationDate("2026-04-01"),
      validUntil: formatQuotationDate("2026-05-01"),
      status: "DRAFT",
      notes: `Dupliqué depuis ${quotation.number}.`,
    };
    setQuotations((current) => [duplicate, ...current]);
    setSelectedId(nextId);
    setShowViewer(true);
    setFeedback(`${quotation.number} dupliqué en brouillon.`);
  }

  async function handleCreateDraft() {
    const currentEditingQuotationId = editingQuotationId;
    const existingStatus = currentEditingQuotationId
      ? quotations.find((item) => item.id === currentEditingQuotationId)?.status
      : null;
    const clientName = newQuotationForm.client.trim();
    const chantier = newQuotationForm.chantier.trim();
    const scope = newQuotationForm.scope.trim();
    const nextFieldErrors: QuotationFormErrors = {};
    const nextLineErrors: QuotationLineErrors = {};
    const normalizedLines = draftLines.map((line) => ({
        id: line.id,
        description: line.description.trim(),
        quantityValue: Math.max(1, parseQuotationNumber(line.quantity)),
        unitLabel: (line.unit ?? "").trim() || "u",
        unitPriceValue: parseQuotationNumber(line.unitPrice),
      }));
    const validLines = normalizedLines.filter((line) => line.description && line.unitPriceValue > 0);
    const amountValue = validLines.reduce((sum, line) => sum + line.quantityValue * line.unitPriceValue, 0);
    const itemCount = validLines.length;

    if (!clientName) {
      nextFieldErrors.client = "Sélectionnez un client avant de créer le devis.";
    }

    for (const line of normalizedLines) {
      const hasAnyLineInput = Boolean(line.description) || line.unitPriceValue > 0;
      if (!hasAnyLineInput) {
        continue;
      }

      if (!line.description) {
        nextLineErrors[line.id] = {
          ...nextLineErrors[line.id],
          description: "Désignation obligatoire pour cette ligne.",
        };
      }

      if (line.unitPriceValue <= 0) {
        nextLineErrors[line.id] = {
          ...nextLineErrors[line.id],
          unitPrice: "Prix obligatoire.",
        };
      }
    }

    if (amountValue <= 0 || itemCount === 0) {
      nextFieldErrors.lines = "Ajoutez au moins une ligne avec une désignation et un prix.";
      const firstLineId = draftLines[0]?.id;
      if (firstLineId && !Object.keys(nextLineErrors).length) {
        nextLineErrors[firstLineId] = {
          description: "Désignation obligatoire.",
          unitPrice: "Prix obligatoire.",
        };
      }
    }

    if (Object.keys(nextFieldErrors).length || Object.keys(nextLineErrors).length) {
      setFieldErrors(nextFieldErrors);
      setLineErrors(nextLineErrors);
      setDialogError("");
      return;
    }
    setSubmitting(true);
    setDialogError("");
    setFieldErrors({});
    setLineErrors({});

    try {
      const payload = {
        client: clientName,
        status: currentEditingQuotationId
          ? toApiQuotationStatus(existingStatus || "DRAFT")
          : "DRAFT",
        issueDate: newQuotationForm.issueDate || undefined,
        validUntil: newQuotationForm.validUntil || undefined,
        chantier: chantier || undefined,
        scope: scope || undefined,
        amount: amountValue,
        itemCount,
        lines: validLines.map((line) => ({
          description: line.description,
          quantity: line.quantityValue,
          unit: line.unitLabel,
          unitPrice: line.unitPriceValue,
        })),
        note: newQuotationForm.note.trim() || undefined,
      };
      const newQuotation = currentEditingQuotationId
        ? await apiClient.patch<QuotationRecord>(`/sales/quotations/${currentEditingQuotationId}`, payload)
        : await apiClient.post<QuotationRecord>("/sales/quotations", payload);

      setQuotations((current) =>
        currentEditingQuotationId
          ? current.map((item) => (item.id === currentEditingQuotationId ? newQuotation : item))
          : [newQuotation, ...current],
      );
      setSelectedId(newQuotation.id);
      setShowViewer(false);
      setDialogError("");
      closeNewQuotationDialog();
      setFeedback(
        currentEditingQuotationId ? `${newQuotation.number} mis à jour.` : `${newQuotation.number} créé.`,
      );
    } catch (error) {
      setDialogError(getApiErrorMessage(error, "Impossible de creer le devis."));
    } finally {
      setSubmitting(false);
    }
  }

  const viewerOverview: ViewerInfoRow[] =
    selectedQuotation
      ? [
          { label: "Client", value: selectedQuotation.client },
          { label: "Montant", value: selectedQuotation.amount, emphasis: true },
          { label: "Date", value: formatQuotationDate(selectedQuotation.date) },
          { label: "Chantier", value: selectedQuotation.chantier },
          { label: "Objet", value: selectedQuotation.scope },
        ]
      : [];

  const viewerClient: ViewerInfoRow[] =
    selectedQuotation
      ? [
          { label: "Code client", value: selectedQuotation.clientDetails.clientCode },
          { label: "Contact", value: selectedQuotation.clientDetails.contact },
          { label: "Téléphone", value: selectedQuotation.clientDetails.phone },
          { label: "Email", value: selectedQuotation.clientDetails.email },
          { label: "Adresse", value: selectedQuotation.clientDetails.address },
          { label: "Ville", value: selectedQuotation.clientDetails.city },
        ]
      : [];

  return (
    <>
      {loading ? (
        <div className="rounded-[1.75rem] border border-black/6 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Chargement des devis...
        </div>
      ) : loadError ? (
        <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
          {loadError}
        </div>
      ) : (
      <div className="grid gap-6">
        <Card className="border-[#ddd3c3] bg-white">
          <CardContent className="grid gap-5 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Bureau commercial</p>
                <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">Registre des devis</h1>
                <p className="mt-3 text-sm text-slate-500">
                  Suivi professionnel des offres clients pour une société tunisienne de construction métallique:
                  client, chantier, objet, validité, montant et état d'avancement.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={handleExportCsv}
                  disabled={!filtered.length}
                  title="Exporter la liste filtrée au format CSV"
                >
                  <Download className="h-4 w-4" />
                  Exporter CSV
                </Button>
                <Button type="button" className="rounded-2xl bg-[#2f4156] hover:bg-[#253548]" onClick={openNewQuotationDialog}>
                  <Plus className="h-4 w-4" />
                  Nouveau devis
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Brouillons", value: String(draftCount) },
                { label: "Envoyés", value: String(sentCount) },
                { label: "Acceptés", value: String(acceptedCount) },
                { label: "Valeur affichée", value: formatQuotationTnd(filteredAmountTotal) },
              ].map((item) => (
                <div key={item.label} className="rounded-[1.25rem] border border-black/6 bg-[#fcfbf8] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#ddd3c3] bg-[#fffdfa]">
          <CardContent className="grid gap-4 pt-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px_auto] lg:items-end">
              <FormField label="Recherche rapide">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-11 rounded-2xl border-black/8 bg-[#fcfbf8] pl-11 shadow-none"
                    placeholder="Numéro, client, chantier ou objet..."
                  />
                </div>
              </FormField>
              <FormField label="Filtrer par statut">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="flex h-11 w-full rounded-2xl border border-input bg-background px-3 text-sm"
                >
                  <option value="ALL">Tous les statuts</option>
                  <option value="DRAFT">Brouillon</option>
                  <option value="SENT">Envoyé</option>
                  <option value="ACCEPTED">Accepté</option>
                  <option value="REFUSED">Refusé</option>
                  <option value="EXPIRED">Expiré</option>
                </select>
              </FormField>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                  }}
                >
                  Réinitialiser
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl border-rose-200 text-rose-700 hover:bg-rose-50"
                  disabled={!selectedIds.length}
                  onClick={() => void handleDeleteSelectedQuotations()}
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer ({selectedIds.length})
                </Button>
              </div>
            </div>

            {feedback ? (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <CheckCheck className="h-4 w-4" />
                <span>{feedback}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-black/6 shadow-sm">
          <CardContent className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/6 bg-[#f8f2e8] px-5 py-4">
              <div>
                <p className="text-xl font-semibold text-slate-900">Liste des offres commerciales</p>
                <p className="mt-1 text-sm text-slate-500">Lecture claire pour consulter, corriger, envoyer et archiver les devis clients.</p>
              </div>
              <p className="text-sm text-slate-400">{filtered.length} devis</p>
            </div>

            <div className="grid grid-cols-[40px_1.1fr_1.9fr_0.9fr_0.95fr_0.9fr_220px] gap-3 border-b border-black/6 px-5 py-3 text-[13px] font-medium uppercase tracking-[0.12em] text-slate-400">
              <span className="flex items-center justify-center">
                <input
                  type="checkbox"
                  aria-label="Select all quotations"
                  checked={allFilteredSelected}
                  disabled={!filtered.length}
                  onChange={(event) => toggleSelectAllQuotations(event.target.checked)}
                  className="h-4 w-4 rounded border-black/20 accent-[#2f4156]"
                />
              </span>
              <span>Devis</span>
              <span>Client / besoin</span>
              <span>Validité</span>
              <span>Montant</span>
              <span>Statut</span>
              <span>Actions</span>
            </div>

            <div className="divide-y divide-black/6">
              {filtered.length ? filtered.map((quotation) => (
                <div
                  key={quotation.id}
                  className={cn(
                    "grid grid-cols-[40px_1.1fr_1.9fr_0.9fr_0.95fr_0.9fr_220px] items-center gap-3 px-5 py-4",
                    selectedIdSet.has(quotation.id) && "bg-[#faf7f1]",
                  )}
                >
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      aria-label={`Select quotation ${quotation.number}`}
                      checked={selectedIdSet.has(quotation.id)}
                      onChange={(event) => toggleQuotationSelection(quotation.id, event.target.checked)}
                      className="h-4 w-4 rounded border-black/20 accent-[#2f4156]"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{quotation.number}</p>
                    <p className="truncate text-xs text-slate-400">{formatQuotationDate(quotation.date)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{quotation.client}</p>
                    <p className="truncate text-xs text-slate-400">{quotation.chantier}</p>
                    <p className="truncate text-xs text-slate-400">{quotation.scope}</p>
                  </div>
                  <div className="text-sm text-slate-500">{formatQuotationDate(quotation.validUntil)}</div>
                  <div className="text-sm font-semibold text-slate-800">{quotation.amount}</div>
                  <div>
                    <StatusBadge status={quotation.status} />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="outline" className="h-9 rounded-xl px-3" onClick={() => openViewer(quotation)}>
                      <Eye className="h-4 w-4" />
                      Voir
                    </Button>
                    <Button type="button" variant="outline" className="h-9 rounded-xl px-3" onClick={() => openEditQuotationDialog(quotation)}>
                      <Pencil className="h-4 w-4" />
                      Modifier
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-xl px-3"
                      onClick={() => handleDuplicate(quotation)}
                      title="Dupliquer en nouveau brouillon"
                    >
                      <Copy className="h-4 w-4" />
                      Dupliquer
                    </Button>
                    {quotation.status !== "SENT" && quotation.status !== "ACCEPTED" ? (
                      <Button type="button" variant="outline" className="h-9 rounded-xl px-3" onClick={() => void handleSend(quotation)}>
                        <Send className="h-4 w-4" />
                        Envoyer
                      </Button>
                    ) : null}
                    <Button type="button" variant="outline" className="h-9 rounded-xl px-3" onClick={() => void handleDeleteQuotation(quotation)}>
                      <Trash2 className="h-4 w-4" />
                      Supprimer
                    </Button>
                  </div>
                </div>
              )) : (
                <div className="px-5 py-12 text-center">
                  <p className="text-base font-semibold text-slate-700">Aucun devis trouvé</p>
                  <p className="mt-2 text-sm text-slate-500">Ajustez la recherche ou le statut pour élargir la liste.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {selectedQuotation ? (
        <DocumentViewerDrawer
          open={showViewer}
          title={selectedQuotation.number}
          subtitle={`${selectedQuotation.client} • ${selectedQuotation.scope}`}
          overview={viewerOverview}
          client={viewerClient}
          related={selectedQuotation.linkedActivity}
          documentHtml={createQuotationMarkup(selectedQuotation, documentSettings)}
          onClose={() => setShowViewer(false)}
          onDownload={() => handleDownload(selectedQuotation)}
          onPrint={() => handlePrint(selectedQuotation)}
          extraActions={
            <>
              <Button type="button" variant="outline" className="rounded-2xl" onClick={() => openEditQuotationDialog(selectedQuotation)}>
                <Pencil className="h-4 w-4" />
                Modifier
              </Button>
              <Button type="button" variant="outline" className="rounded-2xl" onClick={() => handleDuplicate(selectedQuotation)}>
                <Copy className="h-4 w-4" />
                Dupliquer
              </Button>
              <Button type="button" className="rounded-2xl bg-[#2f4156] hover:bg-[#253548]" onClick={() => void handleSend(selectedQuotation)}>
                <Send className="h-4 w-4" />
                Envoyer
              </Button>
            </>
          }
        />
      ) : null}

      <DialogShell
        open={showNewDialog}
        title={isEditingQuotation ? "Modifier le devis" : "Nouveau devis"}
        description={
          isEditingQuotation
            ? "Mettez à jour les lignes et détails commerciaux du devis, puis enregistrez."
            : "Créez un brouillon de devis pour la fabrication, la livraison ou la pose."
        }
        panelClassName="max-w-[1280px] overflow-hidden p-0"
        bodyClassName="p-0"
        onClose={closeNewQuotationDialog}
        isDirty={isQuotationDialogDirty}
        dirtyWarningText="Des modifications non enregistrées seront perdues. Fermer ce formulaire ?"
      >
        <div className="grid xl:grid-cols-[1.08fr_0.62fr]">
          <div className="grid gap-5 bg-[#f8f2e6] p-6">
            {dialogError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {dialogError}
              </div>
            ) : null}

            <section className="rounded-[1.6rem] border border-black/6 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Dossier commercial</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                    {isEditingQuotation ? "Mise à jour du devis" : "Préparation d'un nouveau devis"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Préparez un devis clair pour le client: coordonnées, chantier, prestations, montant et conditions
                    de validation.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#d9cab1] bg-[#fcf8f1] px-4 py-3 text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8d6a2d]">Total estimé</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{formatQuotationTnd(draftTotal)}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Client", value: draftPreviewQuotation.client },
                  { label: "Chantier", value: draftPreviewQuotation.chantier },
                  { label: "Validité", value: draftPreviewQuotation.validUntil },
                  { label: "Lignes", value: String(draftLines.length) },
                ].map((item) => (
                  <div key={item.label} className="rounded-[1.2rem] border border-black/6 bg-[#fcfbf8] px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-800">{item.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-black/6 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-base font-semibold text-slate-800">1. Informations client</p>
                <p className="mt-1 text-sm text-slate-500">Identité du client, dates optionnelles et période de validité du devis.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <FormField label="Client / société">
                  <select
                    value={newQuotationForm.client}
                    aria-invalid={Boolean(fieldErrors.client)}
                    onChange={(event) => {
                      setNewQuotationForm((current) => ({ ...current, client: event.target.value }));
                      setFieldErrors((current) => ({ ...current, client: undefined }));
                    }}
                    className={cn(
                      "flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm",
                      fieldErrors.client && "border-rose-300 bg-rose-50 focus-visible:ring-rose-200",
                    )}
                  >
                    {clientOptions.length ? (
                      clientOptions.map((clientName) => <option key={clientName}>{clientName}</option>)
                    ) : (
                      <option value="">Aucun client disponible</option>
                    )}
                  </select>
                  {fieldErrors.client ? <p className="text-xs font-medium text-rose-600">{fieldErrors.client}</p> : null}
                </FormField>
                <FormField label="Date d'émission (optionnel)">
                  <Input
                    type="date"
                    className="h-11 rounded-xl"
                    value={newQuotationForm.issueDate}
                    onChange={(event) =>
                      setNewQuotationForm((current) => ({ ...current, issueDate: event.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Valable jusqu'au (optionnel)">
                  <Input
                    type="date"
                    className="h-11 rounded-xl"
                    value={newQuotationForm.validUntil}
                    onChange={(event) =>
                      setNewQuotationForm((current) => ({ ...current, validUntil: event.target.value }))
                    }
                  />
                </FormField>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-black/6 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-base font-semibold text-slate-800">2. Chantier et objet du devis</p>
                <p className="mt-1 text-sm text-slate-500">Décrivez le projet de construction métallique et la portée de l'offre si nécessaire.</p>
              </div>

              <div className="grid gap-4">
                <FormField label="Chantier / projet (optionnel)">
                  <Input
                    className="h-11 rounded-xl"
                    value={newQuotationForm.chantier}
                    onChange={(event) =>
                      setNewQuotationForm((current) => ({ ...current, chantier: event.target.value }))
                    }
                    placeholder="Ex: Villa Chotrana, Sidi Bou Saïd"
                  />
                </FormField>
                <FormField label="Objet du devis (optionnel)">
                  <Input
                    className="h-11 rounded-xl"
                    value={newQuotationForm.scope}
                    onChange={(event) =>
                      setNewQuotationForm((current) => ({ ...current, scope: event.target.value }))
                    }
                    placeholder="Ex: Fabrication et pose de pergola métallique avec habillage"
                  />
                </FormField>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-black/6 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-800">3. Lignes tarifaires</p>
                  <p className="text-sm text-muted-foreground">
                    Détaillez les fournitures, fabrications, poses ou transports à facturer.
                  </p>
                  {fieldErrors.lines ? <p className="mt-2 text-xs font-medium text-rose-600">{fieldErrors.lines}</p> : null}
                </div>
                <Button type="button" variant="outline" className="rounded-2xl" onClick={addDraftLine}>
                  <Plus className="h-4 w-4" />
                  Ajouter une ligne
                </Button>
              </div>

              <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-black/6 bg-[#fcfbf8]">
                <div className="grid grid-cols-[1.5fr_0.45fr_0.45fr_0.75fr_0.85fr_48px] gap-3 border-b border-black/6 bg-[#f8f1e4] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8d6a2d]">
                  <span>Désignation</span>
                  <span>Qté</span>
                  <span>Unité</span>
                  <span>Prix unitaire</span>
                  <span>Total</span>
                  <span />
                </div>
                <div className="divide-y divide-black/6">
                  {draftLines.map((line) => {
                    const lineTotal = parseQuotationNumber(line.quantity) * parseQuotationNumber(line.unitPrice);

                    return (
                      <div key={line.id} className="grid grid-cols-[1.5fr_0.45fr_0.45fr_0.75fr_0.85fr_48px] gap-3 px-4 py-3">
                        <div className="grid gap-1">
                          <Input
                            className={cn(
                              "h-11 rounded-xl",
                              lineErrors[line.id]?.description && "border-rose-300 bg-rose-50 focus-visible:ring-rose-200",
                            )}
                            aria-invalid={Boolean(lineErrors[line.id]?.description)}
                            value={line.description}
                            onChange={(event) => updateDraftLine(line.id, "description", event.target.value)}
                            placeholder="Objet / description de prestation"
                          />
                          {lineErrors[line.id]?.description ? (
                            <p className="text-xs font-medium text-rose-600">{lineErrors[line.id]?.description}</p>
                          ) : null}
                        </div>
                        <Input
                          className="h-11 rounded-xl text-center"
                          value={line.quantity}
                          onChange={(event) => updateDraftLine(line.id, "quantity", event.target.value)}
                          placeholder="1"
                        />
                        <Input
                          className="h-11 rounded-xl text-center"
                          value={line.unit}
                          onChange={(event) => updateDraftLine(line.id, "unit", event.target.value)}
                          placeholder="u, m, ml, m², kg…"
                        />
                        <div className="grid gap-1">
                          <Input
                            className={cn(
                              "h-11 rounded-xl",
                              lineErrors[line.id]?.unitPrice && "border-rose-300 bg-rose-50 focus-visible:ring-rose-200",
                            )}
                            aria-invalid={Boolean(lineErrors[line.id]?.unitPrice)}
                            value={line.unitPrice}
                            onChange={(event) => updateDraftLine(line.id, "unitPrice", event.target.value)}
                            placeholder="0"
                          />
                          {lineErrors[line.id]?.unitPrice ? (
                            <p className="text-xs font-medium text-rose-600">{lineErrors[line.id]?.unitPrice}</p>
                          ) : null}
                        </div>
                        <div className="flex h-11 items-center rounded-xl border border-black/8 bg-white px-3 text-sm font-semibold text-slate-700">
                          {formatQuotationTnd(lineTotal)}
                        </div>
                        <button
                          type="button"
                          aria-label="Supprimer la ligne"
                          onClick={() => removeDraftLine(line.id)}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/6 bg-white text-slate-500 transition-colors hover:bg-[#faf7f1] hover:text-slate-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <div className="rounded-[1.25rem] border border-[#d9cab1] bg-[linear-gradient(180deg,#fffdfa_0%,#f8f0e3_100%)] px-5 py-4 text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8d6a2d]">Total HT</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-800">{formatQuotationTnd(draftTotal)}</p>
                </div>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-black/6 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-base font-semibold text-slate-800">4. Conditions commerciales et observations</p>
                <p className="mt-1 text-sm text-slate-500">
                  Ajoutez les hypothèses, exclusions, délais de livraison, conditions de pose ou toute remarque utile.
                </p>
              </div>

              <FormField label="Conditions / observations">
                <Textarea
                  value={newQuotationForm.note}
                  onChange={(event) =>
                    setNewQuotationForm((current) => ({ ...current, note: event.target.value }))
                  }
                  placeholder="Ex: Délais de fabrication 15 jours. Transport et pose compris. Travaux hors génie civil non inclus."
                />
              </FormField>
            </section>

            <div className="flex flex-wrap gap-3 pb-6 xl:pb-0">
              <Button type="button" variant="outline" className="rounded-2xl" onClick={closeNewQuotationDialog}>
                Annuler
              </Button>
              <Button
                type="button"
                className="rounded-2xl bg-[#2f4156] hover:bg-[#253548]"
                onClick={() => void handleCreateDraft()}
                disabled={submitting || !clientOptions.length}
              >
                {submitting ? "Enregistrement..." : isEditingQuotation ? "Enregistrer les modifications" : "Créer le brouillon"}
              </Button>
            </div>
          </div>

          <aside className="border-t border-black/6 bg-[#efe5d4] p-6 xl:border-l xl:border-t-0">
            <div className="sticky top-6 grid gap-4">
              <div className="rounded-[1.5rem] border border-[#dac9aa] bg-white p-5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8d6a2d]">Bon pour accord</p>
                <h4 className="mt-2 text-xl font-semibold tracking-tight text-slate-800">{draftPreviewQuotation.number}</h4>
                <p className="mt-1 text-sm text-slate-500">
                  {formatQuotationStatusLabel(draftPreviewQuotation.status)} · {draftPreviewQuotation.issueDate}
                </p>
                <div className="mt-5 grid gap-3">
                  <div className="rounded-2xl border border-black/6 bg-[#fcfbf8] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Client</p>
                    <p className="mt-2 font-semibold text-slate-800">{draftPreviewQuotation.client}</p>
                    <p className="mt-1 text-sm text-slate-500">{draftPreviewQuotation.clientDetails.address}</p>
                    <p className="text-sm text-slate-500">{draftPreviewQuotation.clientDetails.city}</p>
                  </div>
                  <div className="rounded-2xl border border-black/6 bg-[#fcfbf8] p-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-500">Date d'émission</span>
                      <span className="font-semibold text-slate-800">{draftPreviewQuotation.issueDate}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-500">Validité</span>
                      <span className="font-semibold text-slate-800">{draftPreviewQuotation.validUntil}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-500">Chantier</span>
                      <span className="text-right font-semibold text-slate-800">{draftPreviewQuotation.chantier}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-[#dac9aa] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8d6a2d]">Récapitulatif financier</p>
                  <p className="text-sm font-semibold text-slate-800">{draftPreviewQuotation.total}</p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl border border-black/6 bg-[#fcfbf8] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Objet</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{draftPreviewQuotation.scope}</p>
                  </div>
                  <div className="rounded-2xl border border-black/6 bg-[#fcfbf8] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Contrôle avant envoi</p>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600">
                      <p>1. Vérifier le nom du client et le chantier.</p>
                      <p>2. Vérifier les quantités et prix unitaires.</p>
                      <p>3. Vérifier la date de validité et les observations.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-black/6">
                  <div className="grid grid-cols-[1.4fr_0.5fr_0.9fr_0.9fr] gap-3 bg-[#233244] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                    <span>Désignation</span>
                    <span>Qté</span>
                    <span>P.U.H.T</span>
                    <span>Montant</span>
                  </div>
                  <div className="divide-y divide-black/6 bg-[#fcfbf8]">
                    {draftPreviewQuotation.lines.slice(0, 5).map((line, index) => (
                      <div key={`${line.label}-${index}`} className="grid grid-cols-[1.4fr_0.5fr_0.9fr_0.9fr] gap-3 px-4 py-3 text-sm">
                        <span className="font-medium text-slate-800">{line.label}</span>
                        <span className="text-slate-500">{line.quantity.replace(" unit", "")}</span>
                        <span className="text-slate-500">{line.unitPrice}</span>
                        <span className="font-semibold text-slate-800">{line.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {draftPreviewQuotation.note ? (
                  <div className="mt-4 rounded-2xl border border-black/6 bg-[#fcfbf8] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Conditions / observations</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{draftPreviewQuotation.note}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </DialogShell>

      {confirmDialog}
    </>
  );
}

function getApiErrorMessage(error: unknown, fallback: string) {
  const apiError = error as ApiError | undefined;
  if (apiError?.error?.details?.length) {
    return apiError.error.details.map((detail) => detail.message).join(" ");
  }

  return apiError?.error?.message || fallback;
}

function parseQuotationNumber(value: string) {
  const sanitized = value.replace(/[^\d,.-]/g, "").trim();
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

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatQuotationTnd(value: number) {
  return formatTnd(value);
}

function extractUnitFromQuantityLabel(quantityLabel: string | undefined): string {
  if (!quantityLabel) return "";
  const match = String(quantityLabel).match(/^[\s\d.,-]+\s*(.+)$/);
  return match && match[1] ? match[1].trim() : "";
}

function formatQuotationDate(value: string) {
  if (!value) {
    return "1 avr. 2026";
  }

  const date = value.includes("-") ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatFormalQuotationDate(value: string) {
  if (!value) {
    return "01/04/2026";
  }

  const nativeDate = value.includes("-") ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(nativeDate.getTime())) {
    return value;
  }

  return nativeDate.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toDateInputValue(value: string, fallback: string) {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toApiQuotationStatus(status: QuotationRecord["status"]) {
  return status === "REFUSED" ? "REJECTED" : status;
}

function formatQuotationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Brouillon",
    SENT: "Envoyé",
    ACCEPTED: "Accepté",
    REFUSED: "Refusé",
    REJECTED: "Refusé",
    EXPIRED: "Expiré",
  };

  return labels[status] ?? status;
}

function buildQuotationClientDetails(
  clientName: string,
  clientRecord?: PersistedQuotationClient,
): QuotationClientDetails {
  if (clientRecord) {
    return {
      contact: clientRecord.contactName || clientRecord.name,
      phone: clientRecord.phone || "-",
      email: clientRecord.email || "-",
      address: clientRecord.address || "-",
      city: clientRecord.city || "-",
      clientCode: clientRecord.code || "CLI-NEW",
    };
  }

  const knownClients: Record<string, QuotationClientDetails> = {
    "SARL Construction Moderne": {
      contact: "Sami Ben Amor",
      phone: "+216 22 410 840",
      email: "contact@construction-moderne.tn",
      address: "42 Avenue des Champs, 75008 Paris",
      city: "Paris",
      clientCode: "CLI-0012",
    },
    "M. Laurent Dubois": {
      contact: "Laurent Dubois",
      phone: "+216 55 341 901",
      email: "laurent.dubois@email.fr",
      address: "15 Rue de la République, 69002 Lyon",
      city: "Lyon",
      clientCode: "CLI-0048",
    },
    "Villa Prestige SARL": {
      contact: "Rania Mhiri",
      phone: "+216 28 119 442",
      email: "info@villa-prestige.fr",
      address: "88 Boulevard Longchamp, 13001 Marseille",
      city: "Marseille",
      clientCode: "CLI-0061",
    },
    "M. Pierre Bernard": {
      contact: "Pierre Bernard",
      phone: "+216 23 988 120",
      email: "p.bernard@email.fr",
      address: "67 Rue du Commerce, 59000 Lille",
      city: "Lille",
      clientCode: "CLI-0069",
    },
    "Atlas Promotion": {
      contact: "Nour El Heni",
      phone: "+216 71 220 403",
      email: "nour@atlas-promotion.tn",
      address: "15 Rue du Lac, Les Berges du Lac",
      city: "Tunis",
      clientCode: "CLI-0048",
    },
    "Villa Les Pins": {
      contact: "Meriem Trabelsi",
      phone: "+216 26 108 940",
      email: "meriem.trabelsi@email.tn",
      address: "7 Rue des Pins, La Marsa",
      city: "La Marsa",
      clientCode: "CLI-0061",
    },
    "SARL TechnoStruct": {
      contact: "Hichem Gharsalli",
      phone: "+216 55 300 611",
      email: "contact@technostruct.tn",
      address: "Zone industrielle Nord, Tunis",
      city: "Tunis",
      clientCode: "CLI-0074",
    },
  };

  return (
    knownClients[clientName] ?? {
      contact: clientName,
      phone: "+216 00 000 000",
      email: "client@sotec.tn",
      address: "Tunisia",
      city: "Tunis",
      clientCode: "CLI-NEW",
    }
  );
}

function buildQuotationLines(scope: string, itemCount: number, totalAmount: number) {
  const lineTotal = totalAmount / itemCount;

  return Array.from({ length: itemCount }, (_, index) => ({
    label: index === 0 ? scope : `Poste complémentaire ${index + 1}`,
    quantity: "1 unit",
    unitPrice: formatQuotationTnd(lineTotal),
    total: formatQuotationTnd(lineTotal),
  }));
}
