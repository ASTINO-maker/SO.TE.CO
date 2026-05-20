"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "../../lib/api/client";
import type { ApiError, PaginatedResponse } from "../../lib/api/types";
import { PageHeader } from "../admin/page-header";
import { FormField } from "../admin/form-field";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useConfirmDialog } from "../ui/confirm-dialog";
import { DialogShell } from "../ui/dialog";
import { Input } from "../ui/input";

interface WorkerPaymentBatch {
  id: string;
  paymentType: "ADVANCE" | "MONTH_END";
  paymentDate: string;
  note: string;
  createdAt: string;
  workerCount: number;
  totalAmountValue: number;
  totalAmount: string;
  workers: Array<{
    id: string;
    name: string;
    role: string;
    amountValue: number;
    amount: string;
  }>;
}

interface WorkerPaymentFormState {
  paymentType: "ADVANCE" | "MONTH_END";
  paymentDate: string;
  note: string;
  workers: Array<{
    id: string;
    name: string;
    role: string;
    amount: string;
  }>;
}

const EMPTY_WORKER = () => ({
  id: crypto.randomUUID(),
  name: "",
  role: "",
  amount: "",
});

const EMPTY_WORKER_PAYMENT_FORM = (): WorkerPaymentFormState => ({
  paymentType: "ADVANCE",
  paymentDate: new Date().toISOString().slice(0, 10),
  note: "",
  workers: [EMPTY_WORKER()],
});

function serializeWorkerPaymentDialogState(form: WorkerPaymentFormState, editingWorkerBatchId: string | null) {
  return JSON.stringify({
    form,
    editingWorkerBatchId: editingWorkerBatchId ?? "",
  });
}

