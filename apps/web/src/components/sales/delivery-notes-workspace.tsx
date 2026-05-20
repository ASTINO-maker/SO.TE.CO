"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCheck, Download, Eye, Pencil, Plus, Printer, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { getBrandLogoUrl } from "../../lib/branding";
import { apiClient } from "../../lib/api/client";
import type { ApiError, PaginatedResponse } from "../../lib/api/types";
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

interface DeliveryClientDetails {
  client: string;
  contact: string;
  phone: string;
  address: string;
  city: string;
}

interface DeliveryNoteRecord {
  id: string;
  number: string;
  project: string;
  destination: string;
  responsible: string;
  vehicle: string;
  scheduledAt: string;
  status: "PREPARED" | "IN_TRANSIT" | "DELIVERED";
  clientDetails: DeliveryClientDetails;
  items: { label: string; quantity: string }[];
  linkedActivity: ViewerListItem[];
}

interface DeliveryNoteFormState {
  client: string;
  project: string;
  status: "PREPARED" | "IN_TRANSIT" | "DELIVERED";
  destination: string;
  responsible: string;
  vehicle: string;
  scheduledAt: string;
  itemsNote: string;
}

interface ProjectOption {
  id: string;
  title: string;
}

interface PersistedClientOption {
  name: string;
}

type DeliveryFormErrors = Partial<Record<"client" | "scheduledAt" | "itemsNote", string>>;

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
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createDefaultDeliveryForm(project = "", client = ""): DeliveryNoteFormState {
  return {
    client,
    project,
    status: "PREPARED",
    destination: "",
    responsible: "",
    vehicle: "",
    scheduledAt: "",
    itemsNote: "",
  };
}

function serializeDeliveryDialogState(form: DeliveryNoteFormState, editingNoteId: string | null) {
  return JSON.stringify({
    form,
    editingNoteId: editingNoteId ?? "",
  });
}

