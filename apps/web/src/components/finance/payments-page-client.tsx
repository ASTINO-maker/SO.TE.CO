"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  BadgeDollarSign,
  CalendarDays,
  CircleAlert,
  Landmark,
  Pencil,
  Plus,
  Receipt,
  Search,
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

interface PaymentRow {
  id: string;
  reference: string;
  client: string;
  method: string;
  status: string;
  amount: string;
  allocations: string;
  paidAt: string;
  note?: string;
  project?: string;
  sourceReference?: string;
}

interface ClientOption {
  id: string;
  name: string;
}

interface ProjectOption {
  id: string;
  title: string;
}

type PaymentMethodValue = "CASH" | "BANK_TRANSFER" | "CHECK" | "CARD" | "OTHER";
type PaymentStatusValue =
  | "CONFIRMED"
  | "PARTIALLY_ALLOCATED"
  | "ALLOCATED"
  | "PENDING"
  | "FAILED"
  | "REFUNDED"
  | "CANCELLED";

interface PaymentFormState {
  client: string;
  project: string;
  method: PaymentMethodValue;
  status: PaymentStatusValue;
  amount: string;
  paymentDate: string;
  reference: string;
  note: string;
}

const EMPTY_PAYMENT_FORM = (): PaymentFormState => ({
  client: "",
  project: "",
  method: "BANK_TRANSFER",
  status: "CONFIRMED",
  amount: "",
  paymentDate: new Date().toISOString().slice(0, 10),
  reference: "",
  note: "",
});