export function WorkerPaymentsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [workerBatches, setWorkerBatches] = useState<WorkerPaymentBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [workerSubmitting, setWorkerSubmitting] = useState(false);
  const [workerFormError, setWorkerFormError] = useState("");
  const [editingWorkerBatchId, setEditingWorkerBatchId] = useState<string | null>(null);
  const [workerForm, setWorkerForm] = useState<WorkerPaymentFormState>(EMPTY_WORKER_PAYMENT_FORM);
  const workerDialogInitialRef = useRef<string | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const text = {
    eyebrow: "Finance",
    title: "Paiement des ouvriers",
    description: "Gérez les versements des ouvriers, poseurs, chauffeurs et équipe atelier dans un espace dédié.",
    add: "Ajouter un paiement ouvrier",
    back: "Retour aux paiements",
    batches: "Lots enregistrés",
    totalPaid: "Total versé aux ouvriers",
    noData: "Aucun paiement ouvrier enregistré pour le moment.",
    noDataHint: "Utilisez Ajouter un paiement ouvrier pour enregistrer un lot.",
    batch: "Lot",
    workers: "ouvriers",
    edit: "Modifier",
    delete: "Supprimer",
    dialogTitleCreate: "Paiement des ouvriers",
    dialogTitleEdit: "Modifier le lot ouvrier",
    dialogDescription: "Ajoutez chaque ouvrier et le montant exact payé en DT.",
    paymentDate: "Date de paiement",
    paymentType: "Type de paiement",
    paymentTypeAdvance: "Tsb9a (avance)",
    paymentTypeMonthEnd: "Fin de mois",
    batchNote: "Note du lot",
    workersTitle: "Ouvriers dans ce lot",
    workersDescription: "Ajoutez chaque ouvrier une seule fois et indiquez le montant payé.",
    addWorker: "Ajouter un ouvrier",
    workerName: "Nom de l'ouvrier",
    role: "Fonction",
    amount: "Montant",
    remove: "Supprimer",
    workerCount: "Nombre d'ouvriers",
    batchTotal: "Total du lot",
    cancel: "Annuler",
    saving: "Enregistrement...",
    save: "Enregistrer le lot",
    update: "Mettre à jour le lot",
    retry: "Réessayer",
    failedTitle: "La page des paiements ouvriers n'a pas pu être chargée.",
    invalid: "Ajoutez au moins un ouvrier avec un montant valide.",
    duplicate: "Le meme ouvrier ne peut pas apparaitre deux fois dans le meme lot.",
    saved: "Lot de paiement ouvrier enregistré.",
    updated: "Lot de paiement ouvrier mis à jour.",
    deleted: "Lot de paiement ouvrier supprimé.",
    worker: "Ouvrier",
    actions: "Actions",
    roleFallback: "Ouvrier",
  };

  const totalWorkerPayouts = useMemo(
    () => workerBatches.reduce((sum, batch) => sum + batch.totalAmountValue, 0),
    [workerBatches],
  );

  const baseHref = "/finance/worker-payments";
  const actionHref = `${baseHref}?action=`;
  const isDialogOpen = searchParams.get("action") === "new";
  const serializedDialogState = useMemo(
    () => serializeWorkerPaymentDialogState(workerForm, editingWorkerBatchId),
    [workerForm, editingWorkerBatchId],
  );
  const isWorkerDialogDirty =
    isDialogOpen &&
    workerDialogInitialRef.current !== null &&
    workerDialogInitialRef.current !== serializedDialogState;

  function openDialog() {
    router.replace(`${actionHref}new`, { scroll: false });
  }

  function closeDialog() {
    router.replace(baseHref, { scroll: false });
  }

  async function loadData() {
    setLoading(true);
    setPageError("");
    try {
      const response = await apiClient.get<PaginatedResponse<WorkerPaymentBatch>>("/settings/worker-payments");
      setWorkerBatches(response.data);
    } catch (error) {
      setPageError(getApiErrorMessage(error, text.failedTitle));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!isDialogOpen) {
      setEditingWorkerBatchId(null);
      setWorkerFormError("");
      setWorkerForm(EMPTY_WORKER_PAYMENT_FORM());
      workerDialogInitialRef.current = null;
      return;
    }

    workerDialogInitialRef.current = serializeWorkerPaymentDialogState(workerForm, editingWorkerBatchId);
  }, [isDialogOpen]);

  function openBatch(batch?: WorkerPaymentBatch) {
    if (!batch) {
      const nextForm = EMPTY_WORKER_PAYMENT_FORM();
      setEditingWorkerBatchId(null);
      setWorkerFormError("");
      setWorkerForm(nextForm);
      workerDialogInitialRef.current = serializeWorkerPaymentDialogState(nextForm, null);
      openDialog();
      return;
    }

    const nextForm: WorkerPaymentFormState = {
      paymentType: batch.paymentType || "ADVANCE",
      paymentDate: batch.paymentDate.slice(0, 10),
      note: batch.note || "",
      workers: batch.workers.map((worker) => ({
        id: worker.id,
        name: worker.name,
        role: worker.role || "",
        amount: String(worker.amountValue),
      })),
    };

    setEditingWorkerBatchId(batch.id);
    setWorkerFormError("");
    setWorkerForm(nextForm);
    workerDialogInitialRef.current = serializeWorkerPaymentDialogState(nextForm, batch.id);
    openDialog();
  }

  function updateWorker(index: number, field: "name" | "role" | "amount", value: string) {
    setWorkerForm((current) => ({
      ...current,
      workers: current.workers.map((worker, currentIndex) =>
        currentIndex === index ? { ...worker, [field]: value } : worker,
      ),
    }));
  }

  function addWorkerRow() {
    setWorkerForm((current) => ({
      ...current,
      workers: [...current.workers, EMPTY_WORKER()],
    }));
  }

  function removeWorkerRow(id: string) {
    setWorkerForm((current) => ({
      ...current,
      workers: current.workers.length === 1 ? current.workers : current.workers.filter((worker) => worker.id !== id),
    }));
  }

  async function handleSave() {
    setWorkerSubmitting(true);
    setWorkerFormError("");

    const payload = {
      paymentType: workerForm.paymentType,
      paymentDate: workerForm.paymentDate,
      note: workerForm.note.trim() || undefined,
      workers: workerForm.workers
        .map((worker) => ({
          name: worker.name.trim(),
          role: worker.role.trim() || undefined,
          amount: Number(worker.amount),
        }))
        .filter((worker) => worker.name && worker.amount > 0),
    };

    if (!payload.workers.length) {
      setWorkerFormError(text.invalid);
      setWorkerSubmitting(false);
      return;
    }

    const normalizedWorkerNames = payload.workers.map((worker) => normalizeWorkerName(worker.name));
    if (new Set(normalizedWorkerNames).size !== normalizedWorkerNames.length) {
      setWorkerFormError(text.duplicate);
      setWorkerSubmitting(false);
      return;
    }

    try {
      const saved = editingWorkerBatchId
        ? await apiClient.patch<WorkerPaymentBatch>(`/settings/worker-payments/${editingWorkerBatchId}`, payload)
        : await apiClient.post<WorkerPaymentBatch>("/settings/worker-payments", payload);

      setWorkerBatches((current) =>
        editingWorkerBatchId
          ? current.map((batch) => (batch.id === editingWorkerBatchId ? saved : batch))
          : [saved, ...current],
      );
      setFeedback(editingWorkerBatchId ? text.updated : text.saved);
      setEditingWorkerBatchId(null);
      setWorkerForm(EMPTY_WORKER_PAYMENT_FORM());
      closeDialog();
    } catch (error) {
      setWorkerFormError(getApiErrorMessage(error, text.failedTitle));
    } finally {
      setWorkerSubmitting(false);
    }
  }

  async function handleDelete(batch: WorkerPaymentBatch) {
    const confirmed = await confirm({
      title: `Supprimer le lot du ${batch.paymentDate.slice(0, 10)} ?`,
      description: "Ce lot de paiement ouvrier sera supprimé définitivement.",
      confirmLabel: "Supprimer le lot",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    try {
      await apiClient.del<{ success: boolean }>(`/settings/worker-payments/${batch.id}`);
      setWorkerBatches((current) => current.filter((item) => item.id !== batch.id));
      setFeedback(text.deleted);
    } catch (error) {
      setFeedback(getApiErrorMessage(error, text.failedTitle));
    }
  }

  if (loading) {
    return (
      <div className="rounded-[1.75rem] border border-black/6 bg-white p-6 text-sm text-slate-500 shadow-sm">
        {"Chargement des paiements ouvriers..."}
      </div>
    );
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
        <PageHeader
          eyebrow={text.eyebrow}
          title={text.title}
          description={text.description}
          note="Cet écran doit rester très concret pour le gérant: qui a été payé, pour quel type de versement, à quelle date et pour quel montant total d'équipe."
          metrics={[
            { label: "Lots", value: String(workerBatches.length) },
            { label: "Montant versé", value: formatTnd(totalWorkerPayouts), tone: "accent" },
            { label: "Dernier lot", value: workerBatches[0]?.paymentDate ?? "-" },
            { label: "Ouvriers saisis", value: String(workerBatches.reduce((sum, batch) => sum + batch.workerCount, 0)) },
          ]}
          actions={
            <>
              <Button variant="outline" asChild>
                <Link href="/finance/payments">{text.back}</Link>
              </Button>
              <Button type="button" onClick={() => openBatch()}>
                {text.add}
              </Button>
            </>
          }
        />

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{text.batches}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="rounded-[1.5rem] border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{text.batches}</p>
                    <p className="text-3xl font-semibold">{workerBatches.length}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{text.totalPaid}</p>
                    <p className="text-2xl font-semibold">{formatTnd(totalWorkerPayouts)}</p>
                  </div>
                </div>
              </div>

              {workerBatches.length ? (
                workerBatches.map((batch) => (
                  <div key={batch.id} className="rounded-[1.5rem] border border-border bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">{text.batch}</p>
                        <h3 className="mt-1 text-lg font-semibold">{batch.paymentDate.slice(0, 10)}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {batch.workerCount} {text.workers} · {batch.totalAmount} · {batch.paymentType === "ADVANCE" ? text.paymentTypeAdvance : text.paymentTypeMonthEnd}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={() => openBatch(batch)}>
                          {text.edit}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => void handleDelete(batch)}>
                          {text.delete}
                        </Button>
                      </div>
                    </div>
                    {batch.note ? <p className="mt-3 text-sm text-muted-foreground">{batch.note}</p> : null}
                    <div className="mt-4 overflow-hidden rounded-2xl border border-border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-muted/50 text-left text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 font-medium">{text.worker}</th>
                            <th className="px-4 py-3 font-medium">{text.role}</th>
                            <th className="px-4 py-3 font-medium text-right">{text.amount}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batch.workers.map((worker) => (
                            <tr key={worker.id} className="border-t border-border">
                              <td className="px-4 py-3 font-medium">{worker.name}</td>
                              <td className="px-4 py-3 text-muted-foreground">{worker.role || text.roleFallback}</td>
                              <td className="px-4 py-3 text-right font-medium">{worker.amount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
                  {text.noData} <span className="font-medium text-foreground">{text.noDataHint}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{text.add}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm text-muted-foreground">
              <p>
                {"Cette page permet au propriétaire de gérer simplement le salaire des ouvriers par lot de paiement."}
              </p>
              <p>
                {"Vous pouvez enregistrer plusieurs ouvriers dans un seul lot, avec le montant exact versé à chacun."}
              </p>
              <p>
                {"Utilisez Modifier pour corriger un lot existant ou Supprimer si un lot a été saisi par erreur."}
              </p>
            </CardContent>
          </Card>
        </section>

        {feedback ? (
          <div className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {feedback}
          </div>
        ) : null}
      </div>

      <DialogShell
        open={isDialogOpen}
        title={editingWorkerBatchId ? text.dialogTitleEdit : text.dialogTitleCreate}
        description={text.dialogDescription}
        panelClassName="max-w-5xl"
        onClose={closeDialog}
        isDirty={isWorkerDialogDirty}
        dirtyWarningText="Des modifications non enregistrees seront perdues. Fermer ce formulaire ?"
      >
        <div className="grid gap-5">
          {workerFormError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {workerFormError}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label={text.paymentType}>
              <select
                value={workerForm.paymentType}
                onChange={(event) =>
                  setWorkerForm((current) => ({
                    ...current,
                    paymentType: event.target.value as WorkerPaymentFormState["paymentType"],
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ADVANCE">{text.paymentTypeAdvance}</option>
                <option value="MONTH_END">{text.paymentTypeMonthEnd}</option>
              </select>
            </FormField>
            <FormField label={text.paymentDate}>
              <Input
                type="date"
                value={workerForm.paymentDate}
                onChange={(event) => setWorkerForm((current) => ({ ...current, paymentDate: event.target.value }))}
              />
            </FormField>
            <FormField label={text.batchNote}>
              <Input
                value={workerForm.note}
                onChange={(event) => setWorkerForm((current) => ({ ...current, note: event.target.value }))}
                placeholder={"Équipe atelier, pose, chauffeur..."}
              />
            </FormField>
          </div>

          <div className="rounded-[1.5rem] border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <div>
                <p className="text-base font-semibold">{text.workersTitle}</p>
                <p className="text-sm text-muted-foreground">{text.workersDescription}</p>
              </div>
              <Button type="button" variant="outline" onClick={addWorkerRow}>
                {text.addWorker}
              </Button>
            </div>
            <div className="grid gap-3 p-4">
              {workerForm.workers.map((worker, index) => (
                <div
                  key={worker.id}
                  className="grid gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-[1.3fr_1fr_0.8fr_auto]"
                >
                  <FormField label={text.workerName}>
                    <Input
                      autoFocus={index === 0}
                      value={worker.name}
                      onChange={(event) => updateWorker(index, "name", event.target.value)}
                    />
                  </FormField>
                  <FormField label={text.role}>
                    <Input
                      value={worker.role}
                      onChange={(event) => updateWorker(index, "role", event.target.value)}
                    />
                  </FormField>
                  <FormField label={text.amount}>
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      value={worker.amount}
                      onChange={(event) => updateWorker(index, "amount", event.target.value)}
                    />
                  </FormField>
                  <div className="flex items-end">
                    <Button type="button" variant="outline" onClick={() => removeWorkerRow(worker.id)}>
                      {text.remove}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-border bg-background px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{text.workerCount}</p>
                <p className="text-2xl font-semibold">
                  {workerForm.workers.filter((worker) => worker.name.trim()).length}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{text.batchTotal}</p>
                <p className="text-2xl font-semibold">
                  {formatTnd(
                    workerForm.workers.reduce((sum, worker) => sum + (Number(worker.amount) || 0), 0),
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={closeDialog}>
              {text.cancel}
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={workerSubmitting}>
              {workerSubmitting ? text.saving : editingWorkerBatchId ? text.update : text.save}
            </Button>
          </div>
        </div>
      </DialogShell>

      {confirmDialog}
    </>
  );
}

function formatTnd(value: number) {
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })} DT`;
}

function getApiErrorMessage(error: unknown, fallback: string) {
  const apiError = error as ApiError;
  return apiError?.error?.message || fallback;
}

function normalizeWorkerName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
