"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCheck, Download, Eye, Pencil, Plus, Printer, Search, SlidersHorizontal, Trash2, Truck } from "lucide-react";
import { formatTnd, formatTnQuantity } from "@sotec/config";
import { apiClient } from "../../lib/api/client";
import type { ApiError, PaginatedResponse } from "../../lib/api/types";
import { renderInvoiceMarkupFromRecord } from "../../lib/server/document-templates";
import { cn } from "../../lib/utils";
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

interface InvoiceClientDetails {
  contact: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  clientCode: string;
}

export interface InvoiceRecord {
  id: string;
  number: string;
  client: string;
  clientDetails: InvoiceClientDetails;
  date: string;
  dueDate: string;
  amount: string;
  paid: string;
  remaining: string;
  status: "PAID" | "UNPAID" | "PARTIAL" | "OVERDUE";
  paymentTerms: string;
  scope: string;
  linkedActivity: ViewerListItem[];
  lines: { label: string; quantity: string; unit?: string; unitPrice: string; total: string }[];
  allocations: { label: string; value: string }[];
}

interface PersistedClientOption {
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

interface ProjectOption {
  id: string;
  title: string;
}

type InvoiceNoteMode = "simple" | "delivery";

interface InvoiceFormState {
  origin: "Quotation" | "Project milestone" | "Manual invoice";
  client: string;
  issueDate: string;
  dueDate: string;
  paymentTerms: string;
  noteMode: InvoiceNoteMode;
  note: string;
  deliveryProject: string;
  deliveryStatus: "PREPARED" | "IN_TRANSIT" | "DELIVERED";
  deliveryDestination: string;
  deliveryResponsible: string;
  deliveryVehicle: string;
  deliveryScheduledAt: string;
  deliveryItemsNote: string;
}

interface DeliveryNoteDraftState {
  invoiceId: string;
  invoiceNumber: string;
  client: string;
  project: string;
  status: "PREPARED" | "IN_TRANSIT" | "DELIVERED";
  destination: string;
  responsible: string;
  vehicle: string;
  scheduledAt: string;
  itemsNote: string;
}

type InvoiceFormErrors = Partial<Record<"client" | "lines" | "deliveryItemsNote", string>>;

type InvoiceLineErrors = Record<
  string,
  Partial<Record<"description" | "unitPrice", string>>
>;

type DeliveryDraftErrors = Partial<Record<"itemsNote", string>>;

function createDefaultInvoiceForm(client = "", project = ""): InvoiceFormState {
  return {
    origin: "Quotation",
    client,
    issueDate: "",
    dueDate: "",
    paymentTerms: "Virement bancaire - 30 jours",
    noteMode: "simple",
    note: "",
    deliveryProject: project,
    deliveryStatus: "PREPARED",
    deliveryDestination: "",
    deliveryResponsible: "",
    deliveryVehicle: "",
    deliveryScheduledAt: createDefaultScheduledAt(),
    deliveryItemsNote: "",
  };
}

function createEmptyDeliveryDraft(project = "", client = ""): DeliveryNoteDraftState {
  return {
    invoiceId: "",
    invoiceNumber: "",
    client,
    project,
    status: "PREPARED",
    destination: "",
    responsible: "",
    vehicle: "",
    scheduledAt: createDefaultScheduledAt(),
    itemsNote: "",
  };
}

function createDefaultInvoiceDraftLines() {
  return [
    { id: "draft-line-1", description: "Pergola fabrication", quantity: "1", unit: "u", unitPrice: "8400" },
    { id: "draft-line-2", description: "Installation", quantity: "1", unit: "u", unitPrice: "2400" },
  ];
}

function serializeInvoiceDialogState(
  form: InvoiceFormState,
  lines: Array<{ id: string; description: string; quantity: string; unit: string; unitPrice: string }>,
  editingInvoiceId: string | null,
) {
  return JSON.stringify({
    form,
    lines,
    editingInvoiceId: editingInvoiceId ?? "",
  });
}

function serializeDeliveryDialogState(form: DeliveryNoteDraftState) {
  return JSON.stringify(form);
}

function createInvoiceMarkup(invoice: InvoiceRecord, settings?: DocumentSettings) {
  return renderInvoiceMarkupFromRecord({
    number: invoice.number,
    status: invoice.status,
    issueDate: invoice.date,
    dueDate: invoice.dueDate,
    totalAmount: parseDraftNumber(invoice.amount),
    paidAmount: parseDraftNumber(invoice.paid),
    balanceDue: parseDraftNumber(invoice.remaining),
    paymentTerms: invoice.paymentTerms,
    scope: invoice.scope,
    client: {
      displayName: invoice.client,
      code: invoice.clientDetails.clientCode,
      phone: invoice.clientDetails.phone,
      email: invoice.clientDetails.email,
      addressLine1: invoice.clientDetails.address,
      city: invoice.clientDetails.city,
    },
    lines: invoice.lines,
    settings,
  });
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "success";
}) {
  return (
    <Card className="rounded-[1.35rem] border-black/6 shadow-sm">
      <CardContent className="p-5">
        <p className="text-sm text-slate-500">{label}</p>
        <p
          className={cn(
            "mt-3 text-[2rem] font-semibold leading-none text-slate-800",
            tone === "danger" && "text-[#ff3b1f]",
            tone === "success" && "text-emerald-600",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export function InvoicesWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const action = searchParams.get("action") ?? "";
  const isNewAction = action === "new";
  const baseHref = "/sales/invoices";
  const actionHref = `${baseHref}?action=`;
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [clients, setClients] = useState<PersistedClientOption[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
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
  const [showDeliveryDialog, setShowDeliveryDialog] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [deliveryDialogError, setDeliveryDialogError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<InvoiceFormErrors>({});
  const [lineErrors, setLineErrors] = useState<InvoiceLineErrors>({});
  const [deliveryFieldErrors, setDeliveryFieldErrors] = useState<DeliveryDraftErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deliverySubmitting, setDeliverySubmitting] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormState>(createDefaultInvoiceForm());
  const [deliveryForm, setDeliveryForm] = useState<DeliveryNoteDraftState>(createEmptyDeliveryDraft());
  const [draftLines, setDraftLines] = useState(createDefaultInvoiceDraftLines);
  const invoiceDialogInitialRef = useRef<string | null>(null);
  const deliveryDialogInitialRef = useRef<string | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  useEffect(() => {
    void Promise.all([
      apiClient.get<PaginatedResponse<InvoiceRecord>>("/sales/invoices", { page: 1, pageSize: 100 }),
      apiClient.get<PaginatedResponse<PersistedClientOption>>("/crm/clients", { page: 1, pageSize: 100 }),
      apiClient.get<DocumentSettings>("/settings/documents"),
      apiClient.get<PaginatedResponse<ProjectOption>>("/projects", { page: 1, pageSize: 100 }),
    ])
      .then(([invoiceResponse, clientResponse, settingsResponse, projectResponse]) => {
        setInvoices(invoiceResponse.data);
        setClients(clientResponse.data);
        setDocumentSettings(settingsResponse);
        setProjectOptions(projectResponse.data);
        const firstClientName = clientResponse.data[0]?.name ?? "";
        const firstProjectTitle = projectResponse.data[0]?.title ?? "";
        setInvoiceForm((current) => (current.client ? current : createDefaultInvoiceForm(firstClientName, firstProjectTitle)));
        setDeliveryForm((current) => (current.project || current.client ? current : createEmptyDeliveryDraft(firstProjectTitle, firstClientName)));
        const firstInvoice = invoiceResponse.data[0];
        if (firstInvoice) {
          setSelectedId((current) => current || firstInvoice.id);
        }
      })
      .catch((error) => {
        setLoadError(getApiErrorMessage(error, "Impossible de charger les factures."));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const clientOptions = useMemo(() => {
    return clients.map((client) => client.name).filter(Boolean);
  }, [clients]);

  const projectTitles = useMemo(() => {
    return projectOptions.map((project) => project.title).filter(Boolean);
  }, [projectOptions]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const matchesTerm =
        !term || [invoice.number, invoice.client, invoice.scope, invoice.amount].join(" ").toLowerCase().includes(term);
      const matchesStatus = statusFilter === "ALL" || invoice.status === statusFilter;
      return matchesTerm && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

  const filteredIds = useMemo(() => filtered.map((invoice) => invoice.id), [filtered]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIdSet.has(id));

  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedId) ?? filtered[0] ?? invoices[0] ?? null;
  const isEditingInvoice = Boolean(editingInvoiceId);
  const serializedInvoiceDialogState = useMemo(
    () => serializeInvoiceDialogState(invoiceForm, draftLines, editingInvoiceId),
    [invoiceForm, draftLines, editingInvoiceId],
  );
  const serializedDeliveryDialogState = useMemo(
    () => serializeDeliveryDialogState(deliveryForm),
    [deliveryForm],
  );
  const isInvoiceDialogDirty =
    showNewDialog &&
    invoiceDialogInitialRef.current !== null &&
    invoiceDialogInitialRef.current !== serializedInvoiceDialogState;
  const isDeliveryDialogDirty =
    showDeliveryDialog &&
    deliveryDialogInitialRef.current !== null &&
    deliveryDialogInitialRef.current !== serializedDeliveryDialogState;

  function openViewer(invoice: InvoiceRecord) {
    setSelectedId(invoice.id);
    setShowViewer(true);
  }

  function openNewInvoiceDialog() {
    const nextInvoiceForm = createDefaultInvoiceForm(clientOptions[0] ?? "", projectTitles[0] ?? "");
    const nextDraftLines = createDefaultInvoiceDraftLines();
    setEditingInvoiceId(null);
    setInvoiceForm(nextInvoiceForm);
    setDialogError("");
    setFieldErrors({});
    setLineErrors({});
    setSubmitting(false);
    setDraftLines(nextDraftLines);
    invoiceDialogInitialRef.current = serializeInvoiceDialogState(nextInvoiceForm, nextDraftLines, null);
    setShowNewDialog(true);
    router.replace(`${actionHref}new`, { scroll: false });
  }

  function closeInvoiceDialog() {
    const nextInvoiceForm = createDefaultInvoiceForm(clientOptions[0] ?? "", projectTitles[0] ?? "");
    const nextDraftLines = createDefaultInvoiceDraftLines();
    setShowNewDialog(false);
    setEditingInvoiceId(null);
    setInvoiceForm(nextInvoiceForm);
    setDialogError("");
    setFieldErrors({});
    setLineErrors({});
    setSubmitting(false);
    setDraftLines(nextDraftLines);
    invoiceDialogInitialRef.current = null;
    if (isNewAction) {
      router.replace(baseHref, { scroll: false });
    }
  }

  function openEditInvoiceDialog(invoice: InvoiceRecord) {
    const nextInvoiceForm: InvoiceFormState = {
      origin: "Manual invoice",
      client: invoice.client,
      issueDate: toDateInputValue(invoice.date, "2026-04-01"),
      dueDate: toDateInputValue(invoice.dueDate, buildInvoiceDueDate(toDateInputValue(invoice.date, "2026-04-01"))),
      paymentTerms: invoice.paymentTerms || "Virement bancaire - 30 jours",
      noteMode: "simple",
      note: invoice.scope,
      deliveryProject: projectTitles[0] ?? "",
      deliveryStatus: "PREPARED",
      deliveryDestination: "",
      deliveryResponsible: "",
      deliveryVehicle: "",
      deliveryScheduledAt: createDefaultScheduledAt(),
      deliveryItemsNote: "",
    };
    const nextDraftLines =
      invoice.lines.length
        ? invoice.lines.map((line, index) => ({
            id: `edit-line-${index + 1}`,
            description: line.label,
            quantity: String(parseDraftNumber(line.quantity) || 1),
            unit: (line.unit ?? extractInvoiceUnitFromQuantityLabel(line.quantity)) || "u",
            unitPrice: String(parseDraftNumber(line.unitPrice) || 0),
          }))
        : [{ id: "edit-line-1", description: "", quantity: "1", unit: "u", unitPrice: "" }];
    setEditingInvoiceId(invoice.id);
    setDialogError("");
    setFieldErrors({});
    setLineErrors({});
    setSubmitting(false);
    setInvoiceForm(nextInvoiceForm);
    setDraftLines(nextDraftLines);
    invoiceDialogInitialRef.current = serializeInvoiceDialogState(nextInvoiceForm, nextDraftLines, invoice.id);
    setShowNewDialog(true);
    if (isNewAction) {
      router.replace(baseHref, { scroll: false });
    }
  }

  function toggleInvoiceSelection(invoiceId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(invoiceId) ? current : [...current, invoiceId];
      }

      return current.filter((id) => id !== invoiceId);
    });
  }

  function toggleSelectAllInvoices(checked: boolean) {
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

  async function handleDeleteInvoice(invoice: InvoiceRecord) {
    const confirmed = await confirm({
      title: `Supprimer ${invoice.number} ?`,
      description: "Cette facture sera supprimée définitivement.",
      confirmLabel: "Supprimer la facture",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    try {
      await apiClient.del<{ success: boolean }>(`/sales/invoices/${invoice.id}`);
      setInvoices((current) => current.filter((item) => item.id !== invoice.id));
      setSelectedIds((current) => current.filter((id) => id !== invoice.id));
      if (selectedId === invoice.id) {
        setSelectedId("");
        setShowViewer(false);
      }
      setFeedback(`${invoice.number} supprimée.`);
    } catch (error) {
      setFeedback(getApiErrorMessage(error, "Impossible de supprimer la facture."));
    }
  }

  async function handleDeleteSelectedInvoices() {
    if (!selectedIds.length) {
      return;
    }

    const selectedSet = new Set(selectedIds);
    const invoicesToDelete = invoices.filter((invoice) => selectedSet.has(invoice.id));
    if (!invoicesToDelete.length) {
      setSelectedIds([]);
      return;
    }

    const confirmed = await confirm({
      title: `Supprimer ${invoicesToDelete.length} facture${invoicesToDelete.length > 1 ? "s" : ""} ?`,
      description: "Les factures sélectionnées seront supprimées définitivement.",
      confirmLabel: "Supprimer la sélection",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    const previousInvoices = invoices;
    const selectedWasDeleted = selectedId ? selectedSet.has(selectedId) : false;

    setInvoices((current) => current.filter((invoice) => !selectedSet.has(invoice.id)));
    setSelectedIds([]);
    if (selectedWasDeleted) {
      setSelectedId("");
      setShowViewer(false);
    }

    try {
      await Promise.all(
        invoicesToDelete.map((invoice) => apiClient.del<{ success: boolean }>(`/sales/invoices/${invoice.id}`)),
      );
      setFeedback(`${invoicesToDelete.length} facture${invoicesToDelete.length > 1 ? "s" : ""} supprimée${invoicesToDelete.length > 1 ? "s" : ""}.`);
    } catch (error) {
      setInvoices(previousInvoices);
      if (selectedWasDeleted && selectedId) {
        setSelectedId(selectedId);
      }
      setFeedback(getApiErrorMessage(error, "Impossible de supprimer la selection de factures."));
    }
  }

  async function handleDownload(invoice: InvoiceRecord) {
    try {
      await downloadPdfDocument(invoice.number, createInvoiceMarkup(invoice, documentSettings));
      setFeedback(`${invoice.number} downloaded as PDF.`);
    } catch (error) {
      setFeedback(getApiErrorMessage(error, "Impossible de telecharger le PDF de la facture."));
    }
  }

  async function handlePrint(invoice: InvoiceRecord) {
    const result = await printHtmlDocument(invoice.number, createInvoiceMarkup(invoice, documentSettings));
    setFeedback(result.status === "printed" ? `${invoice.number} sent to printer.` : result.message);
  }

  function updateDraftLine(id: string, field: "description" | "quantity" | "unit" | "unitPrice", value: string) {
    setDraftLines((current) =>
      current.map((line) => (line.id === id ? { ...line, [field]: value } : line)),
    );
    if (field === "description" || field === "unitPrice") {
      setLineErrors((current) => {
        const currentLineErrors = current[id];
        if (!currentLineErrors?.[field]) {
          return current;
        }

        const nextLineErrors = { ...currentLineErrors };
        delete nextLineErrors[field];
        return { ...current, [id]: nextLineErrors };
      });
      setFieldErrors((current) => ({ ...current, lines: undefined }));
    }
  }

  function addDraftLine() {
    setDraftLines((current) => [
      ...current,
      { id: `draft-line-${current.length + 1}`, description: "", quantity: "1", unit: "u", unitPrice: "" },
    ]);
  }

  function removeDraftLine(id: string) {
    setDraftLines((current) => (current.length > 1 ? current.filter((line) => line.id !== id) : current));
  }

  const draftTotal = draftLines.reduce(
    (sum, line) => sum + parseDraftNumber(line.quantity) * parseDraftNumber(line.unitPrice),
    0,
  );

  function resetDraftForm() {
    setInvoiceForm(createDefaultInvoiceForm(clientOptions[0] ?? "", projectTitles[0] ?? ""));
    setDialogError("");
    setFieldErrors({});
    setLineErrors({});
    setSubmitting(false);
    setEditingInvoiceId(null);
    setDraftLines(createDefaultInvoiceDraftLines());
    invoiceDialogInitialRef.current = null;
  }

  function resetDeliveryDialog() {
    setDeliveryForm(createEmptyDeliveryDraft(projectTitles[0] ?? "", clientOptions[0] ?? ""));
    setDeliveryDialogError("");
    setDeliveryFieldErrors({});
    setDeliverySubmitting(false);
    deliveryDialogInitialRef.current = null;
  }

  function closeDeliveryDialog() {
    setShowDeliveryDialog(false);
    resetDeliveryDialog();
  }

  function openDeliveryDialogFromInvoice(invoice: InvoiceRecord) {
    const nextDeliveryForm = createDeliveryDraftFromInvoice(
      invoice,
      projectTitles[0] ?? "",
      buildDeliveryItemsText(invoice.lines),
    );
    setDeliveryDialogError("");
    setDeliveryFieldErrors({});
    setDeliveryForm(nextDeliveryForm);
    deliveryDialogInitialRef.current = serializeDeliveryDialogState(nextDeliveryForm);
    setShowDeliveryDialog(true);
  }

  useEffect(() => {
    if (isNewAction && !showNewDialog) {
      const nextInvoiceForm = createDefaultInvoiceForm(clientOptions[0] ?? "", projectTitles[0] ?? "");
      const nextDraftLines = createDefaultInvoiceDraftLines();
      setEditingInvoiceId(null);
      setInvoiceForm(nextInvoiceForm);
      setDialogError("");
      setFieldErrors({});
      setLineErrors({});
      setSubmitting(false);
      setDraftLines(nextDraftLines);
      invoiceDialogInitialRef.current = serializeInvoiceDialogState(nextInvoiceForm, nextDraftLines, null);
      setShowNewDialog(true);
      return;
    }

    if (!isNewAction && showNewDialog && !editingInvoiceId) {
      setShowNewDialog(false);
      invoiceDialogInitialRef.current = null;
    }
  }, [isNewAction, showNewDialog, editingInvoiceId, clientOptions, projectTitles]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => invoices.some((invoice) => invoice.id === id)));
  }, [invoices]);

  async function createDeliveryNoteFromDraft(draft: DeliveryNoteDraftState) {
    const client = draft.client.trim();
    const project = draft.project.trim();
    const destination = draft.destination.trim();
    const responsible = draft.responsible.trim();
    const scheduledAt = draft.scheduledAt;
    const itemsNote = draft.itemsNote.trim();
    const scheduledAtDate = scheduledAt ? new Date(scheduledAt) : null;

    if (!client) {
      throw new Error("Sélectionnez un client pour le bon de livraison.");
    }

    if (!itemsNote) {
      throw new Error("Ajoutez au moins un article livré.");
    }

    if (scheduledAtDate && Number.isNaN(scheduledAtDate.getTime())) {
      throw new Error("La date prévue du bon de livraison est invalide.");
    }

    return apiClient.post<{ id: string; number: string }>("/sales/delivery-notes", {
      client,
      ...(project ? { project } : {}),
      status: draft.status,
      ...(destination ? { destination } : {}),
      ...(responsible ? { responsible } : {}),
      ...(draft.vehicle.trim() ? { vehicle: draft.vehicle.trim() } : {}),
      ...(scheduledAtDate ? { scheduledAt: scheduledAtDate.toISOString() } : {}),
      itemsNote,
    });
  }

  async function handleCreateDeliveryNoteFromInvoice() {
    const nextDeliveryFieldErrors: DeliveryDraftErrors = {};
    if (!deliveryForm.itemsNote.trim()) {
      nextDeliveryFieldErrors.itemsNote = "Ajoutez au moins un article livré.";
    }

    if (Object.keys(nextDeliveryFieldErrors).length) {
      setDeliveryFieldErrors(nextDeliveryFieldErrors);
      setDeliveryDialogError("");
      return;
    }

    setDeliveryDialogError("");
    setDeliveryFieldErrors({});
    setDeliverySubmitting(true);

    try {
      const created = await createDeliveryNoteFromDraft(deliveryForm);
      setShowDeliveryDialog(false);
      resetDeliveryDialog();
      setFeedback(
        deliveryForm.invoiceNumber
          ? `${created.number} created from ${deliveryForm.invoiceNumber}.`
          : `${created.number} created successfully.`,
      );
    } catch (error) {
      setDeliveryDialogError(getApiErrorMessage(error, "Impossible de creer le bon de livraison."));
    } finally {
      setDeliverySubmitting(false);
    }
  }

  async function handleCreateDraft(createDelivery = false) {
    const currentEditingInvoiceId = editingInvoiceId;
    const clientName = invoiceForm.client.trim();
    const issueDate = invoiceForm.issueDate;
    const dueDate = invoiceForm.dueDate;
    const paymentTerms = invoiceForm.paymentTerms.trim();
    const nextFieldErrors: InvoiceFormErrors = {};
    const nextLineErrors: InvoiceLineErrors = {};
    const normalizedLines = draftLines.map((line) => ({
        ...line,
        description: line.description.trim(),
        quantityValue: Math.max(1, parseDraftNumber(line.quantity)),
        unitLabel: (line.unit ?? "").trim() || "u",
        unitPriceValue: parseDraftNumber(line.unitPrice),
      }));
    const validLines = normalizedLines.filter((line) => line.description && line.unitPriceValue > 0);

    if (!clientName) {
      nextFieldErrors.client = "Sélectionnez un client avant de créer la facture.";
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

    if (validLines.length === 0) {
      nextFieldErrors.lines = "Ajoutez au moins une ligne avec une désignation et un prix.";
      const firstLineId = draftLines[0]?.id;
      if (firstLineId && !Object.keys(nextLineErrors).length) {
        nextLineErrors[firstLineId] = {
          description: "Désignation obligatoire.",
          unitPrice: "Prix obligatoire.",
        };
      }
    }

    if (createDelivery && invoiceForm.noteMode === "delivery" && !buildDeliveryItemsText(validLines).trim()) {
      nextFieldErrors.deliveryItemsNote = "Ajoutez au moins un article livré.";
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
      const invoiceNote =
        invoiceForm.noteMode === "simple"
          ? invoiceForm.note.trim()
          : buildDeliveryNoteSummary({
              project: invoiceForm.deliveryProject,
              status: invoiceForm.deliveryStatus,
              destination: invoiceForm.deliveryDestination,
              responsible: invoiceForm.deliveryResponsible,
              vehicle: invoiceForm.deliveryVehicle,
              scheduledAt: invoiceForm.deliveryScheduledAt,
              itemsNote: invoiceForm.deliveryItemsNote,
            });
      const payload = {
        origin: invoiceForm.origin,
        client: clientName,
        issueDate: issueDate || undefined,
        dueDate: dueDate || undefined,
        paymentTerms: paymentTerms || "Virement bancaire - 30 jours",
        note: invoiceNote || undefined,
        lines: validLines.map((line) => ({
          description: line.description,
          quantity: line.quantityValue,
          unit: line.unitLabel,
          unitPrice: line.unitPriceValue,
        })),
      };
      const newInvoice = currentEditingInvoiceId
        ? await apiClient.patch<InvoiceRecord>(`/sales/invoices/${currentEditingInvoiceId}`, payload)
        : await apiClient.post<InvoiceRecord>("/sales/invoices", payload);

      let createdDeliveryNumber = "";
      if (createDelivery) {
        const createdDelivery = await createDeliveryNoteFromDraft({
          invoiceId: newInvoice.id,
          invoiceNumber: newInvoice.number,
          client: clientName,
          project: invoiceForm.deliveryProject,
          status: invoiceForm.deliveryStatus,
          destination: invoiceForm.deliveryDestination,
          responsible: invoiceForm.deliveryResponsible,
          vehicle: invoiceForm.deliveryVehicle,
          scheduledAt: invoiceForm.deliveryScheduledAt,
          itemsNote: invoiceForm.deliveryItemsNote.trim() || buildDeliveryItemsText(validLines),
        });
        createdDeliveryNumber = createdDelivery.number;
      }

      setInvoices((current) =>
        currentEditingInvoiceId
          ? current.map((item) => (item.id === currentEditingInvoiceId ? newInvoice : item))
          : [newInvoice, ...current],
      );
      setSelectedId(newInvoice.id);
      closeInvoiceDialog();
      setFeedback(
        currentEditingInvoiceId
          ? `${newInvoice.number} mise à jour avec succès.`
          : createdDeliveryNumber
            ? `${newInvoice.number} créée et ${createdDeliveryNumber} généré.`
            : `${newInvoice.number} créée et enregistrée.`,
      );
    } catch (error) {
      setDialogError(getApiErrorMessage(error, "Impossible de creer la facture."));
    } finally {
      setSubmitting(false);
    }
  }

  const totalUnpaid = invoices
    .filter((invoice) => !isZeroAmount(invoice.remaining))
    .reduce((sum, invoice) => sum + parseDraftNumber(invoice.remaining), 0);
  const totalOverdue = invoices
    .filter((invoice) => invoice.status === "OVERDUE")
    .reduce((sum, invoice) => sum + parseDraftNumber(invoice.remaining), 0);
  const totalPaidThisMonth = invoices.reduce((sum, invoice) => sum + parseDraftNumber(invoice.paid), 0);
  const openInvoicesCount = invoices.filter((invoice) => !isZeroAmount(invoice.remaining)).length;

  const viewerOverview: ViewerInfoRow[] =
    selectedInvoice
      ? [
          { label: "Client", value: selectedInvoice.client },
          { label: "Montant", value: formatInvoiceAmount(selectedInvoice.amount) },
          { label: "Réglé", value: formatInvoiceAmount(selectedInvoice.paid) },
          { label: "Reste", value: formatInvoiceAmount(selectedInvoice.remaining), emphasis: !isZeroAmount(selectedInvoice.remaining) },
          { label: "Date d'émission", value: formatInvoiceDate(selectedInvoice.date) },
          { label: "Échéance", value: formatInvoiceDate(selectedInvoice.dueDate) },
        ]
      : [];

  const viewerClient: ViewerInfoRow[] =
    selectedInvoice
      ? [
          { label: "Code client", value: selectedInvoice.clientDetails.clientCode },
          { label: "Contact", value: selectedInvoice.clientDetails.contact },
          { label: "Téléphone", value: selectedInvoice.clientDetails.phone },
          { label: "Email", value: selectedInvoice.clientDetails.email },
          { label: "Adresse", value: selectedInvoice.clientDetails.address },
          { label: "Règlement", value: selectedInvoice.paymentTerms },
        ]
      : [];

  return (
    <>
      {loading ? (
        <div className="rounded-[1.75rem] border border-black/6 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Chargement des factures...
        </div>
      ) : loadError ? (
        <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
          {loadError}
        </div>
      ) : (
        <div className="grid gap-6">
          <section className="rounded-[1.75rem] border border-black/6 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8d6a2d]">
                  Ventes et facturation
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Registre des factures</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  Une vue simple pour suivre les factures émises, les montants encaissés et les dossiers qui doivent être relancés.
                </p>
              </div>
              <Button type="button" className="rounded-2xl bg-[#2f4156] hover:bg-[#253548]" onClick={openNewInvoiceDialog}>
                <Plus className="h-4 w-4" />
                Nouvelle facture
              </Button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="À encaisser" value={formatDraftTnd(totalUnpaid)} tone="danger" />
              <SummaryCard label="En retard" value={formatDraftTnd(totalOverdue)} tone="danger" />
              <SummaryCard label="Encaissé" value={formatDraftTnd(totalPaidThisMonth)} tone="success" />
              <SummaryCard label="Factures ouvertes" value={String(openInvoicesCount)} />
            </div>

            <div className="mt-5 rounded-[1.35rem] border border-black/6 bg-[#fcfbf8] px-4 py-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">Lecture rapide</p>
              <p className="mt-1">
                Le gérant doit voir immédiatement ce qui reste à encaisser, ce qui est en retard, puis ouvrir ou modifier la facture concernée.
              </p>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-black/6 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">Liste des factures</p>
                <p className="mt-1 text-sm text-slate-500">Recherche, sélection multiple, impression et création de bon de livraison.</p>
              </div>
              <div className="text-sm text-slate-500">{filtered.length} facture(s)</div>
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 rounded-2xl border-black/8 bg-[#fcfbf8] pl-11 shadow-none"
                placeholder="Rechercher des factures..."
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-black/8 bg-[#fcfbf8] px-4">
                <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-11 bg-transparent text-sm text-slate-700 outline-none"
                >
                  <option value="ALL">Tous les statuts</option>
                  <option value="PAID">Payée</option>
                  <option value="UNPAID">Impayée</option>
                  <option value="PARTIAL">Partielle</option>
                  <option value="OVERDUE">En retard</option>
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-2xl border-rose-200 text-rose-700 hover:bg-rose-50"
                disabled={!selectedIds.length}
                onClick={() => void handleDeleteSelectedInvoices()}
              >
                <Trash2 className="h-4 w-4" />
                Supprimer ({selectedIds.length})
              </Button>
            </div>
          </div>

          {feedback ? (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCheck className="h-4 w-4" />
              <span>{feedback}</span>
            </div>
          ) : null}
          </section>

          <Card className="rounded-[1.75rem] border-black/6 shadow-sm">
            <CardContent className="overflow-hidden p-0">
              <div className="grid grid-cols-[40px_1.15fr_1.7fr_0.95fr_0.95fr_0.85fr_0.85fr_0.95fr_0.85fr_164px] gap-3 border-b border-black/6 px-5 py-3 text-[13px] font-medium text-slate-500">
              <span className="flex items-center justify-center">
                <input
                  type="checkbox"
                  aria-label="Select all invoices"
                  checked={allFilteredSelected}
                  disabled={!filtered.length}
                  onChange={(event) => toggleSelectAllInvoices(event.target.checked)}
                  className="h-4 w-4 rounded border-black/20 accent-[#2f4156]"
                />
              </span>
              <span>Facture</span>
              <span>Client / chantier</span>
              <span>Émission</span>
              <span>Échéance</span>
              <span>Montant</span>
              <span>Réglé</span>
              <span>Reste</span>
              <span>Statut</span>
              <span className="text-right">Actions</span>
              </div>

              <div className="divide-y divide-black/6">
                {filtered.length ? filtered.map((invoice) => (
                <div
                  key={invoice.id}
                  className={cn(
                    "grid grid-cols-[40px_1.15fr_1.7fr_0.95fr_0.95fr_0.85fr_0.85fr_0.95fr_0.85fr_164px] items-center gap-3 px-5 py-3.5",
                    selectedIdSet.has(invoice.id) && "bg-[#faf7f1]",
                  )}
                >
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      aria-label={`Select invoice ${invoice.number}`}
                      checked={selectedIdSet.has(invoice.id)}
                      onChange={(event) => toggleInvoiceSelection(invoice.id, event.target.checked)}
                      className="h-4 w-4 rounded border-black/20 accent-[#2f4156]"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{invoice.number}</p>
                    <p className="truncate text-xs text-slate-400">{invoice.scope}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{invoice.client}</p>
                    <p className="truncate text-xs text-slate-400">{invoice.clientDetails.city || "Tunisie"}</p>
                  </div>
                  <div className="text-sm text-slate-500">{formatInvoiceDate(invoice.date)}</div>
                  <div className={cn("text-sm text-slate-500", invoice.status === "OVERDUE" && "font-medium text-[#ff3b1f]")}>
                    {formatInvoiceDate(invoice.dueDate)}
                  </div>
                  <div className="text-sm font-semibold text-slate-800">{formatInvoiceAmount(invoice.amount)}</div>
                  <div className="text-sm font-medium text-emerald-600">{formatInvoiceAmount(invoice.paid)}</div>
                  <div className={cn("text-sm font-medium", isZeroAmount(invoice.remaining) ? "text-slate-500" : "text-[#ff5b21]")}>
                    {formatInvoiceAmount(invoice.remaining)}
                  </div>
                  <div>
                    <StatusBadge status={invoice.status} />
                  </div>
                  <div className="flex justify-end">
                    <ActionGroup>
                      <ActionIcon label="Voir la facture" onClick={() => openViewer(invoice)}>
                        <Eye className="h-4 w-4" />
                      </ActionIcon>
                      <ActionIcon label="Imprimer la facture" onClick={() => handlePrint(invoice)}>
                        <Printer className="h-4 w-4" />
                      </ActionIcon>
                      <ActionIcon label="Télécharger la facture" onClick={() => handleDownload(invoice)}>
                        <Download className="h-4 w-4" />
                      </ActionIcon>
                      <ActionIcon label="Créer un bon de livraison" onClick={() => openDeliveryDialogFromInvoice(invoice)}>
                        <Truck className="h-4 w-4" />
                      </ActionIcon>
                      <ActionIcon label="Modifier la facture" onClick={() => openEditInvoiceDialog(invoice)}>
                        <Pencil className="h-4 w-4" />
                      </ActionIcon>
                      <ActionIcon label="Supprimer la facture" onClick={() => void handleDeleteInvoice(invoice)}>
                        <Trash2 className="h-4 w-4" />
                      </ActionIcon>
                    </ActionGroup>
                  </div>
                </div>
                )) : (
                  <div className="px-5 py-10 text-center text-sm text-slate-500">
                    Aucune facture ne correspond aux filtres actuels.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedInvoice ? (
        <DocumentViewerDrawer
          open={showViewer}
          title={selectedInvoice.number}
          subtitle={`${selectedInvoice.client} • ${selectedInvoice.scope}`}
          status={selectedInvoice.status}
          overview={viewerOverview}
          client={viewerClient}
          related={selectedInvoice.linkedActivity}
          documentHtml={createInvoiceMarkup(selectedInvoice, documentSettings)}
          onClose={() => setShowViewer(false)}
          onDownload={() => handleDownload(selectedInvoice)}
          onPrint={() => handlePrint(selectedInvoice)}
          extraActions={
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => openDeliveryDialogFromInvoice(selectedInvoice)}
            >
              <Truck className="h-4 w-4" />
              Créer un bon
            </Button>
          }
        />
      ) : null}

      <DialogShell
        open={showNewDialog}
        title={isEditingInvoice ? "Modifier la facture" : "Nouvelle facture"}
        description={
          isEditingInvoice
            ? "Mettez a jour les details, les lignes et les notes de la facture, puis enregistrez."
            : "Creez un brouillon de facture avec les lignes, totaux et notes commerciales du PDF final."
        }
        panelClassName="max-w-[min(94vw,1120px)]"
        bodyClassName="bg-[#f8f5ef] p-0"
        onClose={closeInvoiceDialog}
        isDirty={isInvoiceDialogDirty}
        dirtyWarningText="Des modifications non enregistrees seront perdues. Fermer ce formulaire ?"
      >
        <div className="grid gap-5 p-6">
            {dialogError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {dialogError}
              </div>
            ) : null}

            <section className="rounded-[1.25rem] border border-[#e3d6c3] bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8d6a2d]">Facturation</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                    {isEditingInvoice ? "Modifier la facture" : "Nouvelle facture"}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Remplissez les informations générales puis ajoutez les lignes à facturer. Le formulaire reste volontairement simple:
                    client, origine, date, lignes, puis note ou bon de livraison.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
                  <div className="rounded-2xl border border-[#e8dccb] bg-[#fcfbf8] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Client</p>
                    <p className="mt-2 text-sm font-semibold text-slate-800">{invoiceForm.client || "Aucun client"}</p>
                  </div>
                  <div className="rounded-2xl border border-[#e8dccb] bg-[#fcfbf8] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Date</p>
                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {invoiceForm.issueDate ? formatFormalDocumentDate(invoiceForm.issueDate) : "À définir"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#e8dccb] bg-[#fcfbf8] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Total actuel</p>
                    <p className="mt-2 text-sm font-semibold text-slate-800">{formatDraftTnd(draftTotal)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <FormField label="Client facturé">
                  <select
                    value={invoiceForm.client}
                    aria-invalid={Boolean(fieldErrors.client)}
                    onChange={(event) => {
                      setInvoiceForm((current) => ({ ...current, client: event.target.value }));
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
                <FormField label="Origine du document">
                  <select
                    value={invoiceForm.origin}
                    onChange={(event) =>
                      setInvoiceForm((current) => ({
                        ...current,
                        origin: event.target.value as InvoiceFormState["origin"],
                      }))
                    }
                    className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="Quotation">Devis</option>
                    <option value="Project milestone">Avancement chantier</option>
                    <option value="Manual invoice">Facture manuelle</option>
                  </select>
                </FormField>
                <FormField label="Date d'émission (optionnel)">
                  <Input
                    type="date"
                    className="h-11 rounded-xl"
                    value={invoiceForm.issueDate}
                    onChange={(event) =>
                      setInvoiceForm((current) => ({
                        ...current,
                        issueDate: event.target.value,
                        dueDate: buildInvoiceDueDate(event.target.value),
                      }))
                    }
                  />
                </FormField>
              </div>
            </section>

            <section className="rounded-[1.25rem] border border-[#e3d6c3] bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-900">Lignes de facture</p>
                  <p className="text-sm text-muted-foreground">
                    Chaque ligne correspond à une prestation, un article ou une étape de chantier.
                  </p>
                  {fieldErrors.lines ? <p className="mt-2 text-xs font-medium text-rose-600">{fieldErrors.lines}</p> : null}
                </div>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={addDraftLine}>
                    <Plus className="h-4 w-4" />
                    Ajouter une ligne
                  </Button>
                </div>
              </div>

              <div className="overflow-hidden rounded-[1.1rem] border border-[#eadfce] bg-[#fcfbf8]">
                <div className="grid grid-cols-[1.7fr_0.45fr_0.45fr_0.75fr_0.9fr_48px] gap-3 border-b border-[#eadfce] bg-[#f6efe2] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8d6a2d]">
                  <span>Désignation</span>
                  <span>Qté</span>
                  <span>Unité</span>
                  <span>Prix unitaire</span>
                  <span>Total</span>
                  <span />
                </div>
                <div className="divide-y divide-[#eadfce]">
                  {draftLines.map((line) => {
                    const lineTotal = parseDraftNumber(line.quantity) * parseDraftNumber(line.unitPrice);

                    return (
                      <div key={line.id} className="grid grid-cols-[1.7fr_0.45fr_0.45fr_0.75fr_0.9fr_48px] gap-3 px-4 py-3">
                        <div className="grid gap-1">
                          <Input
                            className={cn(
                              "h-11 rounded-xl",
                              lineErrors[line.id]?.description && "border-rose-300 bg-rose-50 focus-visible:ring-rose-200",
                            )}
                            aria-invalid={Boolean(lineErrors[line.id]?.description)}
                            value={line.description}
                            onChange={(event) => updateDraftLine(line.id, "description", event.target.value)}
                            placeholder="Pergola fabrication, garde-corps, structure métallique..."
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
                          {formatDraftTnd(lineTotal)}
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
            </section>

            <section className="rounded-[1.25rem] border border-[#e3d6c3] bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-900">Note ou bon de livraison</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Soit vous ajoutez une note simple à la facture, soit vous préparez directement un bon de livraison lié.
                  </p>
                </div>
                <div className="inline-flex rounded-2xl border border-[#eadfce] bg-[#fcfbf8] p-1">
                  <button
                    type="button"
                    className={cn(
                      "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                      invoiceForm.noteMode === "simple" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500",
                    )}
                    onClick={() => setInvoiceForm((current) => ({ ...current, noteMode: "simple" }))}
                  >
                    Note simple
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                      invoiceForm.noteMode === "delivery" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500",
                    )}
                    onClick={() => setInvoiceForm((current) => ({ ...current, noteMode: "delivery" }))}
                  >
                    Bon de livraison
                  </button>
                </div>
              </div>

              {invoiceForm.noteMode === "simple" ? (
                <div>
                  <FormField label="Observations">
                    <Textarea
                      value={invoiceForm.note}
                      onChange={(event) => setInvoiceForm((current) => ({ ...current, note: event.target.value }))}
                      placeholder="Ajoutez les modalités de règlement, remarques commerciales ou précisions utiles pour le client."
                    />
                  </FormField>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Chantier (optionnel)">
                    <select
                      value={invoiceForm.deliveryProject}
                      onChange={(event) => setInvoiceForm((current) => ({ ...current, deliveryProject: event.target.value }))}
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Sans chantier</option>
                      {projectTitles.length ? (
                        projectTitles.map((projectTitle) => <option key={projectTitle}>{projectTitle}</option>)
                      ) : (
                        <option value="">Aucun chantier disponible</option>
                      )}
                    </select>
                  </FormField>
                  <FormField label="Statut">
                    <select
                      value={invoiceForm.deliveryStatus}
                      onChange={(event) =>
                        setInvoiceForm((current) => ({
                          ...current,
                          deliveryStatus: event.target.value as InvoiceFormState["deliveryStatus"],
                        }))
                      }
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      <option value="PREPARED">Préparé</option>
                      <option value="IN_TRANSIT">En transit</option>
                      <option value="DELIVERED">Livré</option>
                    </select>
                  </FormField>
                  <FormField label="Destination (optionnel)">
                    <Input
                      className="h-11 rounded-xl"
                      value={invoiceForm.deliveryDestination}
                      onChange={(event) => setInvoiceForm((current) => ({ ...current, deliveryDestination: event.target.value }))}
                      placeholder="Chotrana 1, Ariana"
                    />
                  </FormField>
                  <FormField label="Responsable (optionnel)">
                    <Input
                      className="h-11 rounded-xl"
                      value={invoiceForm.deliveryResponsible}
                      onChange={(event) => setInvoiceForm((current) => ({ ...current, deliveryResponsible: event.target.value }))}
                      placeholder="Karim H."
                    />
                  </FormField>
                  <FormField label="Véhicule">
                    <Input
                      className="h-11 rounded-xl"
                      value={invoiceForm.deliveryVehicle}
                      onChange={(event) => setInvoiceForm((current) => ({ ...current, deliveryVehicle: event.target.value }))}
                      placeholder="Iveco Daily - 198 TN 445"
                    />
                  </FormField>
                  <FormField label="Date et heure prévues (optionnel)">
                    <Input
                      type="datetime-local"
                      className="h-11 rounded-xl"
                      value={invoiceForm.deliveryScheduledAt}
                      onChange={(event) => setInvoiceForm((current) => ({ ...current, deliveryScheduledAt: event.target.value }))}
                    />
                  </FormField>
                  <div className="md:col-span-2">
                    <FormField label="Articles livrés / remarques">
                      <Textarea
                        className={cn(
                          fieldErrors.deliveryItemsNote && "border-rose-300 bg-rose-50 focus-visible:ring-rose-200",
                        )}
                        aria-invalid={Boolean(fieldErrors.deliveryItemsNote)}
                        value={invoiceForm.deliveryItemsNote}
                        onChange={(event) => {
                          setInvoiceForm((current) => ({ ...current, deliveryItemsNote: event.target.value }));
                          setFieldErrors((current) => ({ ...current, deliveryItemsNote: undefined }));
                        }}
                        placeholder="Pergola main frame x1, support beams x4, fixing set x1 lot..."
                      />
                      {fieldErrors.deliveryItemsNote ? (
                        <p className="text-xs font-medium text-rose-600">{fieldErrors.deliveryItemsNote}</p>
                      ) : null}
                    </FormField>
                  </div>
                </div>
              )}
            </section>

            <div className="sticky bottom-0 z-10 -mx-6 -mb-6 border-t border-[#e3d6c3] bg-white/95 px-6 py-4 backdrop-blur">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-2xl border border-[#e3d6c3] bg-[#fcfbf8] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Total HT</p>
                    <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{formatDraftTnd(draftTotal)}</p>
                  </div>
                  <div className="text-sm text-slate-500">
                    {invoiceForm.noteMode === "delivery"
                      ? "Le brouillon peut créer en même temps le bon de livraison."
                      : "Ajoutez une note simple si vous avez une précision commerciale à transmettre."}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl"
                    onClick={closeInvoiceDialog}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    className="rounded-2xl bg-[#2f4156] hover:bg-[#253548]"
                    onClick={() => void handleCreateDraft()}
                    disabled={submitting || !clientOptions.length}
                  >
                    {submitting ? "Enregistrement..." : isEditingInvoice ? "Enregistrer les modifications" : "Créer le brouillon"}
                  </Button>
                  {invoiceForm.noteMode === "delivery" && !isEditingInvoice ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => void handleCreateDraft(true)}
                      disabled={submitting || !clientOptions.length}
                    >
                      <Truck className="h-4 w-4" />
                      Créer la facture + le bon
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
        </div>
      </DialogShell>

      <DialogShell
        open={showDeliveryDialog}
        title={deliveryForm.invoiceNumber ? `Bon de livraison depuis ${deliveryForm.invoiceNumber}` : "Créer un bon de livraison"}
        description="Préparez un document de transport lié à un chantier et à une destination."
        onClose={closeDeliveryDialog}
        isDirty={isDeliveryDialogDirty}
        dirtyWarningText="Des modifications non enregistrees seront perdues. Fermer ce formulaire ?"
      >
        <div className="grid gap-4">
          {deliveryDialogError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {deliveryDialogError}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Chantier (optionnel)">
              <select
                value={deliveryForm.project}
                onChange={(event) => setDeliveryForm((current) => ({ ...current, project: event.target.value }))}
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">Sans chantier</option>
                {projectTitles.length ? (
                  projectTitles.map((projectTitle) => <option key={projectTitle}>{projectTitle}</option>)
                ) : (
                  <option value="">Aucun chantier disponible</option>
                )}
              </select>
            </FormField>
            <FormField label="Statut">
              <select
                value={deliveryForm.status}
                onChange={(event) =>
                  setDeliveryForm((current) => ({
                    ...current,
                    status: event.target.value as DeliveryNoteDraftState["status"],
                  }))
                }
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="PREPARED">Préparé</option>
                <option value="IN_TRANSIT">En transit</option>
                <option value="DELIVERED">Livré</option>
              </select>
            </FormField>
            <FormField label="Destination (optionnel)">
              <Input
                className="h-11 rounded-xl"
                value={deliveryForm.destination}
                onChange={(event) => setDeliveryForm((current) => ({ ...current, destination: event.target.value }))}
              />
            </FormField>
            <FormField label="Responsable (optionnel)">
              <Input
                className="h-11 rounded-xl"
                value={deliveryForm.responsible}
                onChange={(event) => setDeliveryForm((current) => ({ ...current, responsible: event.target.value }))}
              />
            </FormField>
            <FormField label="Véhicule">
              <Input
                className="h-11 rounded-xl"
                value={deliveryForm.vehicle}
                onChange={(event) => setDeliveryForm((current) => ({ ...current, vehicle: event.target.value }))}
              />
            </FormField>
            <FormField label="Date et heure prévues (optionnel)">
              <Input
                type="datetime-local"
                className="h-11 rounded-xl"
                value={deliveryForm.scheduledAt}
                onChange={(event) => setDeliveryForm((current) => ({ ...current, scheduledAt: event.target.value }))}
              />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Articles livrés / remarques">
                <Textarea
                  className={cn(
                    deliveryFieldErrors.itemsNote && "border-rose-300 bg-rose-50 focus-visible:ring-rose-200",
                  )}
                  aria-invalid={Boolean(deliveryFieldErrors.itemsNote)}
                  value={deliveryForm.itemsNote}
                  onChange={(event) => {
                    setDeliveryForm((current) => ({ ...current, itemsNote: event.target.value }));
                    setDeliveryFieldErrors((current) => ({ ...current, itemsNote: undefined }));
                  }}
                />
                {deliveryFieldErrors.itemsNote ? (
                  <p className="text-xs font-medium text-rose-600">{deliveryFieldErrors.itemsNote}</p>
                ) : null}
              </FormField>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={closeDeliveryDialog}
            >
              Annuler
            </Button>
            <Button
              type="button"
              className="rounded-2xl bg-[#2f4156] hover:bg-[#253548]"
              onClick={() => void handleCreateDeliveryNoteFromInvoice()}
              disabled={deliverySubmitting || !deliveryForm.client}
            >
              {deliverySubmitting ? "Enregistrement..." : "Créer un bon de livraison"}
            </Button>
          </div>
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

function formatFormalDocumentDate(value: string) {
  if (!value) {
    return "01/04/2026";
  }

  const nativeDate = value.includes("T") ? new Date(value) : value.includes("-") ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(nativeDate.getTime())) {
    return value;
  }

  return nativeDate.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function buildInvoiceDueDate(issueDate: string) {
  if (!issueDate) {
    return "";
  }

  const nativeDate = new Date(`${issueDate}T00:00:00`);
  if (Number.isNaN(nativeDate.getTime())) {
    return "2026-05-01";
  }

  nativeDate.setDate(nativeDate.getDate() + 30);
  const year = nativeDate.getFullYear();
  const month = String(nativeDate.getMonth() + 1).padStart(2, "0");
  const day = String(nativeDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatInvoiceOriginLabel(value: InvoiceFormState["origin"] | string) {
  switch (value) {
    case "Quotation":
      return "Devis";
    case "Project milestone":
      return "Avancement chantier";
    case "Manual invoice":
      return "Facture manuelle";
    default:
      return value;
  }
}

function parseDraftNumber(value: string | number) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

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

function formatDraftTnd(value: number) {
  return formatTnd(value);
}

function extractInvoiceUnitFromQuantityLabel(quantityLabel: string | undefined): string {
  if (!quantityLabel) return "";
  const match = String(quantityLabel).match(/^[\s\d.,-]+\s*(.+)$/);
  return match && match[1] ? match[1].trim() : "";
}

function formatInvoiceAmount(value: string | number) {
  return formatDraftTnd(parseDraftNumber(value));
}

function isZeroAmount(value: string | number) {
  return Math.abs(parseDraftNumber(value)) < 0.0005;
}

function formatInvoiceDate(value: string) {
  if (!value) {
    return "1 avr. 2026";
  }

  const date = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
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

function formatQuantity(value: number, unit?: string) {
  return formatTnQuantity(value, unit);
}

function createDefaultScheduledAt() {
  return "";
}

function buildDeliveryItemsText(
  lines: Array<
    | { label?: string; quantity?: string }
    | { description?: string; quantityValue?: number; quantity?: string; unitPriceValue?: number }
  >,
) {
  return lines
    .map((line) => {
      const label = "label" in line ? line.label : "description" in line ? line.description : undefined;
      const quantity =
        "quantity" in line && line.quantity
          ? line.quantity
          : "quantityValue" in line && line.quantityValue
            ? formatQuantity(line.quantityValue)
            : "1";

      return label?.trim() ? `${label.trim()} x${quantity}` : "";
    })
    .filter(Boolean)
    .join(", ");
}

function buildDeliveryNoteSummary(fields: {
  project: string;
  status: string;
  destination: string;
  responsible: string;
  vehicle: string;
  scheduledAt: string;
  itemsNote: string;
}) {
  const lines = [
    fields.project ? `Projet: ${fields.project}` : "",
    fields.status ? `Statut: ${fields.status.replaceAll("_", " ")}` : "",
    fields.destination ? `Destination: ${fields.destination}` : "",
    fields.responsible ? `Responsable: ${fields.responsible}` : "",
    fields.vehicle ? `Véhicule: ${fields.vehicle}` : "",
    fields.scheduledAt ? `Prévu le: ${formatFormalDocumentDate(fields.scheduledAt)}` : "",
    fields.itemsNote ? `Éléments livrés: ${fields.itemsNote}` : "",
  ].filter(Boolean);

  return lines.join("\n");
}

function createDeliveryDraftFromInvoice(
  invoice: InvoiceRecord,
  fallbackProject: string,
  fallbackItemsNote: string,
): DeliveryNoteDraftState {
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    client: invoice.client,
    project: fallbackProject,
    status: "PREPARED",
    destination: [invoice.clientDetails.address, invoice.clientDetails.city].filter((value) => value && value !== "-").join(", "),
    responsible: invoice.clientDetails.contact !== "-" ? invoice.clientDetails.contact : invoice.client,
    vehicle: "",
    scheduledAt: createDefaultScheduledAt(),
    itemsNote: fallbackItemsNote,
  };
}

function ActionGroup({ children }: { children: ReactNode }) {
  return <div className="flex items-center rounded-2xl border border-black/6 bg-[#fcfbf8] p-1">{children}</div>;
}

function ActionIcon({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-white hover:text-slate-800"
    >
      {children}
    </button>
  );
}