export function PaymentsPageClient({
  action,
  filter,
  paymentId,
}: {
  action?: string;
  filter?: string;
  paymentId?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<"ALL" | PaymentMethodValue>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PaymentStatusValue>("ALL");
  const [selectedId, setSelectedId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<PaymentFormState>(EMPTY_PAYMENT_FORM);
  const paymentDialogInitialRef = useRef<string | null>(null);
  const lastDialogKeyRef = useRef("");

  const text = {
    loading: "Chargement des paiements...",
    failedTitle: "La page des paiements n'a pas pu être chargée.",
    failedFallback: "Impossible de charger les paiements.",
    retry: "Réessayer",
    title: "Paiements clients",
    description:
      "Une vue plus simple pour vérifier d'où vient l'encaissement, quel montant a été reçu, et si le paiement est déjà affecté.",
    note:
      "Le gérant doit pouvoir lire un paiement en quelques secondes: client, montant, méthode, chantier éventuel, référence bancaire et état d'affectation.",
    create: "Nouveau paiement",
    workerPage: "Paiements ouvriers",
    unallocated: "Non affectés",
    today: "Aujourd'hui",
    all: "Tous",
    search: "Rechercher un reçu, un client, une référence bancaire...",
    allMethods: "Toutes les méthodes",
    allStatuses: "Tous les statuts",
    listTitle: "Registre simplifié",
    emptyTitle: "Aucun paiement à afficher",
    emptyDescription:
      "Aucun encaissement ne correspond aux filtres actuels. Enregistrez un paiement ou élargissez la recherche.",
    quickGuideTitle: "Lecture rapide",
    quickGuide1: "Vérifiez d'abord le client et le montant.",
    quickGuide2: "Confirmez la référence bancaire ou le reçu.",
    quickGuide3: "Terminez par l'affectation à la facture quand elle existe.",
    detailTitle: "Détail du paiement",
    noSelection: "Sélectionnez un paiement pour afficher sa fiche détaillée.",
    internalRef: "Référence interne",
    client: "Client",
    method: "Méthode",
    status: "Statut",
    amount: "Montant",
    allocations: "Affectation",
    paidAt: "Date de paiement",
    project: "Chantier",
    externalRef: "Référence saisie",
    internalNote: "Note interne",
    pendingAllocations: "À affecter",
    linkedInvoice: "Facture liée",
    recordTitle: "Nouveau paiement",
    recordDescription: "Ajoutez un encaissement et enregistrez-le immédiatement dans le registre financier.",
    editTitle: "Modifier le paiement",
    editDescription: "Corrigez le client, le montant, la date ou la référence sans quitter le registre.",
    projectOptional: "Chantier (optionnel)",
    generalNoProject: "Sans chantier",
    paymentDate: "Date du paiement",
    referencePlaceholder: "Référence bancaire, reçu ou chèque",
    internalNotePlaceholder: "Contexte d'encaissement, précision comptable, remarque du gérant...",
    amountPlaceholder: "12500",
    cancel: "Annuler",
    save: "Enregistrer",
    update: "Enregistrer les modifications",
    saving: "Enregistrement...",
    savedCreate: "enregistré avec succès.",
    savedUpdate: "mis à jour avec succès.",
    failedSave: "Impossible d'enregistrer le paiement.",
    failedDelete: "Impossible de supprimer le paiement.",
    deleted: "supprimé avec succès.",
    deleteConfirm:
      "Supprimer ce paiement du registre ? Cette action masque la ligne actuelle dans l'interface.",
    edit: "Modifier",
    remove: "Supprimer",
    totalTracked: "Paiements suivis",
    unallocatedCount: "À affecter",
    confirmedAmount: "Montant confirmé",
    attentionCount: "À revoir",
  };

  const baseHref = filter ? `/finance/payments?filter=${filter}` : "/finance/payments";
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
    return query ? `/finance/payments?${query}` : "/finance/payments";
  };

  const serializedPaymentDialogState = useMemo(() => JSON.stringify(form), [form]);
  const isPaymentDialogDirty =
    (action === "record" || action === "edit") &&
    paymentDialogInitialRef.current !== null &&
    paymentDialogInitialRef.current !== serializedPaymentDialogState;

  async function loadData() {
    setLoading(true);
    setPageError("");

    try {
      const [paymentsResponse, clientsResponse, projectsResponse] = await Promise.all([
        apiClient.get<PaginatedResponse<PaymentRow>>("/sales/payments", { page: 1, pageSize: 80 }),
        apiClient.get<PaginatedResponse<{ id: string; name: string }>>("/crm/clients", { page: 1, pageSize: 80 }),
        apiClient.get<PaginatedResponse<{ id: string; title: string }>>("/projects", { page: 1, pageSize: 80 }),
      ]);

      setRows(paymentsResponse.data);
      setClients(clientsResponse.data);
      setProjects(projectsResponse.data);
      setSelectedId((current) => current || paymentsResponse.data[0]?.id || "");
      setForm((current) => ({
        ...current,
        client: current.client || clientsResponse.data[0]?.name || "",
      }));
    } catch (error) {
      setPageError(getApiErrorMessage(error, text.failedFallback));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const dialogKey = `${action || ""}:${paymentId || ""}`;
    let seeded = false;

    if (action === "record" && lastDialogKeyRef.current !== dialogKey) {
      const nextForm = {
        ...EMPTY_PAYMENT_FORM(),
        client: clients[0]?.name || "",
      };
      setForm(nextForm);
      setFormError("");
      setSubmitting(false);
      paymentDialogInitialRef.current = JSON.stringify(nextForm);
      seeded = true;
    }

    if (action === "edit" && paymentId && lastDialogKeyRef.current !== dialogKey) {
      const payment = rows.find((row) => row.id === paymentId);
      if (payment) {
        const nextForm = {
          client: payment.client,
          project: payment.project === "General" ? "" : payment.project || "",
          method: toPaymentMethodValue(payment.method),
          status: toPaymentStatusValue(payment.status),
          amount: parseAmountText(payment.amount),
          paymentDate: payment.paidAt,
          reference: payment.sourceReference === "-" ? "" : payment.sourceReference || "",
          note: payment.note || "",
        };
        setForm(nextForm);
        setFormError("");
        setSubmitting(false);
        paymentDialogInitialRef.current = JSON.stringify(nextForm);
        seeded = true;
      }
    }

    if (action !== "record" && action !== "edit") {
      paymentDialogInitialRef.current = null;
      lastDialogKeyRef.current = "";
      return;
    }

    if (seeded) {
      lastDialogKeyRef.current = dialogKey;
    }
  }, [action, clients, paymentId, rows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((row) => {
      const normalizedMethod = toPaymentMethodValue(row.method);
      const normalizedStatus = toPaymentStatusValue(row.status);
      const matchesText =
        !term ||
        [row.reference, row.client, row.method, row.allocations, row.sourceReference, row.project, row.note]
          .join(" ")
          .toLowerCase()
          .includes(term);
      const matchesMethod = methodFilter === "ALL" || normalizedMethod === methodFilter;
      const matchesStatus = statusFilter === "ALL" || normalizedStatus === statusFilter;
      const matchesFocus =
        filter === "unallocated"
          ? row.allocations === "Pending allocation"
          : filter === "today"
            ? row.paidAt === new Date().toISOString().slice(0, 10)
            : true;

      return matchesText && matchesMethod && matchesStatus && matchesFocus;
    });
  }, [filter, methodFilter, rows, search, statusFilter]);

  const selectedPayment =
    filteredRows.find((row) => row.id === selectedId) ??
    rows.find((row) => row.id === selectedId) ??
    filteredRows[0] ??
    rows[0] ??
    null;

  const totalConfirmedAmount = rows
    .filter((row) => {
      const normalized = toPaymentStatusValue(row.status);
      return normalized === "CONFIRMED" || normalized === "ALLOCATED" || normalized === "PARTIALLY_ALLOCATED";
    })
    .reduce((sum, row) => sum + Number.parseFloat(parseAmountText(row.amount) || "0"), 0);

  const unallocatedCount = rows.filter((row) => row.allocations === "Pending allocation").length;
  const attentionCount = rows.filter((row) => {
    const normalized = toPaymentStatusValue(row.status);
    return normalized === "PENDING" || normalized === "FAILED" || normalized === "CANCELLED";
  }).length;

  async function handleSavePayment() {
    if (!form.client.trim() || !form.amount.trim() || !form.paymentDate) {
      setFormError("Renseignez au minimum le client, le montant et la date du paiement.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      const payload = {
        client: form.client.trim(),
        project: form.project.trim() || undefined,
        method: form.method,
        status: form.status,
        amount: Number(form.amount),
        paymentDate: new Date(form.paymentDate).toISOString(),
        reference: form.reference.trim() || undefined,
        note: form.note.trim() || undefined,
      };

      if (action === "edit" && paymentId) {
        const updated = await apiClient.patch<PaymentRow>(`/sales/payments/${paymentId}`, payload);
        setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
        setSelectedId(updated.id);
        setFeedback(`${updated.reference} ${text.savedUpdate}`);
      } else {
        const created = await apiClient.post<PaymentRow>("/sales/payments", payload);
        setRows((current) => [created, ...current]);
        setSelectedId(created.id);
        setFeedback(`${created.reference} ${text.savedCreate}`);
      }

      paymentDialogInitialRef.current = null;
      router.replace(baseHref, { scroll: false });
    } catch (error) {
      setFormError(getApiErrorMessage(error, text.failedSave));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeletePayment(payment: PaymentRow) {
    if (!window.confirm(text.deleteConfirm)) {
      return;
    }

    setDeletingPaymentId(payment.id);
    setPageError("");

    try {
      await apiClient.del<{ success: boolean }>(`/sales/payments/${payment.id}`);
      setRows((current) => current.filter((row) => row.id !== payment.id));
      setFeedback(`${payment.reference} ${text.deleted}`);
      if (paymentId === payment.id && action === "edit") {
        router.replace(baseHref, { scroll: false });
      }
      if (selectedId === payment.id) {
        setSelectedId("");
      }
    } catch (error) {
      setPageError(getApiErrorMessage(error, text.failedDelete));
    } finally {
      setDeletingPaymentId(null);
    }
  }

  function openEditPayment(payment: PaymentRow) {
    router.push(buildHref("edit", payment.id));
  }

  function closePaymentDialog() {
    setFormError("");
    setSubmitting(false);
    paymentDialogInitialRef.current = null;
    router.replace(baseHref, { scroll: false });
  }

  if (loading) {
    return <AdminLoadingState label={text.loading} />;
  }

  if (pageError) {
    return (
      <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
        <p className="font-medium">{text.failedTitle}</p>
        <p className="mt-2">{pageError}</p>
        <Button type="button" className="mt-4 rounded-2xl" onClick={() => void loadData()}>
          {text.retry}
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
                <Link href="/finance/payments?filter=unallocated">{text.unallocated}</Link>
              </Button>
              <Button variant="outline" asChild className="rounded-2xl">
                <Link href="/finance/worker-payments">{text.workerPage}</Link>
              </Button>
              <Button asChild className="rounded-2xl bg-[#2f4156] hover:bg-[#253548]">
                <Link href={buildHref("record")}>
                  <Plus className="h-4 w-4" />
                  {text.create}
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label={text.totalTracked} value={String(rows.length)} icon={<Receipt className="h-4 w-4" />} />
              <SummaryCard label={text.unallocatedCount} value={String(unallocatedCount)} tone="warning" icon={<CircleAlert className="h-4 w-4" />} />
              <SummaryCard label={text.attentionCount} value={String(attentionCount)} tone="danger" icon={<ArrowRightLeft className="h-4 w-4" />} />
              <SummaryCard
                label={text.confirmedAmount}
                value={`${new Intl.NumberFormat("fr-TN").format(totalConfirmedAmount)} DT`}
                tone="success"
                icon={<BadgeDollarSign className="h-4 w-4" />}
              />
            </div>

            <div className="rounded-[1.4rem] border border-[#ead8bc] bg-[#fffaf1] p-4">
              <p className="text-sm font-semibold text-slate-900">{text.quickGuideTitle}</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <p>{text.quickGuide1}</p>
                <p>{text.quickGuide2}</p>
                <p>{text.quickGuide3}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-5">
            <section className="rounded-[1.75rem] border border-black/6 bg-white p-5 shadow-sm">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.8fr)_repeat(2,minmax(0,0.8fr))]">
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
                  value={methodFilter}
                  onChange={(event) => setMethodFilter(event.target.value as "ALL" | PaymentMethodValue)}
                  className="flex h-11 w-full rounded-2xl border border-black/8 bg-[#fcfbf8] px-3 text-sm text-slate-700"
                >
                  <option value="ALL">{text.allMethods}</option>
                  <option value="BANK_TRANSFER">Virement bancaire</option>
                  <option value="CHECK">Chèque</option>
                  <option value="CASH">Espèces</option>
                  <option value="CARD">Carte</option>
                  <option value="OTHER">Autre</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as "ALL" | PaymentStatusValue)}
                  className="flex h-11 w-full rounded-2xl border border-black/8 bg-[#fcfbf8] px-3 text-sm text-slate-700"
                >
                  <option value="ALL">{text.allStatuses}</option>
                  <option value="CONFIRMED">Confirmé</option>
                  <option value="PARTIALLY_ALLOCATED">Partiellement affecté</option>
                  <option value="ALLOCATED">Affecté</option>
                  <option value="PENDING">En attente</option>
                  <option value="FAILED">Échec</option>
                  <option value="REFUNDED">Remboursé</option>
                  <option value="CANCELLED">Annulé</option>
                </select>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { label: text.all, href: "/finance/payments", active: !filter },
                  { label: text.unallocated, href: "/finance/payments?filter=unallocated", active: filter === "unallocated" },
                  { label: text.today, href: "/finance/payments?filter=today", active: filter === "today" },
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
                    <p className="text-lg font-semibold text-slate-900">{text.listTitle}</p>
                    <p className="mt-1 text-sm text-slate-500">{filteredRows.length} paiement(s) visibles</p>
                  </div>
                </div>

                {filteredRows.length ? (
                  <div className="divide-y divide-black/6">
                    {filteredRows.map((payment) => {
                      const isActive = selectedPayment?.id === payment.id;
                      const isPendingAllocation = payment.allocations === "Pending allocation";

                      return (
                        <div
                          key={payment.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedId(payment.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedId(payment.id);
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
                                <p className="text-base font-semibold text-slate-900">{payment.reference}</p>
                                <StatusBadge status={payment.status} />
                                {isPendingAllocation ? (
                                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-800">
                                    {text.pendingAllocations}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-2 text-sm font-medium text-slate-700">{payment.client}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {payment.project && payment.project !== "General" ? payment.project : "Sans chantier"} · {payment.method}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9 rounded-xl px-3"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditPayment(payment);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                                {text.edit}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9 rounded-xl px-3 text-rose-700 hover:text-rose-800"
                                disabled={deletingPaymentId === payment.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleDeletePayment(payment);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                {text.remove}
                              </Button>
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-4">
                            <MiniInfo label={text.amount} value={payment.amount} emphasis />
                            <MiniInfo label={text.allocations} value={payment.allocations === "Pending allocation" ? text.pendingAllocations : payment.allocations} />
                            <MiniInfo label={text.paidAt} value={payment.paidAt} />
                            <MiniInfo label={text.externalRef} value={payment.sourceReference && payment.sourceReference !== "-" ? payment.sourceReference : "Non renseignée"} />
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
                      <Link href={buildHref("record")}>{text.create}</Link>
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
          </div>

          <aside className="rounded-[1.75rem] border border-black/6 bg-white shadow-sm">
            {selectedPayment ? (
              <div className="flex h-full flex-col">
                <div className="border-b border-black/6 px-6 py-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium uppercase tracking-[0.14em] text-slate-400">{text.detailTitle}</p>
                      <h2 className="mt-2 text-2xl font-semibold text-slate-900">{selectedPayment.reference}</h2>
                      <p className="mt-1 text-sm text-slate-500">{selectedPayment.client}</p>
                    </div>
                    <StatusBadge status={selectedPayment.status} />
                  </div>

                  <div className="mt-5 rounded-[1.4rem] border border-black/6 bg-[#fcfbf8] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{text.amount}</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">{selectedPayment.amount}</p>
                    <p className="mt-2 text-sm text-slate-500">
                      {selectedPayment.allocations === "Pending allocation"
                        ? "Ce paiement reste à rattacher à une facture."
                        : `Paiement déjà lié à ${selectedPayment.allocations}.`}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="rounded-2xl" onClick={() => openEditPayment(selectedPayment)}>
                      <Pencil className="h-4 w-4" />
                      {text.edit}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl text-rose-700 hover:text-rose-800"
                      disabled={deletingPaymentId === selectedPayment.id}
                      onClick={() => void handleDeletePayment(selectedPayment)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {text.remove}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-6 px-6 py-6">
                  <DetailBlock
                    title="Fiche paiement"
                    items={[
                      { icon: <Receipt className="h-4 w-4 text-slate-400" />, label: text.internalRef, value: selectedPayment.reference },
                      { icon: <Wallet className="h-4 w-4 text-slate-400" />, label: text.client, value: selectedPayment.client },
                      { icon: <Landmark className="h-4 w-4 text-slate-400" />, label: text.method, value: selectedPayment.method },
                      { icon: <CalendarDays className="h-4 w-4 text-slate-400" />, label: text.paidAt, value: selectedPayment.paidAt },
                      {
                        icon: <ArrowRightLeft className="h-4 w-4 text-slate-400" />,
                        label: text.project,
                        value: selectedPayment.project && selectedPayment.project !== "General" ? selectedPayment.project : "Sans chantier",
                      },
                      {
                        icon: <BadgeDollarSign className="h-4 w-4 text-slate-400" />,
                        label: text.externalRef,
                        value: selectedPayment.sourceReference && selectedPayment.sourceReference !== "-" ? selectedPayment.sourceReference : "Non renseignée",
                      },
                    ]}
                  />

                  <div className="rounded-2xl border border-black/6 bg-[#fcfbf8] p-5">
                    <p className="text-sm font-semibold text-slate-900">{text.linkedInvoice}</p>
                    <p className="mt-3 text-sm text-slate-700">
                      {selectedPayment.allocations === "Pending allocation" ? text.pendingAllocations : selectedPayment.allocations}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-black/6 bg-[#fcfbf8] p-5">
                    <p className="text-sm font-semibold text-slate-900">{text.internalNote}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {selectedPayment.note?.trim() ? selectedPayment.note : "Aucune note interne sur ce paiement."}
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
        open={action === "record" || action === "edit"}
        title={action === "edit" ? text.editTitle : text.recordTitle}
        description={action === "edit" ? text.editDescription : text.recordDescription}
        onClose={closePaymentDialog}
        isDirty={isPaymentDialogDirty}
        dirtyWarningText="Des modifications non enregistrées seront perdues. Fermer ce formulaire ?"
      >
        <div className="grid gap-4">
          {formError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={text.client}>
              <select
                value={form.client}
                onChange={(event) => setForm((current) => ({ ...current, client: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.name}>
                    {client.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label={text.projectOptional}>
              <select
                value={form.project}
                onChange={(event) => setForm((current) => ({ ...current, project: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{text.generalNoProject}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.title}>
                    {project.title}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label={text.method}>
              <select
                value={form.method}
                onChange={(event) => setForm((current) => ({ ...current, method: event.target.value as PaymentMethodValue }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="BANK_TRANSFER">Virement bancaire</option>
                <option value="CHECK">Chèque</option>
                <option value="CASH">Espèces</option>
                <option value="CARD">Carte</option>
                <option value="OTHER">Autre</option>
              </select>
            </FormField>

            <FormField label={text.status}>
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as PaymentStatusValue }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="CONFIRMED">Confirmé</option>
                <option value="PARTIALLY_ALLOCATED">Partiellement affecté</option>
                <option value="ALLOCATED">Affecté</option>
                <option value="PENDING">En attente</option>
                <option value="FAILED">Échec</option>
                <option value="REFUNDED">Remboursé</option>
                <option value="CANCELLED">Annulé</option>
              </select>
            </FormField>

            <FormField label={text.amount}>
              <Input
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                placeholder={text.amountPlaceholder}
              />
            </FormField>

            <FormField label={text.paymentDate}>
              <Input
                type="date"
                value={form.paymentDate}
                onChange={(event) => setForm((current) => ({ ...current, paymentDate: event.target.value }))}
              />
            </FormField>

            <FormField label={text.externalRef}>
              <Input
                value={form.reference}
                onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))}
                placeholder={text.referencePlaceholder}
              />
            </FormField>
          </div>

          <FormField label={text.internalNote}>
            <Textarea
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              placeholder={text.internalNotePlaceholder}
            />
          </FormField>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" className="rounded-2xl" onClick={closePaymentDialog}>
              {text.cancel}
            </Button>
            <Button type="button" className="rounded-2xl" onClick={() => void handleSavePayment()} disabled={submitting}>
              {submitting ? text.saving : action === "edit" ? text.update : text.save}
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

function toPaymentMethodValue(value: string): PaymentMethodValue {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_");
  if (normalized === "BANK_TRANSFER") {
    return "BANK_TRANSFER";
  }
  if (normalized === "CHECK") {
    return "CHECK";
  }
  if (normalized === "CASH") {
    return "CASH";
  }
  if (normalized === "CARD") {
    return "CARD";
  }
  return "OTHER";
}

function toPaymentStatusValue(value: string): PaymentStatusValue {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_");
  if (
    normalized === "CONFIRMED" ||
    normalized === "PARTIALLY_ALLOCATED" ||
    normalized === "ALLOCATED" ||
    normalized === "PENDING" ||
    normalized === "FAILED" ||
    normalized === "REFUNDED" ||
    normalized === "CANCELLED"
  ) {
    return normalized;
  }
  return "CONFIRMED";
}

function getApiErrorMessage(error: unknown, fallback: string) {
  const apiError = error as ApiError;
  return apiError?.error?.details?.[0]?.message || apiError?.error?.message || fallback;
}
