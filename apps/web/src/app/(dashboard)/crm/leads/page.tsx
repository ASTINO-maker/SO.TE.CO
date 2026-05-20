"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { FilterBanner } from "../../../../components/admin/filter-banner";
import { FormField } from "../../../../components/admin/form-field";
import { StatusBadge } from "../../../../components/admin/status-badge";
import { WorkspaceHero } from "../../../../components/admin/workspace-hero";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent } from "../../../../components/ui/card";
import { useConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { DialogShell } from "../../../../components/ui/dialog";
import { Input } from "../../../../components/ui/input";
import { Textarea } from "../../../../components/ui/textarea";
import { apiClient } from "../../../../lib/api/client";
import { cn } from "../../../../lib/utils";
import type { ApiError, PaginatedResponse } from "../../../../lib/api/types";

type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "QUOTED" | "WON" | "LOST";
type LeadSource = "WHATSAPP" | "REFERRAL" | "WEBSITE" | "PHONE" | "OTHER";
type DialogMode = "create" | "edit" | null;

interface LeadRecord {
  id: string;
  prospect: string;
  source: string;
  status: LeadStatus;
  requestedWork: string;
  budget: string;
  assignedTo: string;
  followUp: string;
  contactPerson: string;
  phone: string;
}

interface LeadFormState {
  prospect: string;
  source: LeadSource;
  contactPerson: string;
  phone: string;
  status: LeadStatus;
  budget: string;
  followUp: string;
  requestedWork: string;
}

const defaultLeadForm: LeadFormState = {
  prospect: "",
  source: "WHATSAPP",
  contactPerson: "",
  phone: "",
  status: "NEW",
  budget: "",
  followUp: new Date().toISOString().slice(0, 10),
  requestedWork: "",
};

const statusOptions: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "QUOTED", "WON", "LOST"];
const sourceOptions: Array<{ value: LeadSource; label: string }> = [
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "REFERRAL", label: "Referral" },
  { value: "WEBSITE", label: "Website" },
  { value: "PHONE", label: "Phone" },
  { value: "OTHER", label: "Other" },
];

export default function LeadsPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-black/6 bg-white p-6 text-sm text-slate-500">
          Chargement de l'espace prospects...
        </div>
      }
    >
      <LeadsPageClient />
    </Suspense>
  );
}