function createDeliveryMarkup(note: DeliveryNoteRecord, settings?: DocumentSettings) {
  const logoUrl = getBrandLogoUrl();
  const headerCompanyName = settings?.headerCompanyName?.trim() || "SO.TE.CO";
  const headerCompanySubtitle =
    settings?.headerCompanySubtitle?.trim() || "Société Tunisienne des Etudes et Constructions";
  const headerAddressLine = settings?.headerAddressLine?.trim() || "Cité Bouhsina, Sousse";
  const headerPhone = settings?.headerPhone?.trim() || "+216 73 230 179";
  const headerPhoneSecondary = settings?.headerPhoneSecondary?.trim() || "";
  const headerPhonesDisplay = headerPhoneSecondary ? `${headerPhone} / ${headerPhoneSecondary}` : headerPhone;
  const headerRc = settings?.headerRc?.trim() || "B09242852018";
  const headerTaxId = settings?.headerTaxId?.trim() || "1588490B/A/M/000";
  const headerCapital = settings?.headerCapital?.trim() || "Capital 100 mille dinars";
  const headerArabicCompanyName = settings?.headerArabicCompanyName?.trim() || "الشركة التونسية للدراسات و البناء";
  const headerArabicAddressLine = settings?.headerArabicAddressLine?.trim() || "سوسة";
  const schedule = formatDeliveryDocumentSchedule(note.scheduledAt);
  const preparedBy = note.responsible && note.responsible !== "-" ? note.responsible : "SO.TE.CO";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(note.number)}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #efe9de; color: #0f172a; font-family: "Inter", "Arial", sans-serif; }
      .sheet { width: min(210mm, 100%); min-height: 297mm; margin: 0 auto; background: white; padding: 11mm 10mm 10mm; }
      .header { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(180px, 0.8fr); gap: 16px; align-items: start; padding-bottom: 8px; border-bottom: 1px solid #d7dde5; }
      .brand-block { display: flex; align-items: flex-start; gap: 10px; }
      .logo-shell { width: 48px; min-width: 48px; }
      .logo-shell img { display: block; width: 100%; height: auto; }
      .brand { font-size: 15px; font-weight: 800; letter-spacing: -0.03em; color: #0f172a; }
      .subbrand { margin-top: 2px; font-size: 8.8px; font-weight: 600; line-height: 1.35; color: #0f172a; }
      .meta { margin-top: 4px; font-size: 8px; line-height: 1.38; color: #475569; }
      .right-meta { text-align: right; font-size: 8px; line-height: 1.42; color: #475569; direction: rtl; unicode-bidi: isolate; }
      .right-meta .arabic-line { display: block; white-space: nowrap; }
      .right-meta .ar-label { direction: rtl; unicode-bidi: isolate; }
      .right-meta .ar-value { direction: ltr; unicode-bidi: isolate; display: inline-block; }
      .doc-top { margin-top: 8px; display: grid; grid-template-columns: minmax(0, 1.18fr) minmax(210px, 0.82fr); gap: 10px; align-items: start; }
      .title-block { border-bottom: 1px solid #d7dde5; padding-bottom: 8px; }
      .doc-chip { font-size: 8px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #64748b; }
      .doc-title { margin-top: 4px; font-size: 19px; font-weight: 800; letter-spacing: 0.04em; color: #0f172a; }
      .doc-subtitle { margin-top: 6px; font-size: 9.2px; line-height: 1.45; color: #475569; }
      .meta-card { border: 1px solid #d7dde5; border-radius: 11px; padding: 8px 10px; background: #fbfbfa; }
      .meta-row { display: flex; justify-content: space-between; gap: 10px; padding: 4px 0; border-bottom: 1px solid #e7ebf0; font-size: 9.8px; }
      .meta-row:last-child { border-bottom: 0; }
      .meta-row span { color: #64748b; font-weight: 600; }
      .meta-row strong { color: #0f172a; text-align: right; font-weight: 800; }
      .logistics-grid { margin-top: 10px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
      .panel { border: 1px solid #d7dde5; border-radius: 11px; padding: 9px 10px; background: white; min-height: 92px; }
      .panel-title { font-size: 7.8px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #64748b; }
      .panel-strong { margin-top: 5px; font-size: 12.6px; font-weight: 700; line-height: 1.25; color: #0f172a; }
      .panel-copy { margin-top: 5px; font-size: 9.2px; line-height: 1.45; color: #475569; }
      .intro { margin-top: 8px; padding: 7px 9px; border-left: 2px solid #d7dde5; background: #f8fafc; font-size: 9.6px; line-height: 1.5; color: #334155; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      thead th { padding: 6px 7px; border-top: 1px solid #0f172a; border-bottom: 1px solid #0f172a; background: #eef2f6; color: #334155; font-size: 7.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; text-align: left; }
      tbody td { padding: 6px 7px; border-bottom: 1px solid #e2e8f0; font-size: 8.9px; vertical-align: top; }
      thead th:nth-child(1), tbody td:nth-child(1) { width: 11%; text-align: center; font-variant-numeric: tabular-nums; }
      thead th:nth-child(2), tbody td:nth-child(2) { width: 89%; }
      .designation-title { font-weight: 700; color: #0f172a; }
      .spacer-row td { height: 28px; }
      .bottom-grid { margin-top: 10px; display: grid; grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr); gap: 10px; }
      .footer-card { border: 1px solid #d7dde5; border-radius: 11px; padding: 9px 10px; background: #fbfbfa; min-height: 62px; }
      .footer-card p { margin: 4px 0 0; font-size: 9px; line-height: 1.45; color: #475569; }
      .receipt-grid { margin-top: 9px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      .receipt-box { border-top: 1px solid #cbd5e1; padding-top: 16px; text-align: center; font-size: 8.8px; color: #475569; }
      .receipt-box strong { display: block; margin-bottom: 5px; font-size: 9.2px; color: #0f172a; }
      .closing { margin-top: 8px; border-top: 1px solid #d7dde5; padding-top: 6px; display: flex; justify-content: space-between; gap: 12px; font-size: 8px; color: #94a3b8; }
      @media print { body { background: white; } .sheet { margin: 0; padding: 10mm 9mm; box-shadow: none; } }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="header">
        <div class="brand-block">
          <div class="logo-shell">
            <img src="${logoUrl}" alt="SO.TE.CO" />
          </div>
          <div>
            <div class="brand">${headerCompanyName}</div>
            <div class="subbrand">${headerCompanySubtitle}</div>
            <div class="meta">
            ${headerAddressLine}<br/>
            Tél/Fax: ${headerPhonesDisplay}<br/>
            RC: ${headerRc}<br/>
            Code TVA: ${headerTaxId}<br/>
            ${headerCapital}
            </div>
          </div>
        </div>
        <div class="right-meta" lang="ar" dir="rtl">
          <span class="arabic-line"><span class="ar-label">${headerArabicCompanyName}</span></span>
          <span class="arabic-line"><span class="ar-label">الهاتف:</span> <span class="ar-value">${headerPhonesDisplay}</span></span>
          <span class="arabic-line"><span class="ar-label">العنوان:</span> ${headerArabicAddressLine}</span>
          <span class="arabic-line"><span class="ar-label">السجل التجاري:</span> <span class="ar-value">${headerRc}</span></span>
          <span class="arabic-line"><span class="ar-label">المعرف الجبائي:</span> <span class="ar-value">${headerTaxId}</span></span>
        </div>
      </div>

      <div class="doc-top">
        <div class="title-block">
          <div class="doc-chip">Logistique chantier</div>
          <div class="doc-title">BON DE LIVRAISON</div>
          <div class="doc-subtitle">
            Document de remise de matériel ou d’ouvrage pour le chantier <strong>${escapeHtml(note.project)}</strong>.
          </div>
        </div>
        <div class="meta-card">
          <div class="meta-row"><span>N° bon</span><strong>${escapeHtml(note.number)}</strong></div>
          <div class="meta-row"><span>Date</span><strong>${escapeHtml(schedule.date)}</strong></div>
          <div class="meta-row"><span>Heure</span><strong>${escapeHtml(schedule.time)}</strong></div>
        </div>
      </div>

      <div class="logistics-grid">
        <div class="panel">
          <div class="panel-title">Client et destination</div>
          <div class="panel-strong">${escapeHtml(note.clientDetails.client)}</div>
          <div class="panel-copy">
            Adresse chantier: ${escapeHtml(note.destination)}<br/>
            Ville: ${escapeHtml(note.clientDetails.city)}<br/>
            Contact: ${escapeHtml(note.clientDetails.contact)} · ${escapeHtml(note.clientDetails.phone)}
          </div>
        </div>
        <div class="panel">
          <div class="panel-title">Organisation de livraison</div>
          <div class="panel-strong">${escapeHtml(note.project)}</div>
          <div class="panel-copy">
            Responsable: ${escapeHtml(note.responsible)}<br/>
            Véhicule: ${escapeHtml(note.vehicle)}<br/>
            Référence chantier: ${escapeHtml(note.number)}
          </div>
        </div>
      </div>

      <div class="intro">
        Les articles ci-dessous ont été préparés et remis pour transport ou réception sur chantier. Merci de contrôler la quantité et la désignation au moment de la réception.
      </div>

      <table>
        <thead>
          <tr>
            <th class="qty">Quantité</th>
            <th class="designation">Désignation</th>
          </tr>
        </thead>
        <tbody>
          ${note.items
            .map(
              (item) => `
            <tr>
              <td class="qty">${escapeHtml(item.quantity)}</td>
              <td class="designation"><div class="designation-title">${escapeHtml(item.label)}</div></td>
            </tr>`,
            )
            .join("")}
          ${Array.from({ length: Math.max(0, 10 - note.items.length) })
            .map(
              () => `
            <tr class="spacer-row">
              <td></td>
              <td></td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>

      <div class="bottom-grid">
        <div class="footer-card">
          <div class="panel-title">Remarques logistiques</div>
          <p>
            Destination: ${escapeHtml(note.destination)}<br/>
            Préparé par: ${escapeHtml(preparedBy)}<br/>
            Véhicule affecté: ${escapeHtml(note.vehicle)}
          </p>
        </div>
        <div class="footer-card">
          <div class="panel-title">Réception</div>
          <p>
            Le client ou son représentant reconnaît la réception des éléments listés ci-dessus, sous réserve de contrôle sur chantier.
          </p>
        </div>
      </div>

      <div class="receipt-grid">
        <div class="receipt-box">
          <strong>Remis par SO.TE.CO</strong>
          Nom et signature
        </div>
        <div class="receipt-box">
          <strong>Réception client / chantier</strong>
          Nom, qualité et signature
        </div>
      </div>

      <div class="closing">
        <span>${escapeHtml(note.clientDetails.address)} · ${escapeHtml(note.clientDetails.city)}</span>
        <span>Document logistique SO.TE.CO</span>
      </div>
    </div>
  </body>
</html>`;
}

export function DeliveryNotesWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const action = searchParams.get("action") ?? "";
  const isNewAction = action === "new";
  const baseHref = "/sales/delivery-notes";
  const actionHref = `${baseHref}?action=`;
  const [notes, setNotes] = useState<DeliveryNoteRecord[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [clients, setClients] = useState<PersistedClientOption[]>([]);
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
  });
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showViewer, setShowViewer] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<DeliveryFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState<DeliveryNoteFormState>(createDefaultDeliveryForm());
  const deliveryDialogInitialRef = useRef<string | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  async function loadData() {
    setLoading(true);
    setPageError("");

    try {
      const [notesResponse, projectsResponse, clientsResponse, settingsResponse] = await Promise.all([
        apiClient.get<PaginatedResponse<DeliveryNoteRecord>>("/sales/delivery-notes", {
          page: 1,
          pageSize: 100,
        }),
        apiClient.get<PaginatedResponse<ProjectOption & { title: string }>>("/projects", {
          page: 1,
          pageSize: 100,
        }),
        apiClient.get<PaginatedResponse<PersistedClientOption>>("/crm/clients", {
          page: 1,
          pageSize: 100,
        }),
        apiClient.get<DocumentSettings>("/settings/documents"),
      ]);

      setNotes(notesResponse.data);
      setDocumentSettings(settingsResponse);
      setClients(clientsResponse.data);
      setProjectOptions(
        projectsResponse.data.map((project) => ({
          id: project.id,
          title: project.title,
        })),
      );
      setSelectedId((current) => current || notesResponse.data[0]?.id || "");
      const firstProjectTitle = projectsResponse.data[0]?.title ?? "";
      const firstClientName = clientsResponse.data[0]?.name ?? "";
      setDeliveryForm((current) =>
        current.project || current.client ? current : createDefaultDeliveryForm(firstProjectTitle, firstClientName),
      );
    } catch (error) {
      setPageError(getApiErrorMessage(error, "Impossible de charger les bons de livraison."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const clientOptions = useMemo(() => {
    return clients.map((client) => client.name).filter(Boolean);
  }, [clients]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return notes.filter((note) => {
      const matchesTerm =
        !term ||
        [note.number, note.project, note.destination, note.responsible, note.clientDetails.client]
          .join(" ")
          .toLowerCase()
          .includes(term);
      const matchesStatus = statusFilter === "ALL" || note.status === statusFilter;
      return matchesTerm && matchesStatus;
    });
  }, [notes, search, statusFilter]);

  const filteredIds = useMemo(() => filtered.map((note) => note.id), [filtered]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIdSet.has(id));

  const selectedNote = notes.find((note) => note.id === selectedId) ?? filtered[0] ?? notes[0] ?? null;
  const isEditingNote = Boolean(editingNoteId);
  const serializedDeliveryDialogState = useMemo(
    () => serializeDeliveryDialogState(deliveryForm, editingNoteId),
    [deliveryForm, editingNoteId],
  );
  const isDeliveryDialogDirty =
    showNewDialog &&
    deliveryDialogInitialRef.current !== null &&
    deliveryDialogInitialRef.current !== serializedDeliveryDialogState;

  const viewerOverview: ViewerInfoRow[] =
    selectedNote
      ? [
          { label: "Chantier", value: selectedNote.project },
          { label: "Destination", value: selectedNote.destination },
          { label: "Responsable", value: selectedNote.responsible },
          { label: "Véhicule", value: selectedNote.vehicle },
          { label: "Prévu le", value: formatDeliveryScheduleLabel(selectedNote.scheduledAt) },
          { label: "Articles", value: `${selectedNote.items.length} ligne(s)` },
        ]
      : [];

  const viewerClient: ViewerInfoRow[] =
    selectedNote
      ? [
          { label: "Client", value: selectedNote.clientDetails.client },
          { label: "Contact", value: selectedNote.clientDetails.contact },
          { label: "Téléphone", value: selectedNote.clientDetails.phone },
          { label: "Adresse", value: selectedNote.clientDetails.address },
          { label: "Ville", value: selectedNote.clientDetails.city },
          { label: "Statut", value: formatDeliveryStatusLabel(selectedNote.status) },
        ]
      : [];

  function openViewer(note: DeliveryNoteRecord) {
    setSelectedId(note.id);
    setShowViewer(true);
  }

  function openNewDeliveryDialog() {
    const nextForm = createDefaultDeliveryForm(projectOptions[0]?.title ?? "", clientOptions[0] ?? "");
    setEditingNoteId(null);
    setFormError("");
    setFieldErrors({});
    setSubmitting(false);
    setDeliveryForm(nextForm);
    deliveryDialogInitialRef.current = serializeDeliveryDialogState(nextForm, null);
    setShowNewDialog(true);
    router.replace(`${actionHref}new`, { scroll: false });
  }

  function closeDeliveryDialog() {
    const nextForm = createDefaultDeliveryForm(projectOptions[0]?.title ?? "", clientOptions[0] ?? "");
    setShowNewDialog(false);
    setEditingNoteId(null);
    setFormError("");
    setFieldErrors({});
    setSubmitting(false);
    setDeliveryForm(nextForm);
    deliveryDialogInitialRef.current = null;
    if (isNewAction) {
      router.replace(baseHref, { scroll: false });
    }
  }

  function openEditNoteDialog(note: DeliveryNoteRecord) {
    const nextForm: DeliveryNoteFormState = {
      client: note.clientDetails.client,
      project: note.project,
      status: note.status,
      destination: note.destination,
      responsible: note.responsible,
      vehicle: note.vehicle === "-" ? "" : note.vehicle,
      scheduledAt: toDateTimeInputValue(note.scheduledAt, ""),
      itemsNote: note.items.map((item) => `${item.label} x${item.quantity}`).join("\n"),
    };
    setEditingNoteId(note.id);
    setFormError("");
    setFieldErrors({});
    setSubmitting(false);
    setDeliveryForm(nextForm);
    deliveryDialogInitialRef.current = serializeDeliveryDialogState(nextForm, note.id);
    setShowNewDialog(true);
    if (isNewAction) {
      router.replace(baseHref, { scroll: false });
    }
  }

  function toggleNoteSelection(noteId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(noteId) ? current : [...current, noteId];
      }

      return current.filter((id) => id !== noteId);
    });
  }

  function toggleSelectAllNotes(checked: boolean) {
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

  async function handleDeleteNote(note: DeliveryNoteRecord) {
    const confirmed = await confirm({
      title: `Supprimer ${note.number} ?`,
      description: "Ce bon de livraison sera supprimé définitivement.",
      confirmLabel: "Supprimer le bon",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    try {
      await apiClient.del<{ success: boolean }>(`/sales/delivery-notes/${note.id}`);
      setNotes((current) => current.filter((item) => item.id !== note.id));
      setSelectedIds((current) => current.filter((id) => id !== note.id));
      if (selectedId === note.id) {
        setSelectedId("");
        setShowViewer(false);
      }
      setFeedback(`${note.number} supprimé.`);
    } catch (error) {
      setFeedback(getApiErrorMessage(error, "Impossible de supprimer le bon de livraison."));
    }
  }

  async function handleDeleteSelectedNotes() {
    if (!selectedIds.length) {
      return;
    }

    const selectedSet = new Set(selectedIds);
    const notesToDelete = notes.filter((note) => selectedSet.has(note.id));
    if (!notesToDelete.length) {
      setSelectedIds([]);
      return;
    }

    const confirmed = await confirm({
      title: `Supprimer ${notesToDelete.length} bon${notesToDelete.length > 1 ? "s" : ""} de livraison ?`,
      description: "Les bons sélectionnés seront supprimés définitivement.",
      confirmLabel: "Supprimer la sélection",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    const previousNotes = notes;
    const selectedWasDeleted = selectedId ? selectedSet.has(selectedId) : false;

    setNotes((current) => current.filter((note) => !selectedSet.has(note.id)));
    setSelectedIds([]);
    if (selectedWasDeleted) {
      setSelectedId("");
      setShowViewer(false);
    }

    try {
      await Promise.all(
        notesToDelete.map((note) => apiClient.del<{ success: boolean }>(`/sales/delivery-notes/${note.id}`)),
      );
      setFeedback(`${notesToDelete.length} bon${notesToDelete.length > 1 ? "s" : ""} de livraison supprimé${notesToDelete.length > 1 ? "s" : ""}.`);
    } catch (error) {
      setNotes(previousNotes);
      if (selectedWasDeleted && selectedId) {
        setSelectedId(selectedId);
      }
      setFeedback(getApiErrorMessage(error, "Impossible de supprimer la selection de bons de livraison."));
    }
  }

  async function handleDownload(note: DeliveryNoteRecord) {
    await downloadPdfDocument(`${note.number}.pdf`, createDeliveryMarkup(note, documentSettings));
    setFeedback(`${note.number} downloaded.`);
  }

  async function handlePrint(note: DeliveryNoteRecord) {
    const result = await printHtmlDocument(note.number, createDeliveryMarkup(note, documentSettings));
    setFeedback(result.status === "printed" ? `${note.number} sent to printer.` : result.message);
  }

  async function handleCreateNote() {
    const currentEditingNoteId = editingNoteId;
    const clientName = deliveryForm.client.trim();
    const itemsNote = deliveryForm.itemsNote.trim();
    const scheduledAt = deliveryForm.scheduledAt.trim();
    const scheduledAtDate = scheduledAt ? new Date(scheduledAt) : null;
    const nextFieldErrors: DeliveryFormErrors = {};

    if (!clientName) {
      nextFieldErrors.client = "Sélectionnez un client avant de créer le bon.";
    }

    if (scheduledAtDate && Number.isNaN(scheduledAtDate.getTime())) {
      nextFieldErrors.scheduledAt = "Date prévue invalide.";
    }

    if (!itemsNote) {
      nextFieldErrors.itemsNote = "Ajoutez au moins un article livré.";
    }

    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors);
      setFormError("");
      return;
    }

    setSubmitting(true);
    setFormError("");
    setFieldErrors({});

    try {
      const payload = {
        client: clientName,
        ...(deliveryForm.project.trim() ? { project: deliveryForm.project.trim() } : {}),
        status: deliveryForm.status,
        ...(deliveryForm.destination.trim() ? { destination: deliveryForm.destination.trim() } : {}),
        ...(deliveryForm.responsible.trim() ? { responsible: deliveryForm.responsible.trim() } : {}),
        ...(deliveryForm.vehicle.trim() ? { vehicle: deliveryForm.vehicle.trim() } : {}),
        ...(scheduledAtDate ? { scheduledAt: scheduledAtDate.toISOString() } : {}),
        itemsNote,
      };
      const created = currentEditingNoteId
        ? await apiClient.patch<DeliveryNoteRecord>(`/sales/delivery-notes/${currentEditingNoteId}`, payload)
        : await apiClient.post<DeliveryNoteRecord>("/sales/delivery-notes", payload);

      setNotes((current) =>
        currentEditingNoteId
          ? current.map((item) => (item.id === currentEditingNoteId ? created : item))
          : [created, ...current],
      );
      setSelectedId(created.id);
      closeDeliveryDialog();
      setFeedback(
        currentEditingNoteId
          ? `${created.number} mis à jour avec succès.`
          : `${created.number} créé et ajouté au registre.`,
      );
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Impossible d'enregistrer le bon de livraison."));
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (isNewAction && !showNewDialog) {
      const nextForm = createDefaultDeliveryForm(projectOptions[0]?.title ?? "", clientOptions[0] ?? "");
      setEditingNoteId(null);
      setFormError("");
      setFieldErrors({});
      setSubmitting(false);
      setDeliveryForm(nextForm);
      deliveryDialogInitialRef.current = serializeDeliveryDialogState(nextForm, null);
      setShowNewDialog(true);
      return;
    }

    if (!isNewAction && showNewDialog && !editingNoteId) {
      setShowNewDialog(false);
      deliveryDialogInitialRef.current = null;
    }
  }, [isNewAction, showNewDialog, editingNoteId, projectOptions, clientOptions]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => notes.some((note) => note.id === id)));
  }, [notes]);

  return (
    <>
      {loading ? (
        <div className="rounded-[1.75rem] border border-black/6 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Chargement des bons de livraison...
        </div>
      ) : pageError ? (
        <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
          <p className="font-medium">Impossible de charger les bons de livraison.</p>
          <p className="mt-2">{pageError}</p>
          <Button type="button" className="mt-4 rounded-2xl" onClick={() => void loadData()}>
            Réessayer
          </Button>
        </div>
      ) : (
        <div className="grid gap-6">
          <section className="rounded-[1.75rem] border border-black/6 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8d6a2d]">
                  Logistique chantier
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Registre des bons de livraison</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  Une page simple pour voir ce qui est préparé, ce qui est en route et ce qui a déjà été livré au client.
                </p>
              </div>
              <Button type="button" className="rounded-2xl bg-[#2f4156] hover:bg-[#253548]" onClick={openNewDeliveryDialog}>
                <Plus className="h-4 w-4" />
                Nouveau bon
              </Button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricBox label="À préparer" value={String(notes.filter((n) => n.status === "PREPARED").length)} />
              <MetricBox label="En transit" value={String(notes.filter((n) => n.status === "IN_TRANSIT").length)} />
              <MetricBox label="Livrés" value={String(notes.filter((n) => n.status === "DELIVERED").length)} />
              <MetricBox label="Total" value={String(notes.length)} />
            </div>

            <div className="mt-5 rounded-[1.35rem] border border-black/6 bg-[#fcfbf8] px-4 py-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">Lecture rapide</p>
              <p className="mt-1">
                Cette page doit dire clairement où se trouve chaque livraison: atelier, route ou chantier.
              </p>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-black/6 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">Liste des bons</p>
                <p className="mt-1 text-sm text-slate-500">Recherche rapide, sélection multiple, impression et modification.</p>
              </div>
              <div className="text-sm text-slate-500">{filtered.length} bon(s)</div>
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 rounded-2xl border-black/8 bg-[#fcfbf8] pl-11 shadow-none"
                placeholder="Rechercher des bons de livraison..."
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
                  <option value="PREPARED">Préparé</option>
                  <option value="IN_TRANSIT">En transit</option>
                  <option value="DELIVERED">Livré</option>
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-2xl border-rose-200 text-rose-700 hover:bg-rose-50"
                disabled={!selectedIds.length}
                onClick={() => void handleDeleteSelectedNotes()}
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
              <div className="grid grid-cols-[40px_1.05fr_1.9fr_1.5fr_0.95fr_1fr_0.85fr_164px] gap-3 border-b border-black/6 px-5 py-3 text-[13px] font-medium text-slate-500">
              <span className="flex items-center justify-center">
                <input
                  type="checkbox"
                  aria-label="Select all delivery notes"
                  checked={allFilteredSelected}
                  disabled={!filtered.length}
                  onChange={(event) => toggleSelectAllNotes(event.target.checked)}
                  className="h-4 w-4 rounded border-black/20 accent-[#2f4156]"
                />
              </span>
              <span>Bon</span>
              <span>Chantier / client</span>
              <span>Destination</span>
              <span>Responsable</span>
              <span>Prévu le</span>
              <span>Statut</span>
              <span className="text-right">Actions</span>
              </div>

              <div className="divide-y divide-black/6">
                {filtered.length ? filtered.map((note) => (
                <div
                  key={note.id}
                  className={cn(
                    "grid grid-cols-[40px_1.05fr_1.9fr_1.5fr_0.95fr_1fr_0.85fr_164px] items-center gap-3 px-5 py-3.5",
                    selectedIdSet.has(note.id) && "bg-[#faf7f1]",
                  )}
                >
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      aria-label={`Select delivery note ${note.number}`}
                      checked={selectedIdSet.has(note.id)}
                      onChange={(event) => toggleNoteSelection(note.id, event.target.checked)}
                      className="h-4 w-4 rounded border-black/20 accent-[#2f4156]"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{note.number}</p>
                    <p className="truncate text-xs text-slate-400">{note.vehicle}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{note.project}</p>
                    <p className="truncate text-xs text-slate-400">{note.clientDetails.client}</p>
                  </div>
                  <div className="truncate text-sm text-slate-500">{note.destination}</div>
                  <div className="text-sm text-slate-500">{note.responsible}</div>
                  <div className="text-sm text-slate-500">{formatDeliveryScheduleLabel(note.scheduledAt)}</div>
                  <div>
                    <StatusBadge status={note.status} />
                  </div>
                  <div className="flex justify-end">
                    <ActionGroup>
                      <ActionIcon label="Voir le bon de livraison" onClick={() => openViewer(note)}>
                        <Eye className="h-4 w-4" />
                      </ActionIcon>
                      <ActionIcon label="Imprimer le bon de livraison" onClick={() => handlePrint(note)}>
                        <Printer className="h-4 w-4" />
                      </ActionIcon>
                      <ActionIcon label="Télécharger le bon de livraison" onClick={() => handleDownload(note)}>
                        <Download className="h-4 w-4" />
                      </ActionIcon>
                      <ActionIcon label="Modifier le bon de livraison" onClick={() => openEditNoteDialog(note)}>
                        <Pencil className="h-4 w-4" />
                      </ActionIcon>
                      <ActionIcon label="Supprimer le bon de livraison" onClick={() => void handleDeleteNote(note)}>
                        <Trash2 className="h-4 w-4" />
                      </ActionIcon>
                    </ActionGroup>
                  </div>
                </div>
              )) : (
                <div className="px-5 py-10 text-center text-sm text-slate-500">Aucun bon de livraison ne correspond aux filtres actuels.</div>
              )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedNote ? (
        <DocumentViewerDrawer
          open={showViewer}
          title={selectedNote.number}
          subtitle={`${selectedNote.clientDetails.client} • ${selectedNote.project}`}
          status={selectedNote.status}
          overview={viewerOverview}
          client={viewerClient}
          related={selectedNote.linkedActivity}
          documentHtml={createDeliveryMarkup(selectedNote, documentSettings)}
          onClose={() => setShowViewer(false)}
          onDownload={() => handleDownload(selectedNote)}
          onPrint={() => handlePrint(selectedNote)}
        />
      ) : null}

      <DialogShell
        open={showNewDialog}
        title={isEditingNote ? "Modifier le bon de livraison" : "Nouveau bon de livraison"}
        description={
          isEditingNote
            ? "Mettez a jour les details de transport et les articles livres, puis enregistrez."
            : "Préparez un document de transport lié à un chantier et à une destination."
        }
        onClose={closeDeliveryDialog}
        isDirty={isDeliveryDialogDirty}
        dirtyWarningText="Des modifications non enregistrees seront perdues. Fermer ce formulaire ?"
        panelClassName="max-w-[min(94vw,1120px)]"
        bodyClassName="bg-[#f8f5ef] p-0"
      >
        <div className="grid gap-5 p-6">
          {formError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {formError}
            </div>
          ) : null}

          <section className="rounded-[1.25rem] border border-[#e3d6c3] bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8d6a2d]">Livraison chantier</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {isEditingNote ? "Modifier le bon de livraison" : "Nouveau bon de livraison"}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Préparez un bon clair pour le chantier: destination, responsable, véhicule, horaire prévu et liste des éléments livrés.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px] xl:grid-cols-4">
                <InfoBox label="Client" value={deliveryForm.client || "Aucun client"} />
                <InfoBox label="Chantier" value={deliveryForm.project || "À définir"} />
                <InfoBox label="Statut" value={formatDeliveryStatusLabel(deliveryForm.status)} />
                <InfoBox label="Prévu le" value={deliveryForm.scheduledAt ? formatDeliveryScheduleLabel(deliveryForm.scheduledAt) : "À définir"} />
              </div>
            </div>
          </section>

          <section className="rounded-[1.25rem] border border-[#e3d6c3] bg-white p-6 shadow-sm">
            <div className="mb-5">
              <p className="text-base font-semibold text-slate-900">Organisation de livraison</p>
              <p className="mt-1 text-sm text-slate-500">Les informations de base pour savoir où va le bon, qui le gère et comment il part.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FormField label="Client">
                <select
                  value={deliveryForm.client}
                  aria-invalid={Boolean(fieldErrors.client)}
                  onChange={(event) => {
                    setDeliveryForm((current) => ({ ...current, client: event.target.value }));
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
              <FormField label="Chantier (optionnel)">
                <select
                  value={deliveryForm.project}
                  onChange={(event) => setDeliveryForm((current) => ({ ...current, project: event.target.value }))}
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="">Sans chantier</option>
                  {projectOptions.length ? (
                    projectOptions.map((project) => (
                      <option key={project.id} value={project.title}>
                        {project.title}
                      </option>
                    ))
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
                      status: event.target.value as DeliveryNoteFormState["status"],
                    }))
                  }
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="PREPARED">Préparé</option>
                  <option value="IN_TRANSIT">En transit</option>
                  <option value="DELIVERED">Livré</option>
                </select>
              </FormField>
              <FormField label="Date et heure prévues (optionnel)">
                <Input
                  type="datetime-local"
                  className={cn(
                    "h-11 rounded-xl",
                    fieldErrors.scheduledAt && "border-rose-300 bg-rose-50 focus-visible:ring-rose-200",
                  )}
                  aria-invalid={Boolean(fieldErrors.scheduledAt)}
                  value={deliveryForm.scheduledAt}
                  onChange={(event) => {
                    setDeliveryForm((current) => ({ ...current, scheduledAt: event.target.value }));
                    setFieldErrors((current) => ({ ...current, scheduledAt: undefined }));
                  }}
                />
                {fieldErrors.scheduledAt ? <p className="text-xs font-medium text-rose-600">{fieldErrors.scheduledAt}</p> : null}
              </FormField>
              <FormField label="Destination chantier (optionnel)">
                <Input
                  className="h-11 rounded-xl"
                  value={deliveryForm.destination}
                  onChange={(event) => setDeliveryForm((current) => ({ ...current, destination: event.target.value }))}
                  placeholder="Chotrana 1, Ariana"
                />
              </FormField>
              <FormField label="Responsable sur place (optionnel)">
                <Input
                  className="h-11 rounded-xl"
                  value={deliveryForm.responsible}
                  onChange={(event) => setDeliveryForm((current) => ({ ...current, responsible: event.target.value }))}
                  placeholder="Karim H."
                />
              </FormField>
              <FormField label="Véhicule / transport">
                <Input
                  className="h-11 rounded-xl"
                  value={deliveryForm.vehicle}
                  onChange={(event) => setDeliveryForm((current) => ({ ...current, vehicle: event.target.value }))}
                  placeholder="Iveco Daily - 198 TN 445"
                />
              </FormField>
            </div>
          </section>

          <section className="rounded-[1.25rem] border border-[#e3d6c3] bg-white p-6 shadow-sm">
            <div className="mb-5">
              <p className="text-base font-semibold text-slate-900">Articles livrés</p>
              <p className="mt-1 text-sm text-slate-500">Une ligne par élément, quantité ou remarque utile pour le chantier.</p>
            </div>
            <FormField label="Liste de livraison">
              <Textarea
                className={cn(
                  fieldErrors.itemsNote && "border-rose-300 bg-rose-50 focus-visible:ring-rose-200",
                )}
                aria-invalid={Boolean(fieldErrors.itemsNote)}
                value={deliveryForm.itemsNote}
                onChange={(event) => {
                  setDeliveryForm((current) => ({ ...current, itemsNote: event.target.value }));
                  setFieldErrors((current) => ({ ...current, itemsNote: undefined }));
                }}
                placeholder={"Pergola main frame x1\nSupport beams x4\nFixing set x1 lot"}
              />
              {fieldErrors.itemsNote ? <p className="text-xs font-medium text-rose-600">{fieldErrors.itemsNote}</p> : null}
            </FormField>
          </section>

          <div className="sticky bottom-0 z-10 -mx-6 -mb-6 border-t border-[#e3d6c3] bg-white/95 px-6 py-4 backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm text-slate-500">
                Le bon généré mettra l’accent sur le chantier, la destination, la réception et la liste des éléments livrés.
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
                  onClick={() => void handleCreateNote()}
                  disabled={submitting || !clientOptions.length}
                >
                  {submitting ? "Enregistrement..." : isEditingNote ? "Enregistrer les modifications" : "Créer le bon"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogShell>

      {confirmDialog}
    </>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-[1.35rem] border-black/6 shadow-sm">
      <CardContent className="p-5">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-3 text-[2rem] font-semibold leading-none text-slate-800">{value}</p>
      </CardContent>
    </Card>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/6 bg-[#fcfbf8] p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-700">{value}</p>
    </div>
  );
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

function getApiErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") {
    return fallback;
  }

  const apiError = error as ApiError;
  return apiError.error?.details?.[0]?.message || apiError.error?.message || fallback;
}

function toDateTimeInputValue(value: string, fallback: string) {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateTimeLocal(parsed);
  }

  const gbMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4}),?\s*(\d{2}):(\d{2})$/u);
  if (!gbMatch) {
    return fallback;
  }

  const [, day, month, year, hour, minute] = gbMatch;
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function formatDateTimeLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function formatDeliveryScheduleLabel(value: string) {
  if (!value) {
    return "-";
  }

  const nativeDate = new Date(value);
  if (!Number.isNaN(nativeDate.getTime())) {
    return nativeDate.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return value;
}

function formatDeliveryDocumentSchedule(value: string) {
  if (!value) {
    return { date: "-", time: "-" };
  }

  const nativeDate = new Date(value);
  if (!Number.isNaN(nativeDate.getTime())) {
    return {
      date: nativeDate.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      time: nativeDate.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  }

  return { date: value, time: "-" };
}

function formatDeliveryStatusLabel(value: DeliveryNoteRecord["status"] | string) {
  switch (value) {
    case "PREPARED":
      return "Préparé";
    case "IN_TRANSIT":
      return "En transit";
    case "DELIVERED":
      return "Livré";
    default:
      return value;
  }
}
