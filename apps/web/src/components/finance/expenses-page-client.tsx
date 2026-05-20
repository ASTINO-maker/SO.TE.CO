"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BanknoteArrowDown,
  CalendarDays,
  CircleAlert,
  FolderKanban,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Tag,
  Trash2,
  Wallet,
} from "lucide-react";
import { FormField } from "../admin/form-field";
import { StatusBadge } from "../admin/status-badge";
import { AdminLoadingState } from "../admin/state-blocks";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { DialogShell } from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { apiClient } from "../../lib/api/client";
import type { ApiError, PaginatedResponse } from "../../lib/api/types";
import { cn } from "../../lib/utils";

interface ExpenseRow {
  id: string;
  reference: string;
  category: string;
  description: string;
  project: string;
  amount: string;
  status: string;
  date: string;
  note?: string;
  externalReference?: string;
}

type ExpenseStatusValue =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "PAID"
  | "CANCELLED";

type ExpenseFormState = {
  category: string;
  title: string;
  project: string;
  amount: string;
  status: ExpenseStatusValue;
  expenseDate: string;
  reference: string;
  description: string;
};

const EMPTY_EXPENSE_FORM = (): ExpenseFormState => ({
  category: "",
  title: "",
  project: "",
  amount: "",
  status: "DRAFT",
  expenseDate: new Date().toISOString().slice(0, 10),
  reference: "",
  description: "",
});