function LeadsPageClient() {
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter");

  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | LeadStatus>("ALL");
  const [ownerFilter, setOwnerFilter] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [leadForm, setLeadForm] = useState<LeadFormState>(defaultLeadForm);
  const [dialogError, setDialogError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();
  const dialogInitialRef = useRef<string | null>(null);

  const text = {
    pageError: "Impossible de charger les prospects.",
    saveError: "Impossible d'enregistrer le prospect.",
    deleteError: "Impossible de supprimer le prospect.",
    bulkDeleteError: "Impossible de supprimer la sélection.",
    requiredError: "Renseignez le prospect, le contact, le téléphone et le besoin avant d'enregistrer.",
    created: "Prospect créé.",
    updated: "Prospect mis à jour.",
    deleted: "Prospect supprimé.",
    deletedMany: "Prospects supprimés.",
    upcomingLabel: "Rappels proches",
    upcomingDesc: "Affiche uniquement les prospects à relancer rapidement.",
    title: "Prospects",
    description:
      "Un registre simple pour suivre les prospects, relancer au bon moment et transformer en devis puis en client.",
    note: "Ici on garde seulement ce qui sert au suivi commercial: besoin, budget, responsable, prochain rappel et actions.",
    newLead: "Nouveau prospect",
    searchLabel: "Recherche",
    searchPlaceholder: "Rechercher un prospect, un téléphone ou un besoin...",
    statusLabel: "Statut",
    ownerLabel: "Responsable",
    allStatuses: "Tous les statuts",
    allOwners: "Tous les responsables",
    clearFilters: "Réinitialiser",
    tableTitle: "Registre prospects",
    emptyTitle: "Aucun prospect",
    emptyDescription: "Ajoutez un prospect pour commencer le suivi commercial.",
    bulkDelete: "Supprimer la sélection",
    edit: "Modifier",
    delete: "Supprimer",
    prospectName: "Prospect",
    source: "Source",
    status: "Statut",
    requestedWork: "Besoin",
    budget: "Budget",
    assignedTo: "Responsable",
    nextFollowUp: "Prochain rappel",
    actions: "Actions",
    createTitle: "Nouveau prospect",
    editTitle: "Modifier le prospect",
    createDescription: "Fiche simple: qui est le prospect, quel est son besoin, combien, et quand relancer.",
    editDescription: "Modifiez uniquement les informations utiles au suivi commercial.",
    contactPerson: "Contact",
    phone: "Téléphone",
    budgetLabel: "Budget (DT)",
    nextFollowUpField: "Date de rappel",
    requestedWorkField: "Travaux demandés",
    requestedPlaceholder: "Pergola, charpente, escalier, garde-corps, portail...",
    cancel: "Annuler",
    saving: "Enregistrement...",
    createAction: "Créer le prospect",
    updateAction: "Enregistrer les modifications",
    total: "Total prospects",
    toFollow: "À relancer",
    quoted: "Devis envoyés",
    won: "Gagnés",
    selectAll: "Tout sélectionner",
  };

  useEffect(() => {
    void loadLeads();
  }, []);

  async function loadLeads() {
    setLoading(true);
    setPageError("");

    try {
      const response = await apiClient.get<PaginatedResponse<LeadRecord>>("/crm/leads", {
        page: 1,
        pageSize: 100,
      });
      setLeads(response.data);
    } catch (error) {
      setPageError(getApiErrorMessage(error, text.pageError));
    } finally {
      setLoading(false);
    }
  }

  const visibleRows = useMemo(() => {
    const baseRows = filter === "upcoming" ? leads.filter((lead) => isUpcomingFollowUp(lead.followUp)) : leads;
    const term = search.trim().toLowerCase();

    return [...baseRows]
      .filter((lead) => {
        const matchesSearch =
          !term ||
          [
            lead.prospect,
            lead.contactPerson,
            lead.phone,
            lead.requestedWork,
            lead.assignedTo,
            lead.source,
          ]
            .join(" ")
            .toLowerCase()
            .includes(term);
        const matchesStatus = statusFilter === "ALL" || lead.status === statusFilter;
        const matchesOwner = ownerFilter === "ALL" || lead.assignedTo === ownerFilter;
        return matchesSearch && matchesStatus && matchesOwner;
      })
      .sort((left, right) => left.followUp.localeCompare(right.followUp));
  }, [filter, leads, ownerFilter, search, statusFilter]);

  const ownerOptions = useMemo(
    () => Array.from(new Set(leads.map((lead) => lead.assignedTo))).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [leads],
  );

  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row.id));
  const totalBudget = visibleRows.reduce((sum, lead) => sum + parseLeadBudget(lead.budget), 0);
  const followUpCount = visibleRows.filter((lead) => isUpcomingFollowUp(lead.followUp)).length;
  const quotedCount = visibleRows.filter((lead) => lead.status === "QUOTED").length;
  const wonCount = visibleRows.filter((lead) => lead.status === "WON").length;
  const isDialogDirty =
    dialogMode !== null && dialogInitialRef.current !== null && dialogInitialRef.current !== JSON.stringify(leadForm);

  function openCreateDialog() {
    setDialogMode("create");
    setEditingLeadId(null);
    setLeadForm(defaultLeadForm);
    setDialogError("");
    setSubmitting(false);
    dialogInitialRef.current = JSON.stringify(defaultLeadForm);
  }

  function openEditDialog(lead: LeadRecord) {
    const nextForm: LeadFormState = {
      prospect: lead.prospect,
      source: toLeadSource(lead.source),
      contactPerson: lead.contactPerson,
      phone: lead.phone,
      status: lead.status,
      budget: normalizeLeadBudgetInput(lead.budget),
      followUp: lead.followUp === "-" ? new Date().toISOString().slice(0, 10) : lead.followUp,
      requestedWork: lead.requestedWork === "-" ? "" : lead.requestedWork,
    };

    setDialogMode("edit");
    setEditingLeadId(lead.id);
    setLeadForm(nextForm);
    setDialogError("");
    setSubmitting(false);
    dialogInitialRef.current = JSON.stringify(nextForm);
  }

  function closeDialog() {
    setDialogMode(null);
    setEditingLeadId(null);
    setLeadForm(defaultLeadForm);
    setDialogError("");
    setSubmitting(false);
    dialogInitialRef.current = null;
  }

  function toggleSelection(leadId: string) {
    setSelectedIds((current) =>
      current.includes(leadId) ? current.filter((id) => id !== leadId) : [...current, leadId],
    );
  }

  function toggleSelectAllVisible() {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleRows.some((row) => row.id === id))
        : Array.from(new Set([...current, ...visibleRows.map((row) => row.id)])),
    );
  }

  async function handleSaveLead() {
    if (
      !leadForm.prospect.trim() ||
      !leadForm.contactPerson.trim() ||
      !leadForm.phone.trim() ||
      !leadForm.requestedWork.trim()
    ) {
      setDialogError(text.requiredError);
      return;
    }

    setSubmitting(true);
    setDialogError("");

    const payload = {
      prospect: leadForm.prospect.trim(),
      source: leadForm.source,
      contactPerson: leadForm.contactPerson.trim(),
      phone: leadForm.phone.trim(),
      status: leadForm.status,
      budget: parseLeadBudget(leadForm.budget),
      followUp: leadForm.followUp,
      requestedWork: leadForm.requestedWork.trim(),
    };

    try {
      if (dialogMode === "edit" && editingLeadId) {
        const updated = await apiClient.patch<LeadRecord>(`/crm/leads/${editingLeadId}`, payload);
        setLeads((current) => current.map((lead) => (lead.id === editingLeadId ? updated : lead)));
        setFeedback(text.updated);
      } else {
        const created = await apiClient.post<LeadRecord>("/crm/leads", payload);
        setLeads((current) => [created, ...current]);
        setFeedback(text.created);
      }

      closeDialog();
    } catch (error) {
      setDialogError(getApiErrorMessage(error, text.saveError));
      setSubmitting(false);
    }
  }

  async function handleDeleteLead(leadId: string) {
    const confirmed = await confirm({
      title: "Supprimer ce prospect ?",
      description: "Le prospect sera supprimé définitivement.",
      confirmLabel: "Supprimer le prospect",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    try {
      await apiClient.del<{ success: boolean }>(`/crm/leads/${leadId}`);
      setLeads((current) => current.filter((lead) => lead.id !== leadId));
      setSelectedIds((current) => current.filter((id) => id !== leadId));
      setFeedback(text.deleted);
    } catch (error) {
      setPageError(getApiErrorMessage(error, text.deleteError));
    }
  }

  async function handleBulkDelete() {
    if (!selectedIds.length) {
      return;
    }

    const confirmed = await confirm({
      title: `Supprimer ${selectedIds.length} prospect(s) ?`,
      description: "Les prospects sélectionnés seront supprimés définitivement.",
      confirmLabel: "Supprimer la sélection",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    try {
      await Promise.all(selectedIds.map((id) => apiClient.del<{ success: boolean }>(`/crm/leads/${id}`)));
      setLeads((current) => current.filter((lead) => !selectedIds.includes(lead.id)));
      setSelectedIds([]);
      setFeedback(text.deletedMany);
    } catch (error) {
      setPageError(getApiErrorMessage(error, text.bulkDeleteError));
    }
  }

  if (loading) {
    return (
      <div className="rounded-[1.75rem] border border-black/6 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Chargement de l'espace prospects...
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
        {pageError}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6">
        {filter === "upcoming" ? (
          <FilterBanner label={text.upcomingLabel} description={text.upcomingDesc} clearHref="/crm/leads" />
        ) : null}

        <WorkspaceHero
          eyebrow="CRM"
          title={text.title}
          description={text.description}
          note={text.note}
          actions={
            <>
              <Button variant="outline" asChild className="rounded-2xl">
                <Link href="/crm/leads?filter=upcoming">{text.upcomingLabel}</Link>
              </Button>
              <Button type="button" className="rounded-2xl" onClick={openCreateDialog}>
                <Plus className="h-4 w-4" />
                {text.newLead}
              </Button>
            </>
          }
          metrics={[
            { label: text.total, value: String(visibleRows.length) },
            { label: text.toFollow, value: String(followUpCount), tone: "warning" },
            { label: text.quoted, value: String(quotedCount), tone: "accent" },
            { label: "Budget", value: formatLeadBudget(totalBudget), tone: "accent" },
          ]}
        />

        {feedback ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {feedback}
          </div>
        ) : null}

        <Card className="border-[#ddd3c3] bg-[#fffdfa]">
          <CardContent className="grid gap-4 pt-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_220px_220px_auto] lg:items-end">
              <FormField label={text.searchLabel}>
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={text.searchPlaceholder}
                  className="h-11 rounded-2xl"
                />
              </FormField>
              <FormField label={text.statusLabel}>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as "ALL" | LeadStatus)}
                  className="flex h-11 w-full rounded-2xl border border-input bg-background px-3 text-sm"
                >
                  <option value="ALL">{text.allStatuses}</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatLeadStatus(status)}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label={text.ownerLabel}>
                <select
                  value={ownerFilter}
                  onChange={(event) => setOwnerFilter(event.target.value)}
                  className="flex h-11 w-full rounded-2xl border border-input bg-background px-3 text-sm"
                >
                  <option value="ALL">{text.allOwners}</option>
                  {ownerOptions.map((owner) => (
                    <option key={owner} value={owner}>
                      {owner}
                    </option>
                  ))}
                </select>
              </FormField>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("ALL");
                  setOwnerFilter("ALL");
                }}
              >
                {text.clearFilters}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-[#ddd3c3] bg-[#fffdfa]">
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7dece] bg-[#f8f2e8] px-6 py-4">
              <div>
                <p className="text-xl font-semibold text-slate-900">{text.tableTitle}</p>
                <p className="mt-1 text-sm text-slate-500">Sélection, modification et suppression depuis une seule table.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedIds.length ? (
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={handleBulkDelete}>
                    <Trash2 className="h-4 w-4" />
                    {text.bulkDelete} ({selectedIds.length})
                  </Button>
                ) : null}
                <Button type="button" className="rounded-2xl" onClick={openCreateDialog}>
                  <Plus className="h-4 w-4" />
                  {text.newLead}
                </Button>
              </div>
            </div>

            {visibleRows.length ? (
              <div className="overflow-auto">
                <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr>
                      <th className="border-b border-[#e7dece] px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={text.selectAll}
                          checked={allVisibleSelected}
                          onChange={toggleSelectAllVisible}
                        />
                      </th>
                      {[
                        text.prospectName,
                        text.source,
                        text.status,
                        text.requestedWork,
                        text.budget,
                        text.assignedTo,
                        text.nextFollowUp,
                        text.actions,
                      ].map((label) => (
                        <th
                          key={label}
                          className="border-b border-[#e7dece] px-4 py-3 font-medium uppercase tracking-[0.14em] text-slate-400"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((lead) => (
                      <tr key={lead.id} className="odd:bg-[#fffaf4] hover:bg-[#f6efe2]/70">
                        <td className="border-b border-[#ece3d4] px-4 py-3 align-middle">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(lead.id)}
                            onChange={() => toggleSelection(lead.id)}
                            aria-label={`Sélectionner ${lead.prospect}`}
                          />
                        </td>
                        <td className="border-b border-[#ece3d4] px-4 py-3 align-middle">
                          <div className="min-w-[180px]">
                            <p className="font-semibold text-slate-800">{lead.prospect}</p>
                            <p className="mt-1 text-xs text-slate-500">{lead.contactPerson}</p>
                            <p className="text-xs text-slate-500">{lead.phone}</p>
                          </div>
                        </td>
                        <td className="border-b border-[#ece3d4] px-4 py-3 align-middle text-slate-700">{lead.source}</td>
                        <td className="border-b border-[#ece3d4] px-4 py-3 align-middle">
                          <StatusBadge status={lead.status} />
                        </td>
                        <td className="border-b border-[#ece3d4] px-4 py-3 align-middle text-slate-700">
                          <div className="min-w-[220px]">{lead.requestedWork}</div>
                        </td>
                        <td className="border-b border-[#ece3d4] px-4 py-3 align-middle font-semibold text-[#c45b2d]">
                          {lead.budget}
                        </td>
                        <td className="border-b border-[#ece3d4] px-4 py-3 align-middle text-slate-700">{lead.assignedTo}</td>
                        <td
                          className={cn(
                            "border-b border-[#ece3d4] px-4 py-3 align-middle whitespace-nowrap",
                            isUpcomingFollowUp(lead.followUp) ? "font-semibold text-amber-700" : "text-slate-700",
                          )}
                        >
                          {formatLeadDate(lead.followUp)}
                        </td>
                        <td className="border-b border-[#ece3d4] px-4 py-3 align-middle">
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" className="h-9 rounded-xl px-3" onClick={() => openEditDialog(lead)}>
                              <Pencil className="h-4 w-4" />
                              {text.edit}
                            </Button>
                            <Button type="button" variant="outline" className="h-9 rounded-xl px-3" onClick={() => void handleDeleteLead(lead.id)}>
                              <Trash2 className="h-4 w-4" />
                              {text.delete}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <p className="text-lg font-semibold text-slate-700">{text.emptyTitle}</p>
                <p className="mt-2 text-sm text-slate-500">{text.emptyDescription}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DialogShell
        open={dialogMode !== null}
        title={dialogMode === "edit" ? text.editTitle : text.createTitle}
        description={dialogMode === "edit" ? text.editDescription : text.createDescription}
        onClose={closeDialog}
        isDirty={isDialogDirty}
        dirtyWarningText="Des modifications non enregistrées seront perdues. Fermer ce formulaire ?"
      >
        <div className="grid gap-4">
          {dialogError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {dialogError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={text.prospectName}>
              <Input
                value={leadForm.prospect}
                onChange={(event) => setLeadForm((current) => ({ ...current, prospect: event.target.value }))}
                placeholder="Villa Chotrana"
              />
            </FormField>
            <FormField label={text.contactPerson}>
              <Input
                value={leadForm.contactPerson}
                onChange={(event) => setLeadForm((current) => ({ ...current, contactPerson: event.target.value }))}
                placeholder="Skander Nefzi"
              />
            </FormField>
            <FormField label={text.phone}>
              <Input
                value={leadForm.phone}
                onChange={(event) => setLeadForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="+216 22 000 000"
              />
            </FormField>
            <FormField label={text.source}>
              <select
                value={leadForm.source}
                onChange={(event) => setLeadForm((current) => ({ ...current, source: event.target.value as LeadSource }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {sourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label={text.status}>
              <select
                value={leadForm.status}
                onChange={(event) => setLeadForm((current) => ({ ...current, status: event.target.value as LeadStatus }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {formatLeadStatus(status)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label={text.budgetLabel}>
              <Input
                value={leadForm.budget}
                onChange={(event) => setLeadForm((current) => ({ ...current, budget: event.target.value }))}
                placeholder="18,000 DT"
              />
            </FormField>
            <FormField label={text.nextFollowUpField}>
              <Input
                type="date"
                value={leadForm.followUp}
                onChange={(event) => setLeadForm((current) => ({ ...current, followUp: event.target.value }))}
              />
            </FormField>
          </div>

          <FormField label={text.requestedWorkField}>
            <Textarea
              value={leadForm.requestedWork}
              onChange={(event) => setLeadForm((current) => ({ ...current, requestedWork: event.target.value }))}
              placeholder={text.requestedPlaceholder}
            />
          </FormField>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={closeDialog}>
              {text.cancel}
            </Button>
            <Button type="button" onClick={() => void handleSaveLead()} disabled={submitting}>
              {submitting ? text.saving : dialogMode === "edit" ? text.updateAction : text.createAction}
            </Button>
          </div>
        </div>
      </DialogShell>
      {confirmDialog}
    </>
  );
}

function parseLeadBudget(value: string) {
  const normalized = value.replace(/\s*(?:DT|TND)$/i, "").replaceAll(",", "").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLeadBudgetInput(value: string) {
  return value.replace(/\s*(?:DT|TND)$/i, "").replaceAll(",", "");
}

function formatLeadBudget(value: number) {
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })} DT`;
}

function formatLeadStatus(status: LeadStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function formatLeadDate(value: string) {
  if (!value || value === "-") {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-TN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function isUpcomingFollowUp(value: string) {
  if (!value || value === "-") {
    return false;
  }

  const followUp = new Date(`${value}T00:00:00`);
  if (Number.isNaN(followUp.getTime())) {
    return false;
  }

  const today = new Date();
  const start = new Date(`${today.toISOString().slice(0, 10)}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 2);

  return followUp <= end;
}

function toLeadSource(value: string): LeadSource {
  const normalized = value.trim().toUpperCase().replaceAll(" ", "_");
  if (normalized === "WHATSAPP") {
    return "WHATSAPP";
  }
  if (normalized === "REFERRAL") {
    return "REFERRAL";
  }
  if (normalized === "WEBSITE") {
    return "WEBSITE";
  }
  if (normalized === "PHONE" || normalized === "PHONE_CALL") {
    return "PHONE";
  }
  return "OTHER";
}

function getApiErrorMessage(error: unknown, fallback: string) {
  const apiError = error as ApiError | undefined;
  if (apiError?.error?.details?.length) {
    return apiError.error.details.map((detail) => detail.message).join(" ");
  }

  return apiError?.error?.message || fallback;
}
