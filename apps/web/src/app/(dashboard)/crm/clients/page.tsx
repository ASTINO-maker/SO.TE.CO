"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormField } from "../../../../components/admin/form-field";
import { ClientsWorkspace, type ClientRecord } from "../../../../components/crm/clients-workspace";
import { Button } from "../../../../components/ui/button";
import { DialogShell } from "../../../../components/ui/dialog";
import { Input } from "../../../../components/ui/input";
import { Textarea } from "../../../../components/ui/textarea";
import { apiClient } from "../../../../lib/api/client";
import type { ApiError, PaginatedResponse } from "../../../../lib/api/types";

type ClientFormState = {
  type: "Company" | "Individual";
  code: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  taxIdentifier: string;
  address: string;
  openingBalance: string;
  notes: string;
};

type ImportClientPayload = {
  type: "Company" | "Individual";
  code?: string;
  name: string;
  contactName: string;
  phone: string;
  email?: string;
  city: string;
  taxIdentifier?: string;
  address: string;
  openingBalance?: string;
  notes?: string;
};

type ParsedImportRow = {
  rowNumber: number;
  payload: ImportClientPayload;
};

type ClientImportIssue = {
  row: number;
  message: string;
};

type ClientImportParseResult = {
  rows: ParsedImportRow[];
  issues: ClientImportIssue[];
};

const emptyClientForm: ClientFormState = {
  type: "Company",
  code: "",
  name: "",
  contactName: "",
  phone: "",
  email: "",
  city: "",
  taxIdentifier: "",
  address: "",
  openingBalance: "",
  notes: "",
};

function serializeClientDialogState(form: ClientFormState, activeClientId: string | null) {
  return JSON.stringify({
    form,
    activeClientId: activeClientId ?? "",
  });
}