export function ExpensesPageClient({
  action,
  filter,
  expenseId,
}: {
  action?: string;
  filter?: string;
  expenseId?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [inlineError, setInlineError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ExpenseStatusValue>("ALL");
  const [selectedId, setSelectedId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [form, setForm] = useState<ExpenseFormState>(EMPTY_EXPENSE_FORM);
  const expenseDialogInitialRef = useRef<string | null>(null);
  const lastDialogKeyRef = useRef("");

  const text = {
    loading: "Chargement des dépenses...",
    pageFailed: "La page des dépenses n'a pas pu être chargée.",
    pageFallback: "Impossible de charger les dépenses.",
    saveFallback: "Impossible d'enregistrer la dépense.",
    deleteFallback: "Impossible de supprimer la dépense.",
    fillRequired: "Renseignez la catégorie, le titre, le montant et la date avant d'enregistrer la dépense.",
    title: "Dépenses",
    description:
      "Une vue plus claire pour distinguer les coûts chantier des charges générales, suivre leur statut et corriger rapidement une saisie.",
    note:
      "Chaque dépense doit répondre à trois questions simples: de quel type de charge s'agit-il, sur quel chantier elle tombe, et où elle en est dans la validation ou le paiement.",
    createExpense: "Nouvelle dépense",
    approvalQueue: "À valider",
    projectCosts: "Coûts chantier",
    allExpenses: "Toutes",
    search: "Rechercher une référence, une catégorie, un chantier ou une note...",
    allStatuses: "Tous les statuts",
    registerTitle: "Registre simplifié",
    emptyTitle: "Aucune dépense à afficher",
    emptyDescription:
      "Aucune dépense ne correspond aux filtres actuels. Créez une dépense ou élargissez la recherche.",
    detailTitle: "Fiche dépense",
    noSelection: "Sélectionnez une dépense pour afficher sa fiche détaillée.",
    category: "Catégorie",
    titleLabel: "Titre",
    project: "Chantier",
    amount: "Montant",
    status: "Statut",
    date: "Date",
    reference: "Référence",
    noteLabel: "Note",
    externalReference: "Référence fournisseur",
    generalProject: "Sans chantier",
    workflowTitle: "Lecture rapide",
    workflow1: "Vérifiez d'abord le type de charge et le montant.",
    workflow2: "Confirmez ensuite le chantier concerné ou la charge générale.",
    workflow3: "Terminez par le statut: brouillon, validation, approbation ou paiement.",
    createExpenseTitle: "Créer une dépense",
    editExpense: "Modifier la dépense",
    createDescription:
      "Enregistrez une charge réelle avec catégorie, montant, date, référence et chantier éventuel.",
    editDescription:
      "Corrigez la catégorie, le montant, le chantier ou le statut sans quitter le registre.",
    optionalProjectPlaceholder: "Nom du chantier (optionnel)",
    amountLabel: "Montant (DT)",
    expenseDate: "Date de dépense",
    statusDraft: "Brouillon",
    statusSubmitted: "Soumise",
    statusApproved: "Approuvée",
    statusRejected: "Refusée",
    statusPaid: "Payée",
    statusCancelled: "Annulée",
    referencePlaceholder: "Facture fournisseur, ticket carburant ou référence interne",
    descriptionLabel: "Description / note",
    cancel: "Annuler",
    saving: "Enregistrement...",
    updateExpense: "Enregistrer les modifications",
    saveExpense: "Enregistrer la dépense",
    edit: "Modifier",
    delete: "Supprimer",
    deletedSuffix: "supprimée avec succès.",
    savedSuffix: "enregistrée avec succès.",
    updatedSuffix: "mise à jour avec succès.",
    deleteConfirm:
      "Supprimer cette dépense du registre ? Cette action masque la ligne actuelle dans l'interface.",
    totalTracked: "Dépenses suivies",
    pendingApproval: "À valider",
    projectLinked: "Liées chantier",
    totalAmount: "Montant total",
    attentionCount: "À revoir",
  };

  const baseHref = filter ? `/finance/expenses?filter=${filter}` : "/finance/expenses";
  const buildHref = (nextAction?: string, id?: string) => {
    const params = new URLSearchParams();
    if (filter) {
      params.set("filter", filter);
    }
    if (nextAction) {
      params.set("action", nextAction);
    }
    if (id) {
      params.set("id", id);
    }
    const query = params.toString();
    return query ? `/finance/expenses?${query}` : "/finance/expenses";
  };

  const serializedExpenseDialogState = useMemo(() => JSON.stringify(form), [form]);
  const isExpenseDialogDirty =
    (action === "new" || action === "edit") &&
    expenseDialogInitialRef.current !== null &&
    expenseDialogInitialRef.current !== serializedExpenseDialogState;

  async function loadExpenses() {
    setLoading(true);
    setPageError("");
    setInlineError("");
    try {
      const response = await apiClient.get<PaginatedResponse<ExpenseRow> & { focus: string[] }>("/finance/expenses", {
        page: 1,
        pageSize: 100,
      });
      setRows(response.data);
      setSelectedId((current) => current || response.data[0]?.id || "");
    } catch (error) {
      const apiError = error as ApiError;
      setPageError(apiError.error?.message || text.pageFallback);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadExpenses();
  }, []);

  useEffect(() => {
    const dialogKey = `${action || ""}:${expenseId || ""}`;
    let seeded = false;

    if (action === "new" && lastDialogKeyRef.current !== dialogKey) {
      const nextForm = EMPTY_EXPENSE_FORM();
      setForm(nextForm);
      setDialogError("");
      setSubmitting(false);
      expenseDialogInitialRef.current = JSON.stringify(nextForm);
      seeded = true;
    }

    if (action === "edit" && expenseId && lastDialogKeyRef.current !== dialogKey) {
      const current = rows.find((row) => row.id === expenseId);
      if (current) {
        const nextForm = {
          category: current.category,
          title: current.description,
          project: current.project === "General" ? "" : current.project,
          amount: parseAmountText(current.amount),
          status: toExpenseStatusValue(current.status),
          expenseDate: current.date,
          reference: current.externalReference === "-" ? "" : current.externalReference || "",
          description: current.note === "-" ? "" : current.note || "",
        };
        setForm(nextForm);
        setDialogError("");
        setSubmitting(false);
        expenseDialogInitialRef.current = JSON.stringify(nextForm);
        seeded = true;
      }
    }

    if (action !== "new" && action !== "edit") {
      expenseDialogInitialRef.current = null;
      lastDialogKeyRef.current = "";
      return;
    }

    if (seeded) {
      lastDialogKeyRef.current = dialogKey;
    }
  }, [action, expenseId, rows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const normalizedStatus = toExpenseStatusValue(row.status);
      const matchesFilter =
        filter === "approval"
          ? normalizedStatus === "DRAFT" || normalizedStatus === "SUBMITTED"
          : filter === "project"
            ? row.project !== "General"
            : true;
      const matchesStatus = statusFilter === "ALL" || normalizedStatus === statusFilter;
      const matchesSearch =
        !term ||
        [row.reference, row.category, row.description, row.project, row.amount, row.externalReference, row.note]
          .join(" ")
          .toLowerCase()
          .includes(term);
      return matchesFilter && matchesStatus && matchesSearch;
    });
  }, [filter, rows, search, statusFilter]);

  const selectedExpense =
    filteredRows.find((row) => row.id === selectedId) ??
    rows.find((row) => row.id === selectedId) ??
    filteredRows[0] ??
    rows[0] ??
    null;

  const totalExpenseAmount = rows.reduce(
    (sum, row) => sum + Number.parseFloat(parseAmountText(row.amount) || "0"),
    0,
  );
  const pendingApprovalCount = rows.filter((row) => {
    const status = toExpenseStatusValue(row.status);
    return status === "DRAFT" || status === "SUBMITTED";
  }).length;
  const projectLinkedCount = rows.filter((row) => row.project !== "General").length;
  const attentionCount = rows.filter((row) => {
    const status = toExpenseStatusValue(row.status);
    return status === "REJECTED" || status === "CANCELLED";
  }).length;

  async function handleSaveExpense() {
    if (!form.category.trim() || !form.title.trim() || !form.amount.trim() || !form.expenseDate) {
      setDialogError(text.fillRequired);
      return;
    }

    setSubmitting(true);
    setDialogError("");
    setInlineError("");

    const payload = {
      category: form.category.trim(),
      title: form.title.trim(),
      project: form.project.trim() || undefined,
      amount: form.amount.trim(),
      status: form.status,
      expenseDate: form.expenseDate,
      reference: form.reference.trim() || undefined,
      description: form.description.trim() || undefined,
    };

    try {
      if (action === "edit" && expenseId) {
        const updated = await apiClient.patch<ExpenseRow>(`/finance/expenses/${expenseId}`, payload);
        setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
        setSelectedId(updated.id);
        setFeedback(`${updated.reference} ${text.updatedSuffix}`);
      } else {
        const created = await apiClient.post<ExpenseRow>("/finance/expenses", payload);
        setRows((current) => [created, ...current]);
        setSelectedId(created.id);
        setFeedback(`${created.reference} ${text.savedSuffix}`);
      }
      expenseDialogInitialRef.current = null;
      router.replace(baseHref, { scroll: false });
    } catch (error) {
      const apiError = error as ApiError;
      setDialogError(apiError.error?.details?.[0]?.message || apiError.error?.message || text.saveFallback);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteExpense(expense: ExpenseRow) {
    if (!window.confirm(text.deleteConfirm)) {
      return;
    }

    setDeletingExpenseId(expense.id);
    setInlineError("");
    try {
      await apiClient.del<{ success: boolean }>(`/finance/expenses/${expense.id}`);
      setRows((current) => current.filter((row) => row.id !== expense.id));
      setFeedback(`${expense.reference} ${text.deletedSuffix}`);
      if (selectedId === expense.id) {
        setSelectedId("");
      }
      if (action === "edit" && expenseId === expense.id) {
        router.replace(baseHref, { scroll: false });
      }
    } catch (error) {
      const apiError = error as ApiError;
      setInlineError(apiError.error?.message || text.deleteFallback);
    } finally {
      setDeletingExpenseId(null);
    }
  }

  function closeExpenseDialog() {
    setDialogError("");
    setSubmitting(false);
    expenseDialogInitialRef.current = null;
    router.replace(baseHref, { scroll: false });
  }

  if (loading) {
    return <AdminLoadingState label={text.loading} />;
  }

  if (pageError) {
    return (
      <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
        <p className="font-medium">{text.pageFailed}</p>
        <p className="mt-2">{pageError}</p>
        <Button type="button" className="mt-4 rounded-2xl" onClick={() => void loadExpenses()}>
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6">
        <section className="rounded-[1.75rem] border border-black/6 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8d6a2d]">Finance</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{text.title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{text.description}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" asChild className="rounded-2xl">
                <Link href="/finance/expenses?filter=approval">{text.approvalQueue}</Link>
              </Button>
              <Button variant="outline" asChild className="rounded-2xl">
                <Link href="/finance/expenses?filter=project">{text.projectCosts}</Link>
              </Button>
              <Button asChild className="rounded-2xl bg-[#2f4156] hover:bg-[#253548]">
                <Link href={buildHref("new")}>
                  <Plus className="h-4 w-4" />
                  {text.createExpense}
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label={text.totalTracked} value={String(rows.length)} icon={<ReceiptText className="h-4 w-4" />} />
              <SummaryCard label={text.pendingApproval} value={String(pendingApprovalCount)} tone="warning" icon={<CircleAlert className="h-4 w-4" />} />
              <SummaryCard label={text.projectLinked} value={String(projectLinkedCount)} icon={<FolderKanban className="h-4 w-4" />} />
              <SummaryCard
                label={text.totalAmount}
                value={`${new Intl.NumberFormat("fr-TN").format(totalExpenseAmount)} DT`}
                tone="success"
                icon={<Wallet className="h-4 w-4" />}
              />
            </div>

            <div className="rounded-[1.4rem] border border-[#ead8bc] bg-[#fffaf1] p-4">
              <p className="text-sm font-semibold text-slate-900">{text.workflowTitle}</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <p>{text.workflow1}</p>
                <p>{text.workflow2}</p>
                <p>{text.workflow3}</p>
                {attentionCount ? <p className="font-medium text-rose-700">{attentionCount} dépense(s) à revoir.</p> : null}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-5">
            <section className="rounded-[1.75rem] border border-black/6 bg-white p-5 shadow-sm">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,0.9fr)]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-11 rounded-2xl border-black/8 bg-[#fcfbf8] pl-11 shadow-none"
                    placeholder={text.search}
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as "ALL" | ExpenseStatusValue)}
                  className="flex h-11 w-full rounded-2xl border border-black/8 bg-[#fcfbf8] px-3 text-sm text-slate-700"
                >
                  <option value="ALL">{text.allStatuses}</option>
                  <option value="DRAFT">{text.statusDraft}</option>
                  <option value="SUBMITTED">{text.statusSubmitted}</option>
                  <option value="APPROVED">{text.statusApproved}</option>
                  <option value="REJECTED">{text.statusRejected}</option>
                  <option value="PAID">{text.statusPaid}</option>
                  <option value="CANCELLED">{text.statusCancelled}</option>
                </select>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { label: text.allExpenses, href: "/finance/expenses", active: !filter },
                  { label: text.approvalQueue, href: "/finance/expenses?filter=approval", active: filter === "approval" },
                  { label: text.projectCosts, href: "/finance/expenses?filter=project", active: filter === "project" },
                ].map((item) => (
                  <Button
                    key={item.label}
                    asChild
                    variant={item.active ? "default" : "outline"}
                    className={cn("rounded-2xl", item.active && "bg-[#2f4156] hover:bg-[#253548]")}
                  >
                    <Link href={item.href}>{item.label}</Link>
                  </Button>
                ))}
              </div>
            </section>

            <Card className="overflow-hidden border-black/6 shadow-sm">
              <CardContent className="p-0">
                <div className="flex items-center justify-between gap-3 border-b border-black/6 bg-[#fcfbf8] px-5 py-4">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{text.registerTitle}</p>
                    <p className="mt-1 text-sm text-slate-500">{filteredRows.length} dépense(s) visibles</p>
                  </div>
                </div>

                {filteredRows.length ? (
                  <div className="divide-y divide-black/6">
                    {filteredRows.map((expense) => {
                      const isActive = selectedExpense?.id === expense.id;
                      const projectLabel = expense.project === "General" ? text.generalProject : expense.project;
                      return (
                        <div
                          key={expense.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedId(expense.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedId(expense.id);
                            }
                          }}
                          className={cn(
                            "grid cursor-pointer gap-4 px-5 py-4 transition-colors hover:bg-[#faf7f1]",
                            isActive && "bg-[#f4efe5]",
                          )}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-semibold text-slate-900">{expense.reference}</p>
                                <StatusBadge status={expense.status} />
                              </div>
                              <p className="mt-2 text-sm font-medium text-slate-700">{expense.description}</p>
                              <p className="mt-1 text-sm text-slate-500">{expense.category} · {projectLabel}</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9 rounded-xl px-3"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  router.push(buildHref("edit", expense.id));
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                                {text.edit}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9 rounded-xl px-3 text-rose-700 hover:text-rose-800"
                                disabled={deletingExpenseId === expense.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleDeleteExpense(expense);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                {text.delete}
                              </Button>
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-4">
                            <MiniInfo label={text.amount} value={expense.amount} emphasis />
                            <MiniInfo label={text.date} value={expense.date} />
                            <MiniInfo label={text.externalReference} value={expense.externalReference && expense.externalReference !== "-" ? expense.externalReference : "Non renseignée"} />
                            <MiniInfo label={text.project} value={projectLabel} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-5 py-12 text-center">
                    <p className="text-base font-semibold text-slate-800">{text.emptyTitle}</p>
                    <p className="mt-2 text-sm text-slate-500">{text.emptyDescription}</p>
                    <Button asChild className="mt-4 rounded-2xl bg-[#2f4156] hover:bg-[#253548]">
                      <Link href={buildHref("new")}>{text.createExpense}</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {feedback ? (
              <div className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {feedback}
              </div>
            ) : null}

            {inlineError ? (
              <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {inlineError}
              </div>
            ) : null}
          </div>

          <aside className="rounded-[1.75rem] border border-black/6 bg-white shadow-sm">
            {selectedExpense ? (
              <div className="flex h-full flex-col">
                <div className="border-b border-black/6 px-6 py-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium uppercase tracking-[0.14em] text-slate-400">{text.detailTitle}</p>
                      <h2 className="mt-2 text-2xl font-semibold text-slate-900">{selectedExpense.reference}</h2>
                      <p className="mt-1 text-sm text-slate-500">{selectedExpense.category}</p>
                    </div>
                    <StatusBadge status={selectedExpense.status} />
                  </div>

                  <div className="mt-5 rounded-[1.4rem] border border-black/6 bg-[#fcfbf8] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{text.amount}</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">{selectedExpense.amount}</p>
                    <p className="mt-2 text-sm text-slate-500">{selectedExpense.description}</p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="rounded-2xl" onClick={() => router.push(buildHref("edit", selectedExpense.id))}>
                      <Pencil className="h-4 w-4" />
                      {text.edit}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl text-rose-700 hover:text-rose-800"
                      disabled={deletingExpenseId === selectedExpense.id}
                      onClick={() => void handleDeleteExpense(selectedExpense)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {text.delete}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-6 px-6 py-6">
                  <DetailBlock
                    title="Fiche dépense"
                    items={[
                      { icon: <Tag className="h-4 w-4 text-slate-400" />, label: text.category, value: selectedExpense.category },
                      { icon: <FolderKanban className="h-4 w-4 text-slate-400" />, label: text.project, value: selectedExpense.project === "General" ? text.generalProject : selectedExpense.project },
                      { icon: <CalendarDays className="h-4 w-4 text-slate-400" />, label: text.date, value: selectedExpense.date },
                      { icon: <BanknoteArrowDown className="h-4 w-4 text-slate-400" />, label: text.externalReference, value: selectedExpense.externalReference && selectedExpense.externalReference !== "-" ? selectedExpense.externalReference : "Non renseignée" },
                    ]}
                  />

                  <div className="rounded-2xl border border-black/6 bg-[#fcfbf8] p-5">
                    <p className="text-sm font-semibold text-slate-900">{text.titleLabel}</p>
                    <p className="mt-3 text-sm text-slate-700">{selectedExpense.description}</p>
                  </div>

                  <div className="rounded-2xl border border-black/6 bg-[#fcfbf8] p-5">
                    <p className="text-sm font-semibold text-slate-900">{text.noteLabel}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {selectedExpense.note?.trim() && selectedExpense.note !== "-"
                        ? selectedExpense.note
                        : "Aucune note complémentaire sur cette dépense."}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-6 py-8 text-sm text-slate-500">{text.noSelection}</div>
            )}
          </aside>
        </div>
      </div>

      <DialogShell
        open={action === "new" || action === "edit"}
        title={action === "edit" ? text.editExpense : text.createExpenseTitle}
        description={action === "edit" ? text.editDescription : text.createDescription}
        onClose={closeExpenseDialog}
        isDirty={isExpenseDialogDirty}
        dirtyWarningText="Des modifications non enregistrees seront perdues. Fermer ce formulaire ?"
      >
        <div className="grid gap-4">
          {dialogError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {dialogError}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={text.category}>
              <Input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
            </FormField>
            <FormField label={text.titleLabel}>
              <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </FormField>
            <FormField label={text.project}>
              <Input
                value={form.project}
                onChange={(event) => setForm((current) => ({ ...current, project: event.target.value }))}
                placeholder={text.optionalProjectPlaceholder}
              />
            </FormField>
            <FormField label={text.amountLabel}>
              <Input value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
            </FormField>
            <FormField label={text.expenseDate}>
              <Input type="date" value={form.expenseDate} onChange={(event) => setForm((current) => ({ ...current, expenseDate: event.target.value }))} />
            </FormField>
            <FormField label={text.status}>
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ExpenseStatusValue }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="DRAFT">{text.statusDraft}</option>
                <option value="SUBMITTED">{text.statusSubmitted}</option>
                <option value="APPROVED">{text.statusApproved}</option>
                <option value="REJECTED">{text.statusRejected}</option>
                <option value="PAID">{text.statusPaid}</option>
                <option value="CANCELLED">{text.statusCancelled}</option>
              </select>
            </FormField>
            <FormField label={text.reference}>
              <Input
                value={form.reference}
                onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))}
                placeholder={text.referencePlaceholder}
              />
            </FormField>
          </div>
          <FormField label={text.descriptionLabel}>
            <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </FormField>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" type="button" className="rounded-2xl" onClick={closeExpenseDialog}>
              {text.cancel}
            </Button>
            <Button type="button" className="rounded-2xl" onClick={() => void handleSaveExpense()} disabled={submitting}>
              {submitting ? text.saving : action === "edit" ? text.updateExpense : text.saveExpense}
            </Button>
          </div>
        </div>
      </DialogShell>
    </>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  return (
    <div className="rounded-[1.3rem] border border-black/6 bg-[#fcfbf8] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <div
          className={cn(
            "rounded-full p-2 text-slate-500",
            tone === "success" && "bg-emerald-100 text-emerald-700",
            tone === "warning" && "bg-amber-100 text-amber-800",
            tone === "danger" && "bg-rose-100 text-rose-700",
          )}
        >
          {icon}
        </div>
      </div>
      <p
        className={cn(
          "mt-4 text-[1.85rem] font-semibold leading-none text-slate-900",
          tone === "success" && "text-emerald-700",
          tone === "warning" && "text-amber-700",
          tone === "danger" && "text-rose-700",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function MiniInfo({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-xl border border-black/6 bg-[#fcfbf8] px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={cn("mt-2 text-sm text-slate-700", emphasis && "font-semibold text-slate-900")}>{value}</p>
    </div>
  );
}

function DetailBlock({
  title,
  items,
}: {
  title: string;
  items: Array<{ icon: ReactNode; label: string; value: string }>;
}) {
  return (
    <div className="rounded-2xl border border-black/6 bg-[#fcfbf8] p-5">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <div key={`${item.label}:${item.value}`}>
            <p className="text-sm font-medium text-slate-500">{item.label}</p>
            <div className="mt-2 flex items-start gap-2 text-sm text-slate-800">
              {item.icon}
              <span>{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function parseAmountText(value: string) {
  return value.replace(/\s+(?:TND|DT)$/i, "").replaceAll(",", "");
}

function toExpenseStatusValue(value: string): ExpenseStatusValue {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_");
  if (
    normalized === "DRAFT" ||
    normalized === "SUBMITTED" ||
    normalized === "APPROVED" ||
    normalized === "REJECTED" ||
    normalized === "PAID" ||
    normalized === "CANCELLED"
  ) {
    return normalized;
  }
  return "DRAFT";
}