export default function ClientsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const action = searchParams.get("action") ?? "";
  const baseHref = "/crm/clients";
  const actionHref = `${baseHref}?action=`;
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [activeClient, setActiveClient] = useState<ClientRecord | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState("");
  const [importSummary, setImportSummary] = useState<{
    totalRows: number;
    importedCount: number;
    failedCount: number;
    issues: ClientImportIssue[];
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [clientForm, setClientForm] = useState<ClientFormState>(emptyClientForm);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const clientDialogInitialRef = useRef<string | null>(null);

  const serializedClientDialogState = useMemo(
    () => serializeClientDialogState(clientForm, activeClient?.id ?? null),
    [clientForm, activeClient],
  );
  const isClientDialogDirty =
    (showCreateDialog || showEditDialog) &&
    clientDialogInitialRef.current !== null &&
    clientDialogInitialRef.current !== serializedClientDialogState;
  const isImportDialogDirty = Boolean(importFile || importSummary);

  const text = {
    loadFailed: "Impossible de charger les clients.",
    editClient: "Modifier le client",
    createClient: "Créer un client",
    editDescription: "Mettez à jour la fiche client, les données de facturation et les informations de contact.",
    createDescription: "Créez une nouvelle fiche client avec identité commerciale, facturation et coordonnées.",
    updated: "mis à jour avec succès.",
    created: "créé avec succès.",
    saveFailed: "Impossible d'enregistrer le client.",
    loading: "Chargement du registre clients...",
    pageFailed: "La page des clients n'a pas pu être chargée.",
    retry: "Réessayer",
    importTitle: "Importer des clients",
    importDescription: "Importez un fichier Excel (.xlsx ou .xls) pour créer des clients en masse.",
    importPending: "Colonnes supportées: type, code, name, contactName, phone, email, city, taxIdentifier, address, openingBalance, notes.",
    importFileLabel: "Fichier Excel",
    importHint: "Type est optionnel (Company par défaut). Les champs obligatoires sont name, contactName, phone, city, address.",
    importAction: "Importer le fichier",
    importInProgress: "Import en cours...",
    importSuccess: "clients importés avec succès.",
    importPartial: "L'import est terminé avec des lignes en erreur.",
    importFailed: "Impossible de traiter le fichier d'import.",
    importNoRows: "Aucune ligne exploitable trouvée dans ce fichier.",
    importChooseFile: "Veuillez choisir un fichier Excel (.xlsx ou .xls).",
    importSummary: "Résumé de l'import",
    importRows: "Lignes traitées",
    importCreated: "Clients créés",
    importErrors: "Erreurs",
    importIssues: "Détails des erreurs",
    close: "Fermer",
    clientType: "Type de client",
    company: "Société",
    individual: "Particulier",
    clientCode: "Code client",
    clientCodeHint: "Laissez vide pour laisser le backend attribuer la prochaine séquence.",
    displayName: "Nom affiché",
    primaryContact: "Contact principal",
    phone: "Téléphone",
    email: "Email",
    city: "Ville",
    taxIdentifier: "Identifiant fiscal",
    openingBalance: "Solde d'ouverture",
    openingBalanceHint: "Montant DT, optionnel.",
    billingAddress: "Adresse de facturation",
    billingAddressHint: "Rue et ville utilisées dans les documents.",
    notes: "Notes",
    notesPlaceholder: "Note commerciale, contexte de suivi ou remarque de facturation...",
    cancel: "Annuler",
    saving: "Enregistrement...",
    saveChanges: "Enregistrer les modifications",
    createAction: "Créer le client",
  };

  async function loadClients() {
    setLoading(true);
    setPageError("");

    try {
      const response = await apiClient.get<PaginatedResponse<ClientRecord>>("/crm/clients", {
        page: 1,
        pageSize: 100,
      });
      setClients(response.data);
    } catch (error) {
      setPageError(getApiErrorMessage(error, text.loadFailed));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadClients();
  }, []);

  useEffect(() => {
    if (action === "new" && !showCreateDialog && !showEditDialog) {
      setFeedback("");
      setFormError("");
      setActiveClient(null);
      setClientForm(emptyClientForm);
      clientDialogInitialRef.current = serializeClientDialogState(emptyClientForm, null);
      setShowCreateDialog(true);
    }

    if (action !== "new" && showCreateDialog && !showEditDialog) {
      setShowCreateDialog(false);
      clientDialogInitialRef.current = null;
    }

    if (action === "import" && !showImportDialog) {
      setFeedback("");
      setImportError("");
      setImportSummary(null);
      setImportFile(null);
      setShowImportDialog(true);
    }

    if (action !== "import" && showImportDialog && !isImporting) {
      setShowImportDialog(false);
    }
  }, [action, showCreateDialog, showEditDialog, showImportDialog, isImporting]);

  const dialogTitle = useMemo(
    () => (showEditDialog ? text.editClient : text.createClient),
    [showEditDialog, text.createClient, text.editClient],
  );

  const dialogDescription = useMemo(
    () =>
      showEditDialog
        ? text.editDescription
        : text.createDescription,
    [showEditDialog, text.createDescription, text.editDescription],
  );

  function updateForm<K extends keyof ClientFormState>(field: K, value: ClientFormState[K]) {
    setClientForm((current) => ({ ...current, [field]: value }));
  }

  function openImportDialog() {
    setFeedback("");
    setImportError("");
    setImportSummary(null);
    setImportFile(null);
    setShowImportDialog(true);
    router.replace(`${actionHref}import`, { scroll: false });
  }

  function closeImportDialog() {
    if (isImporting) {
      return;
    }

    setShowImportDialog(false);
    setImportError("");
    setImportSummary(null);
    setImportFile(null);
    if (action === "import") {
      router.replace(baseHref, { scroll: false });
    }
  }

  function openNewClient() {
    setFeedback("");
    setFormError("");
    setActiveClient(null);
    setClientForm(emptyClientForm);
    clientDialogInitialRef.current = serializeClientDialogState(emptyClientForm, null);
    setShowEditDialog(false);
    setShowCreateDialog(true);
    router.replace(`${actionHref}new`, { scroll: false });
  }

  function openEditClient(client: ClientRecord) {
    const nextForm: ClientFormState = {
      type: client.type,
      code: client.code,
      name: client.name,
      contactName: client.contactName === "-" ? "" : client.contactName,
      phone: client.phone === "-" ? "" : client.phone,
      email: client.email === "-" ? "" : client.email,
      city: client.city === "-" ? "" : client.city,
      taxIdentifier: "",
      address: client.address === "-" ? "" : client.address,
      openingBalance: normalizeMoneyInput(client.unpaidBalance),
      notes: client.notes[0] ?? "",
    };
    setFeedback("");
    setFormError("");
    setActiveClient(client);
    setClientForm(nextForm);
    clientDialogInitialRef.current = serializeClientDialogState(nextForm, client.id);
    setShowCreateDialog(false);
    setShowEditDialog(true);
    if (action === "new" || action === "import") {
      router.replace(baseHref, { scroll: false });
    }
  }

  function closeFormDialog() {
    setShowCreateDialog(false);
    setShowEditDialog(false);
    setActiveClient(null);
    setClientForm(emptyClientForm);
    setFormError("");
    setSubmitting(false);
    clientDialogInitialRef.current = null;
    if (action === "new") {
      router.replace(baseHref, { scroll: false });
    }
  }

  async function submitClientForm() {
    setSubmitting(true);
    setFormError("");

    const payload = {
      type: clientForm.type,
      code: clientForm.code.trim() || undefined,
      name: clientForm.name.trim(),
      contactName: clientForm.contactName.trim(),
      phone: clientForm.phone.trim(),
      email: clientForm.email.trim() || undefined,
      city: clientForm.city.trim(),
      taxIdentifier: clientForm.taxIdentifier.trim() || undefined,
      address: clientForm.address.trim(),
      openingBalance: clientForm.openingBalance.trim() || undefined,
      notes: clientForm.notes.trim() || undefined,
    };

    try {
      if (showEditDialog && activeClient) {
        const updated = await apiClient.patch<ClientRecord>(`/crm/clients/${activeClient.id}`, payload);
        setClients((current) => current.map((client) => (client.id === updated.id ? updated : client)));
        setFeedback(`${updated.name} ${text.updated}`);
      } else {
        const created = await apiClient.post<ClientRecord>("/crm/clients", payload);
        setClients((current) => [created, ...current]);
        setFeedback(`${created.name} ${text.created}`);
      }

      closeFormDialog();
    } catch (error) {
      setFormError(getApiErrorMessage(error, text.saveFailed));
      setSubmitting(false);
    }
  }

  async function submitImportFile() {
    if (!importFile) {
      setImportError(text.importChooseFile);
      return;
    }

    setIsImporting(true);
    setImportError("");
    setImportSummary(null);

    try {
      const parsed = await parseClientsExcel(importFile);
      if (parsed.rows.length === 0) {
        setImportSummary({
          totalRows: 0,
          importedCount: 0,
          failedCount: parsed.issues.length,
          issues: parsed.issues,
        });
        setImportError(text.importNoRows);
        return;
      }

      const created: ClientRecord[] = [];
      const issues = [...parsed.issues];

      for (const row of parsed.rows) {
        try {
          const client = await apiClient.post<ClientRecord>("/crm/clients", row.payload);
          created.push(client);
        } catch (error) {
          issues.push({
            row: row.rowNumber,
            message: getApiErrorMessage(error, text.importFailed),
          });
        }
      }

      if (created.length > 0) {
        setClients((current) => [...created, ...current]);
      }

      const summary = {
        totalRows: parsed.rows.length + parsed.issues.length,
        importedCount: created.length,
        failedCount: issues.length,
        issues,
      };

      setImportSummary(summary);

      if (created.length > 0 && issues.length === 0) {
        setFeedback(`${created.length} ${text.importSuccess}`);
      } else if (created.length > 0) {
        setFeedback(text.importPartial);
      }
    } catch {
      setImportError(text.importFailed);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <>
      {loading ? (
        <div className="rounded-[1.75rem] border border-black/6 bg-white p-6 text-sm text-slate-500 shadow-sm">
          {text.loading}
        </div>
      ) : pageError ? (
        <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
          <p className="font-medium">{text.pageFailed}</p>
          <p className="mt-2">{pageError}</p>
          <Button type="button" className="mt-4 rounded-2xl" onClick={() => void loadClients()}>
            {text.retry}
          </Button>
        </div>
      ) : (
        <ClientsWorkspace
          clients={clients}
          onOpenNewClient={openNewClient}
          onOpenImport={openImportDialog}
          onOpenEditClient={openEditClient}
          feedback={feedback}
        />
      )}

      <DialogShell
        open={showImportDialog}
        title={text.importTitle}
        description={text.importDescription}
        onClose={closeImportDialog}
        isDirty={isImportDialogDirty}
        dirtyWarningText="Des modifications non enregistrees seront perdues. Fermer cette fenetre ?"
      >
        <div className="grid gap-4">
          <div className="rounded-2xl border border-black/6 bg-[#fcfbf8] p-4 text-sm text-slate-600">
            {text.importPending}
          </div>

          <div className="rounded-2xl border border-black/6 bg-white p-4 text-sm text-slate-600">{text.importHint}</div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-slate-700">{text.importFileLabel}</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
              className="block w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            />
            {importFile ? <p className="text-xs text-slate-500">{importFile.name}</p> : null}
          </div>

          {importError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{importError}</div>
          ) : null}

          {importSummary ? (
            <div className="grid gap-3 rounded-2xl border border-black/8 bg-[#fcfbf8] p-4 text-sm text-slate-700">
              <p className="font-medium text-slate-800">{text.importSummary}</p>
              <p>
                {text.importRows}: <span className="font-medium">{importSummary.totalRows}</span>
              </p>
              <p>
                {text.importCreated}: <span className="font-medium text-emerald-700">{importSummary.importedCount}</span>
              </p>
              <p>
                {text.importErrors}: <span className="font-medium text-rose-700">{importSummary.failedCount}</span>
              </p>

              {importSummary.issues.length > 0 ? (
                <div className="grid gap-2">
                  <p className="font-medium text-slate-800">{text.importIssues}</p>
                  <ul className="max-h-40 space-y-1 overflow-auto pr-1 text-xs text-rose-700">
                    {importSummary.issues.slice(0, 20).map((issue, index) => (
                      <li key={`${issue.row}-${index}`}>Row {issue.row}: {issue.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button
              type="button"
              className="mr-3 rounded-2xl bg-[#2f4156] hover:bg-[#253548]"
              onClick={() => void submitImportFile()}
              disabled={isImporting}
            >
              {isImporting ? text.importInProgress : text.importAction}
            </Button>
            <Button type="button" variant="outline" className="rounded-2xl" onClick={closeImportDialog}>
              {text.close}
            </Button>
          </div>
        </div>
      </DialogShell>

      <DialogShell
        open={showCreateDialog || showEditDialog}
        title={dialogTitle}
        description={dialogDescription}
        onClose={closeFormDialog}
        isDirty={isClientDialogDirty}
        dirtyWarningText="Des modifications non enregistrees seront perdues. Fermer ce formulaire ?"
      >
        <div className="grid gap-4">
          {formError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={text.clientType}>
              <select
                value={clientForm.type}
                onChange={(event) => updateForm("type", event.target.value as ClientFormState["type"])}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="Company">{text.company}</option>
                <option value="Individual">{text.individual}</option>
              </select>
            </FormField>

            <FormField label={text.clientCode} hint={text.clientCodeHint}>
              <Input value={clientForm.code} onChange={(event) => updateForm("code", event.target.value)} />
            </FormField>

            <FormField label={text.displayName}>
              <Input value={clientForm.name} onChange={(event) => updateForm("name", event.target.value)} />
            </FormField>

            <FormField label={text.primaryContact}>
              <Input value={clientForm.contactName} onChange={(event) => updateForm("contactName", event.target.value)} />
            </FormField>

            <FormField label={text.phone}>
              <Input value={clientForm.phone} onChange={(event) => updateForm("phone", event.target.value)} />
            </FormField>

            <FormField label={text.email}>
              <Input
                type="email"
                value={clientForm.email}
                onChange={(event) => updateForm("email", event.target.value)}
              />
            </FormField>

            <FormField label={text.city}>
              <Input value={clientForm.city} onChange={(event) => updateForm("city", event.target.value)} />
            </FormField>

            <FormField label={text.taxIdentifier}>
              <Input
                value={clientForm.taxIdentifier}
                onChange={(event) => updateForm("taxIdentifier", event.target.value)}
              />
            </FormField>

            <FormField label={text.openingBalance} hint={text.openingBalanceHint}>
              <Input
                value={clientForm.openingBalance}
                onChange={(event) => updateForm("openingBalance", event.target.value)}
                placeholder="0"
              />
            </FormField>

            <FormField label={text.billingAddress} hint={text.billingAddressHint}>
              <Input value={clientForm.address} onChange={(event) => updateForm("address", event.target.value)} />
            </FormField>
          </div>

          <FormField label={text.notes}>
            <Textarea
              value={clientForm.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              placeholder={text.notesPlaceholder}
            />
          </FormField>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" className="rounded-2xl" onClick={closeFormDialog}>
              {text.cancel}
            </Button>
            <Button
              type="button"
              className="rounded-2xl bg-[#2f4156] hover:bg-[#253548]"
              onClick={() => void submitClientForm()}
              disabled={submitting}
            >
              {submitting ? text.saving : showEditDialog ? text.saveChanges : text.createAction}
            </Button>
          </div>
        </div>
      </DialogShell>
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

function normalizeMoneyInput(value: string) {
  return value.replace(/\s*(?:TND|DT)$/i, "").trim();
}

async function parseClientsExcel(file: File): Promise<ClientImportParseResult> {
  const xlsx = await import("xlsx");
  const bytes = await file.arrayBuffer();
  const workbook = xlsx.read(bytes, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return {
      rows: [],
      issues: [],
    };
  }

  const firstSheet = workbook.Sheets[firstSheetName];

  if (!firstSheet) {
    return {
      rows: [],
      issues: [],
    };
  }

  const records = xlsx.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    defval: "",
  });

  const rows: ParsedImportRow[] = [];
  const issues: ClientImportIssue[] = [];

  records.forEach((record, index) => {
    const rowNumber = index + 2;
    const rowMap = new Map<string, string>();

    for (const [key, value] of Object.entries(record)) {
      rowMap.set(normalizeImportHeader(key), normalizeImportCell(value));
    }

    const type = resolveImportedType(readImportValue(rowMap, ["type", "clienttype"]));
    const name = readImportValue(rowMap, ["name", "displayname", "clientname", "nom"]);
    const contactName = readImportValue(rowMap, ["contactname", "primarycontact", "contact", "responsable"]);
    const phone = readImportValue(rowMap, ["phone", "telephone", "tel", "mobile"]);
    const email = readImportValue(rowMap, ["email", "mail"]);
    const city = readImportValue(rowMap, ["city", "ville"]);
    const address = readImportValue(rowMap, ["address", "billingaddress", "adresse"]);
    const code = readImportValue(rowMap, ["code", "clientcode"]);
    const taxIdentifier = readImportValue(rowMap, ["taxidentifier", "taxid", "matriculefiscal"]);
    const openingBalance = readImportValue(rowMap, ["openingbalance", "balance", "soldeouverture"]);
    const notes = readImportValue(rowMap, ["notes", "note", "remarque"]);

    const missingFields: string[] = [];
    if (!name) {
      missingFields.push("name");
    }
    if (!contactName) {
      missingFields.push("contactName");
    }
    if (!phone) {
      missingFields.push("phone");
    }
    if (!city) {
      missingFields.push("city");
    }
    if (!address) {
      missingFields.push("address");
    }

    if (missingFields.length > 0) {
      issues.push({
        row: rowNumber,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
      return;
    }

    if (email && !isValidEmail(email)) {
      issues.push({
        row: rowNumber,
        message: "Invalid email format",
      });
      return;
    }

    rows.push({
      rowNumber,
      payload: {
        type,
        code: code || undefined,
        name,
        contactName,
        phone,
        email: email || undefined,
        city,
        taxIdentifier: taxIdentifier || undefined,
        address,
        openingBalance: openingBalance || undefined,
        notes: notes || undefined,
      },
    });
  });

  return {
    rows,
    issues,
  };
}

function normalizeImportHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeImportCell(value: unknown) {
  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function readImportValue(rowMap: Map<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = rowMap.get(key);
    if (value) {
      return value;
    }
  }

  return "";
}

function resolveImportedType(rawType: string): "Company" | "Individual" {
  const normalized = rawType.toLowerCase();
  if (
    normalized === "individual" ||
    normalized === "particulier" ||
    normalized === "person" ||
    normalized === "individu"
  ) {
    return "Individual";
  }

  return "Company";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
