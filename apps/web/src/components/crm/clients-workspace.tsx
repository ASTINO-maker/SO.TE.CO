"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronRight,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Hammer,
  Mail,
  MapPin,
  NotebookPen,
  Phone,
  Plus,
  Printer,
  Receipt,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { getBrandLogoUrl } from "../../lib/branding";
import { cn } from "../../lib/utils";
import { WorkspaceHero } from "../admin/workspace-hero";
import { StatusBadge } from "../admin/status-badge";
import {
  DocumentViewerDrawer,
  downloadPdfDocument,
  printHtmlDocument,
  type ViewerInfoRow,
  type ViewerListItem,
} from "../sales/document-viewer-drawer";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { DialogShell } from "../ui/dialog";
import { Input } from "../ui/input";

type ClientTab = "profile" | "quotations" | "invoices" | "projects" | "documents" | "notes";

type ViewerState =
  | {
      kind: "invoice" | "quotation" | "document";
      title: string;
      subtitle: string;
      status: string;
      overview: ViewerInfoRow[];
      client: ViewerInfoRow[];
      related?: ViewerListItem[];
      documentHtml: string;
      downloadName: string;
    }
  | null;

export interface ClientRecord {
  id: string;
  code: string;
  name: string;
  type: "Company" | "Individual";
  contactName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  projects: number;
  unpaidBalance: string;
  status: "ACTIVE" | "INACTIVE";
  initials: string;
  quotations: { number: string; status: string; amount: string }[];
  invoices: { number: string; status: string; balance: string }[];
  projectList: { code: string; stage: string; target: string }[];
  documents: string[];
  notes: string[];
}

const tabs: { key: ClientTab; label: string }[] = [
  { key: "profile", label: "Profil" },
  { key: "quotations", label: "Devis" },
  { key: "invoices", label: "Factures" },
  { key: "projects", label: "Chantiers" },
  { key: "documents", label: "Documents" },
  { key: "notes", label: "Notes" },
];

async function triggerPrint(title: string, markup: string) {
  const result = await printHtmlDocument(title, markup);
  if (result.status === "printed") {
    return;
  }

  window.alert(result.message);
}

export function ClientsWorkspace({
  clients,
  onOpenNewClient,
  onOpenImport,
  onOpenEditClient,
  feedback,
}: {
  clients: ClientRecord[];
  onOpenNewClient: () => void;
  onOpenImport: () => void;
  onOpenEditClient: (client: ClientRecord) => void;
  feedback?: string;
}) {
  const [selectedClientId, setSelectedClientId] = useState("");
  const [activeTab, setActiveTab] = useState<ClientTab>("profile");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [viewer, setViewer] = useState<ViewerState>(null);
  const [pdfActionKey, setPdfActionKey] = useState<string | null>(null);

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return clients;
    }

    return clients.filter((client) =>
      [client.name, client.email, client.phone, client.city, client.address, client.code]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [clients, search]);

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;

  const selectedClientInvoices = selectedClient?.invoices ?? [];
  const selectedClientQuotations = selectedClient?.quotations ?? [];
  const selectedClientProjects = selectedClient?.projectList ?? [];
  const selectedClientDocuments = selectedClient?.documents ?? [];
  const selectedClientNotes = selectedClient?.notes ?? [];
  const unpaidBalanceAmount = selectedClient ? parseTndAmount(selectedClient.unpaidBalance) : 0;
  const activeProjectCount = selectedClientProjects.filter((project) => project.stage !== "Completed").length;
  const financeHealthLabel = unpaidBalanceAmount > 0 ? "Relance nécessaire" : "Compte à jour";
  const financeHealthTone =
    unpaidBalanceAmount > 0 ? "text-[#c85b22] border-[#efc8ae] bg-[#fff4ea]" : "text-emerald-700 border-emerald-200 bg-emerald-50";
  const clientSnapshot = selectedClient
    ? [
        {
          label: "Encours client",
          value: selectedClient.unpaidBalance,
          hint: unpaidBalanceAmount > 0 ? "Factures à relancer" : "Aucun impayé",
          tone: unpaidBalanceAmount > 0 ? "accent" : "success",
        },
        {
          label: "Devis",
          value: String(selectedClientQuotations.length),
          hint: `${selectedClientQuotations.filter((quotation) => quotation.status === "ACCEPTED").length} accepté(s)`,
        },
        {
          label: "Factures",
          value: String(selectedClientInvoices.length),
          hint: `${selectedClientInvoices.filter((invoice) => parseTndAmount(invoice.balance) > 0).length} ouverte(s)`,
        },
        {
          label: "Chantiers",
          value: String(selectedClient.projects),
          hint: `${activeProjectCount} en suivi`,
        },
      ]
    : [];

  const metrics = selectedClient
    ? [
        { label: "Total chantiers", value: String(selectedClient.projects) },
        {
          label: "Solde impaye",
          value: selectedClient.unpaidBalance,
          emphasis: true,
        },
      ]
    : [];

  const clientGridColumns =
    "grid-cols-[minmax(220px,2fr)_minmax(210px,1.8fr)_minmax(240px,2.2fr)_minmax(90px,0.9fr)_minmax(110px,1fr)_minmax(92px,1fr)_44px]";
  const activeClients = clients.filter((client) => client.status === "ACTIVE").length;
  const unpaidClients = clients.filter((client) => parseTndAmount(client.unpaidBalance) > 0).length;

  const openInvoiceViewer = (invoice: ClientRecord["invoices"][number]) => {
    if (!selectedClient) {
      return;
    }

    setShowClientDialog(false);
    setViewer({
      kind: "invoice",
      title: invoice.number,
      subtitle: `Facture client pour ${selectedClient.name}`,
      status: invoice.status,
      overview: [
        { label: "Client", value: selectedClient.name },
        { label: "Solde", value: invoice.balance, emphasis: parseTndAmount(invoice.balance) > 0 },
        { label: "Statut commercial", value: invoice.status.replaceAll("_", " ") },
        { label: "Code client", value: selectedClient.code },
      ],
      client: [
        { label: "Contact", value: selectedClient.contactName },
        { label: "Telephone", value: selectedClient.phone },
        { label: "Courriel", value: selectedClient.email },
        { label: "Adresse", value: selectedClient.address },
      ],
      related: selectedClient.projectList.map((project) => ({
        title: project.code,
        meta: project.stage,
      })),
      documentHtml: createClientInvoiceMarkup(selectedClient, invoice),
      downloadName: `${invoice.number}.html`,
    });
  };

  const openQuotationViewer = (quotation: ClientRecord["quotations"][number]) => {
    if (!selectedClient) {
      return;
    }

    setShowClientDialog(false);
    setViewer({
      kind: "quotation",
      title: quotation.number,
      subtitle: `Devis pour ${selectedClient.name}`,
      status: quotation.status,
      overview: [
        { label: "Client", value: selectedClient.name },
        { label: "Montant", value: quotation.amount, emphasis: true },
        { label: "Statut devis", value: quotation.status.replaceAll("_", " ") },
        { label: "Code client", value: selectedClient.code },
      ],
      client: [
        { label: "Contact", value: selectedClient.contactName },
        { label: "Telephone", value: selectedClient.phone },
        { label: "Courriel", value: selectedClient.email },
        { label: "Adresse", value: selectedClient.address },
      ],
      related: selectedClient.notes.map((note, index) => ({
        title: `Note client ${index + 1}`,
        meta: note,
      })),
      documentHtml: createClientQuotationMarkup(selectedClient, quotation),
      downloadName: `${quotation.number}.html`,
    });
  };

  const openDocumentViewer = (documentName: string) => {
    if (!selectedClient) {
      return;
    }

    setShowClientDialog(false);
    setViewer({
      kind: "document",
      title: documentName,
      subtitle: `Document client joint pour ${selectedClient.name}`,
      status: "ARCHIVED",
      overview: [
        { label: "Client", value: selectedClient.name },
        { label: "Fichier", value: documentName },
        { label: "Type de document", value: inferDocumentType(documentName) },
        { label: "Code client", value: selectedClient.code },
      ],
      client: [
        { label: "Contact", value: selectedClient.contactName },
        { label: "Telephone", value: selectedClient.phone },
        { label: "Courriel", value: selectedClient.email },
        { label: "Adresse", value: selectedClient.address },
      ],
      related: selectedClient.projectList.map((project) => ({
        title: project.code,
        meta: project.target,
      })),
      documentHtml: createClientAttachmentMarkup(selectedClient, documentName),
      downloadName: sanitizeFilename(documentName),
    });
  };

  async function runPdfAction(key: string, action: () => Promise<void>) {
    setPdfActionKey(key);
    try {
      await action();
    } finally {
      setPdfActionKey((current) => (current === key ? null : current));
    }
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-5">
        <WorkspaceHero
          eyebrow="Clients"
          title="Portefeuille clients"
          description="Centralisez les fiches clients, l'historique commercial, les documents, les devis, les factures et les chantiers liés."
          note="Une bonne fiche client doit permettre au gérant de comprendre en 10 secondes: qui est le client, quel chantier est ouvert, combien reste à encaisser, quels documents sont déjà signés."
          actions={
            <>
              <Button variant="outline" type="button" className="rounded-2xl" onClick={onOpenImport}>
                Importer
              </Button>
              <Button type="button" className="rounded-2xl bg-[#2f4156] hover:bg-[#253548]" onClick={onOpenNewClient}>
                <Plus className="h-4 w-4" />
                Nouveau client
              </Button>
            </>
          }
          metrics={[
            { label: "Total fiches", value: String(clients.length) },
            { label: "Clients actifs", value: String(activeClients), tone: "success" },
            { label: "Clients avec encours", value: String(unpaidClients), tone: "warning" },
            { label: "Ville(s) couvertes", value: String(new Set(clients.map((client) => client.city)).size) },
          ]}
        />

        <section className="rounded-[1.75rem] border border-black/6 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 rounded-2xl border-black/8 bg-[#fcfbf8] pl-11 shadow-none"
                placeholder="Rechercher un client par nom, courriel, telephone, ville..."
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-2xl"
              onClick={() => setShowFilters((current) => !current)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtres
            </Button>
          </div>

          {showFilters ? (
            <div className="mt-4 grid gap-3 rounded-2xl border border-black/6 bg-[#fcfbf8] p-4 text-sm text-muted-foreground md:grid-cols-3">
              <div className="rounded-2xl bg-white px-4 py-3">Type: Societe / Particulier</div>
              <div className="rounded-2xl bg-white px-4 py-3">Statut: Actif / Inactif</div>
              <div className="rounded-2xl bg-white px-4 py-3">Ville / agence / solde impaye</div>
            </div>
          ) : null}

          {feedback ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {feedback}
            </div>
          ) : null}
        </section>

        <Card className="rounded-[1.75rem] border-black/6 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div className={cn("grid gap-4 border-b border-black/6 px-6 py-4 text-sm font-medium text-slate-500", clientGridColumns)}>
                  <span>Client</span>
                  <span>Contact</span>
                  <span>Adresse</span>
                  <span>Chantiers</span>
                  <span>Impaye</span>
                  <span>Statut</span>
                  <span />
                </div>

                <div className="divide-y divide-black/6">
                  {filteredClients.map((client) => {
                    const isActive = client.id === selectedClient?.id;

                    return (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          setSelectedClientId(client.id);
                          setActiveTab("profile");
                          setShowClientDialog(true);
                        }}
                        aria-pressed={isActive}
                        aria-label={`Ouvrir les details du client ${client.name}`}
                        className={cn(
                          "grid w-full cursor-pointer gap-4 px-6 py-5 text-left transition-colors hover:bg-[#faf7f1]",
                          clientGridColumns,
                          isActive && "bg-[#f4efe5] ring-1 ring-inset ring-[#e7dbc5]",
                        )}
                      >
                        <div className="flex min-w-0 items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#546c7c] text-base font-semibold text-white">
                            {client.initials}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[1.05rem] font-semibold text-slate-800">{client.name}</p>
                            <p className="text-sm text-muted-foreground">{formatClientType(client.type)}</p>
                          </div>
                        </div>

                        <div className="grid min-w-0 gap-1 text-sm text-slate-600">
                          <div className="flex min-w-0 items-center gap-2">
                            <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="truncate">{client.phone}</span>
                          </div>
                          <div className="flex min-w-0 items-center gap-2">
                            <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="truncate">{client.email}</span>
                          </div>
                        </div>

                        <div className="flex min-w-0 items-start gap-2 text-sm text-slate-600">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <span className="truncate">{client.address}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <Building2 className="h-4 w-4 text-slate-400" />
                          <span>{client.projects}</span>
                        </div>

                        <div
                          className={cn(
                            "flex items-center whitespace-nowrap text-sm font-semibold",
                            parseTndAmount(client.unpaidBalance) === 0 ? "text-emerald-600" : "text-[#ff5b21]",
                          )}
                        >
                          {client.unpaidBalance}
                        </div>

                        <div className="flex items-center">
                          <StatusBadge status={client.status} />
                        </div>

                        <div className="flex items-center justify-end">
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <DialogShell
        open={showClientDialog && Boolean(selectedClient)}
        title={selectedClient ? selectedClient.name : "Détails client"}
        description="Dossier client: relation commerciale, pièces, chantiers et situation financière."
        panelClassName="max-w-[min(96vw,1220px)] rounded-[2rem]"
        bodyClassName="bg-[#f6f0e6] p-0"
        onClose={() => setShowClientDialog(false)}
      >
        {selectedClient ? (
          <div className="flex h-full flex-col">
            <div className="border-b border-[#e5d7c4] bg-[linear-gradient(135deg,#fffdf9_0%,#faf2e7_58%,#f6ebdb_100%)] px-6 py-6">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] bg-[#213548] text-xl font-semibold text-white shadow-[0_14px_28px_rgba(33,53,72,0.16)]">
                      {selectedClient.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[1.35rem] font-semibold tracking-[-0.03em] text-slate-900">{selectedClient.name}</p>
                        <StatusBadge status={selectedClient.status} />
                        <span className="rounded-full border border-[#e7d8c3] bg-white/80 px-3 py-1 text-xs font-medium text-slate-600">
                          {formatClientType(selectedClient.type)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        Code {selectedClient.code} • {selectedClient.city} • Contact {selectedClient.contactName}
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-[1.25rem] border border-[#eadbc6] bg-white/85 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Téléphone</p>
                          <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                            <Phone className="h-4 w-4 text-[#a96b43]" />
                            <span>{selectedClient.phone}</span>
                          </div>
                        </div>
                        <div className="rounded-[1.25rem] border border-[#eadbc6] bg-white/85 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Courriel</p>
                          <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                            <Mail className="h-4 w-4 text-[#a96b43]" />
                            <span className="truncate">{selectedClient.email}</span>
                          </div>
                        </div>
                        <div className="rounded-[1.25rem] border border-[#eadbc6] bg-white/85 px-4 py-3 sm:col-span-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Adresse chantier / siège</p>
                          <div className="mt-2 flex items-start gap-2 text-sm font-medium text-slate-700">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#a96b43]" />
                            <span>{selectedClient.address}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-3 lg:w-[280px]">
                    <div className="rounded-[1.5rem] border border-[#eadbc6] bg-[#fff8ee] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Situation client</p>
                      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-900">{selectedClient.unpaidBalance}</p>
                      <div className={cn("mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold", financeHealthTone)}>
                        {financeHealthLabel}
                      </div>
                      <p className="mt-3 text-sm text-slate-500">
                        {selectedClientInvoices.filter((invoice) => parseTndAmount(invoice.balance) > 0).length} facture(s) ouverte(s) à suivre.
                      </p>
                    </div>
                    <Button
                      type="button"
                      className="h-11 rounded-[1.1rem] bg-[#223247] text-white hover:bg-[#1b293a]"
                      onClick={() => onOpenEditClient(selectedClient)}
                    >
                      Modifier la fiche client
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {clientSnapshot.map((item) => (
                    <div key={item.label} className="rounded-[1.35rem] border border-[#eadbc6] bg-white/90 px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                      <p
                        className={cn(
                          "mt-2 text-[1.75rem] font-semibold leading-none tracking-[-0.04em] text-slate-900",
                          item.tone === "accent" && "text-[#d26931]",
                          item.tone === "success" && "text-emerald-700",
                        )}
                      >
                        {item.value}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">{item.hint}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-b border-[#e5d7c4] bg-white/70 px-6">
              <div className="flex flex-wrap gap-2 py-4">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                      activeTab === tab.key
                        ? "border-[#223247] bg-[#223247] text-white shadow-sm"
                        : "border-[#e5d7c4] bg-white text-slate-500 hover:border-[#d8c5aa] hover:text-slate-700",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-6 px-6 py-6">
              {activeTab === "profile" ? (
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
                  <div className="grid gap-5">
                    <div className="rounded-[1.65rem] border border-[#e7d9c6] bg-white p-5 shadow-[0_14px_34px_rgba(53,42,24,0.05)]">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f4ebde] text-[#9f6b3f]">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Fiche relation client</p>
                          <p className="text-xs text-slate-500">Identité commerciale et coordonnées de référence.</p>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-[1.2rem] bg-[#fcf8f1] p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Raison sociale</p>
                          <p className="mt-2 text-base font-semibold text-slate-800">{selectedClient.name}</p>
                        </div>
                        <div className="rounded-[1.2rem] bg-[#fcf8f1] p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Interlocuteur</p>
                          <p className="mt-2 text-base font-semibold text-slate-800">{selectedClient.contactName}</p>
                        </div>
                        <div className="rounded-[1.2rem] bg-[#fcf8f1] p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Téléphone</p>
                          <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                            <Phone className="h-4 w-4 text-[#a96b43]" />
                            <span>{selectedClient.phone}</span>
                          </div>
                        </div>
                        <div className="rounded-[1.2rem] bg-[#fcf8f1] p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Courriel</p>
                          <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                            <Mail className="h-4 w-4 text-[#a96b43]" />
                            <span className="truncate">{selectedClient.email}</span>
                          </div>
                        </div>
                        <div className="rounded-[1.2rem] bg-[#fcf8f1] p-4 sm:col-span-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Adresse</p>
                          <div className="mt-2 flex items-start gap-2 text-sm font-medium text-slate-700">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#a96b43]" />
                            <span>{selectedClient.address}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.65rem] border border-[#e7d9c6] bg-white p-5 shadow-[0_14px_34px_rgba(53,42,24,0.05)]">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f4ebde] text-[#9f6b3f]">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Lecture rapide du dossier</p>
                          <p className="text-xs text-slate-500">Ce que le gérant ou l’admin doit voir en premier.</p>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {metrics.map((metric) => (
                          <div key={metric.label} className="rounded-[1.2rem] border border-[#f0e5d6] bg-[#fcf8f1] px-4 py-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{metric.label}</p>
                            <p
                              className={cn(
                                "mt-2 text-[1.8rem] font-semibold leading-none tracking-[-0.04em] text-slate-900",
                                metric.emphasis && "text-[#d26931]",
                              )}
                            >
                              {metric.value}
                            </p>
                          </div>
                        ))}
                        <div className="rounded-[1.2rem] border border-[#f0e5d6] bg-[#fcf8f1] px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Dernière note</p>
                          <p className="mt-2 text-sm font-medium text-slate-700">
                            {selectedClientNotes[0] ?? "Aucune note enregistrée pour ce client."}
                          </p>
                        </div>
                        <div className="rounded-[1.2rem] border border-[#f0e5d6] bg-[#fcf8f1] px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Pièces disponibles</p>
                          <p className="mt-2 text-sm font-medium text-slate-700">
                            {selectedClientDocuments.length} document(s) liés au compte client.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5">
                    <div className="rounded-[1.65rem] border border-[#e7d9c6] bg-[#223247] p-5 text-white shadow-[0_18px_40px_rgba(21,30,41,0.18)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Vue finance</p>
                      <p className="mt-3 text-[2.4rem] font-semibold leading-none tracking-[-0.05em]">{selectedClient.unpaidBalance}</p>
                      <p className="mt-3 text-sm text-slate-300">
                        {unpaidBalanceAmount > 0
                          ? "Ce compte demande un suivi de recouvrement ou une vérification de règlement."
                          : "Le compte est propre côté facturation et encaissement."}
                      </p>
                      <div className="mt-5 grid gap-3">
                        <div className="rounded-[1.15rem] border border-white/10 bg-white/5 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-slate-300">Factures ouvertes</span>
                            <span className="text-sm font-semibold text-white">
                              {selectedClientInvoices.filter((invoice) => parseTndAmount(invoice.balance) > 0).length}
                            </span>
                          </div>
                        </div>
                        <div className="rounded-[1.15rem] border border-white/10 bg-white/5 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-slate-300">Devis actifs</span>
                            <span className="text-sm font-semibold text-white">
                              {selectedClientQuotations.filter((quotation) => quotation.status !== "REJECTED").length}
                            </span>
                          </div>
                        </div>
                        <div className="rounded-[1.15rem] border border-white/10 bg-white/5 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-slate-300">Chantiers en cours</span>
                            <span className="text-sm font-semibold text-white">{activeProjectCount}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.65rem] border border-[#e7d9c6] bg-white p-5 shadow-[0_14px_34px_rgba(53,42,24,0.05)]">
                      <p className="text-sm font-semibold text-slate-900">Orientation commerciale</p>
                      <div className="mt-4 space-y-3">
                        <div className="rounded-[1.15rem] bg-[#fcf8f1] px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Pipeline</p>
                          <p className="mt-2 text-sm text-slate-700">
                            {selectedClientQuotations.length} devis enregistrés, {selectedClientQuotations.filter((quotation) => quotation.status === "ACCEPTED").length} acceptés.
                          </p>
                        </div>
                        <div className="rounded-[1.15rem] bg-[#fcf8f1] px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Exécution</p>
                          <p className="mt-2 text-sm text-slate-700">
                            {selectedClient.projects} chantier(s) liés à ce client, dont {activeProjectCount} en suivi actif.
                          </p>
                        </div>
                        <div className="rounded-[1.15rem] bg-[#fcf8f1] px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Archivage</p>
                          <p className="mt-2 text-sm text-slate-700">
                            {selectedClientDocuments.length} document(s) et {selectedClientNotes.length} note(s) disponibles dans le dossier.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === "quotations" ? (
                <div className="grid gap-4">
                  {selectedClientQuotations.map((quotation) => (
                    <div
                      key={quotation.number}
                      className="rounded-[1.5rem] border border-[#e7d9c6] bg-white p-5 shadow-[0_10px_24px_rgba(53,42,24,0.04)]"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f4ebde] text-[#9f6b3f]">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{quotation.number}</p>
                            <p className="mt-1 text-sm text-slate-500">Montant proposé {quotation.amount}</p>
                            <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">
                              Dossier client {selectedClient.code}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" variant="outline" className="h-10 rounded-xl px-3" onClick={() => openQuotationViewer(quotation)}>
                            <Eye className="h-4 w-4" />
                            Voir
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 rounded-xl px-3"
                            disabled={pdfActionKey === `quotation-download-${quotation.number}`}
                            onClick={() => {
                              const markup = createClientQuotationMarkup(selectedClient, quotation);
                              void runPdfAction(`quotation-download-${quotation.number}`, () =>
                                downloadPdfDocument(`${quotation.number}.pdf`, markup),
                              );
                            }}
                          >
                            <Download className="h-4 w-4" />
                            {pdfActionKey === `quotation-download-${quotation.number}` ? "Téléchargement..." : null}
                          </Button>
                          <StatusBadge status={quotation.status} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {selectedClientQuotations.length === 0 ? (
                    <div className="rounded-[1.5rem] border border-dashed border-[#dcc9af] bg-white/80 px-5 py-10 text-center text-sm text-slate-500">
                      Aucun devis enregistré pour ce client.
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeTab === "invoices" ? (
                <div className="grid gap-4">
                  {selectedClientInvoices.map((invoice) => (
                    <div
                      key={invoice.number}
                      className="rounded-[1.5rem] border border-[#e7d9c6] bg-white p-5 shadow-[0_10px_24px_rgba(53,42,24,0.04)]"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f4ebde] text-[#9f6b3f]">
                            <Receipt className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{invoice.number}</p>
                            <p className="mt-1 text-sm text-slate-500">Solde à encaisser {invoice.balance}</p>
                            <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">
                              {parseTndAmount(invoice.balance) > 0 ? "Suivi de règlement" : "Pièce soldée"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" variant="outline" className="h-10 rounded-xl px-3" onClick={() => openInvoiceViewer(invoice)}>
                            <Eye className="h-4 w-4" />
                            Voir
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 rounded-xl px-3"
                            disabled={pdfActionKey === `invoice-print-${invoice.number}`}
                            onClick={() => {
                              const markup = createClientInvoiceMarkup(selectedClient, invoice);
                              void runPdfAction(`invoice-print-${invoice.number}`, () => triggerPrint(invoice.number, markup));
                            }}
                          >
                            <Printer className="h-4 w-4" />
                            {pdfActionKey === `invoice-print-${invoice.number}` ? "Impression..." : null}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 rounded-xl px-3"
                            disabled={pdfActionKey === `invoice-download-${invoice.number}`}
                            onClick={() => {
                              const markup = createClientInvoiceMarkup(selectedClient, invoice);
                              void runPdfAction(`invoice-download-${invoice.number}`, () =>
                                downloadPdfDocument(`${invoice.number}.pdf`, markup),
                              );
                            }}
                          >
                            <Download className="h-4 w-4" />
                            {pdfActionKey === `invoice-download-${invoice.number}` ? "Téléchargement..." : null}
                          </Button>
                          <StatusBadge status={invoice.status} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {selectedClientInvoices.length === 0 ? (
                    <div className="rounded-[1.5rem] border border-dashed border-[#dcc9af] bg-white/80 px-5 py-10 text-center text-sm text-slate-500">
                      Aucune facture enregistrée pour ce client.
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeTab === "projects" ? (
                <div className="grid gap-4">
                  {selectedClient.projectList.map((project) => (
                    <div
                      key={project.code}
                      className="rounded-[1.5rem] border border-[#e7d9c6] bg-white p-5 shadow-[0_10px_24px_rgba(53,42,24,0.04)]"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f4ebde] text-[#9f6b3f]">
                            <Hammer className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{project.code}</p>
                            <p className="mt-1 text-sm text-slate-500">{project.target}</p>
                            <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">Phase {project.stage}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button variant="outline" asChild className="h-10 rounded-xl px-3">
                            <Link href="/operations/projects">Ouvrir chantier</Link>
                          </Button>
                          <span className="rounded-full border border-[#eadbc6] bg-[#fff8ee] px-3 py-1 text-xs font-medium text-slate-600">
                            {project.stage}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {selectedClient.projectList.length === 0 ? (
                    <div className="rounded-[1.5rem] border border-dashed border-[#dcc9af] bg-white/80 px-5 py-10 text-center text-sm text-slate-500">
                      Aucun chantier lié à ce client.
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeTab === "documents" ? (
                <div className="grid gap-4">
                  {selectedClient.documents.map((document) => (
                    <div
                      key={document}
                      className="flex flex-col gap-4 rounded-[1.5rem] border border-[#e7d9c6] bg-white p-5 shadow-[0_10px_24px_rgba(53,42,24,0.04)] lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f4ebde] text-[#9f6b3f]">
                          <FolderOpen className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{document}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">Pièce jointe client</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" className="h-10 rounded-xl px-3" onClick={() => openDocumentViewer(document)}>
                          <Eye className="h-4 w-4" />
                          Voir
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 rounded-xl px-3"
                          disabled={pdfActionKey === `document-download-${document}`}
                          onClick={() => {
                            const markup = createClientAttachmentMarkup(selectedClient, document);
                            void runPdfAction(`document-download-${document}`, () =>
                              downloadPdfDocument(sanitizeFilename(document), markup),
                            );
                          }}
                        >
                          <Download className="h-4 w-4" />
                          {pdfActionKey === `document-download-${document}` ? "Téléchargement..." : null}
                        </Button>
                      </div>
                    </div>
                  ))}
                  {selectedClient.documents.length === 0 ? (
                    <div className="rounded-[1.5rem] border border-dashed border-[#dcc9af] bg-white/80 px-5 py-10 text-center text-sm text-slate-500">
                      Aucun document archivé pour ce client.
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeTab === "notes" ? (
                <div className="grid gap-4">
                  {selectedClient.notes.map((note, index) => (
                    <div
                      key={note}
                      className="flex items-start gap-3 rounded-[1.5rem] border border-[#e7d9c6] bg-white p-5 shadow-[0_10px_24px_rgba(53,42,24,0.04)]"
                    >
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f4ebde] text-[#9f6b3f]">
                        <NotebookPen className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Note {index + 1}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{note}</p>
                      </div>
                    </div>
                  ))}
                  {selectedClient.notes.length === 0 ? (
                    <div className="rounded-[1.5rem] border border-dashed border-[#dcc9af] bg-white/80 px-5 py-10 text-center text-sm text-slate-500">
                      Aucune note disponible pour ce client.
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </DialogShell>

      {viewer ? (
        <DocumentViewerDrawer
          open={Boolean(viewer)}
          title={viewer.title}
          subtitle={viewer.subtitle}
          status={viewer.status}
          overview={viewer.overview}
          client={viewer.client}
          related={viewer.related}
          documentHtml={viewer.documentHtml}
          onClose={() => setViewer(null)}
          onDownload={() => {
            void downloadPdfDocument(viewer.downloadName, viewer.documentHtml);
          }}
          onPrint={() => triggerPrint(viewer.title, viewer.documentHtml)}
          extraActions={
            viewer.kind !== "document" ? (
              <Button variant="outline" asChild className="rounded-2xl">
                <Link href={viewer.kind === "invoice" ? "/sales/invoices" : "/sales/quotations"}>
                  Ouvrir le registre complet
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : null}
    </div>
  );
}

function formatClientType(type: ClientRecord["type"]) {
  return type === "Company" ? "Societe" : "Particulier";
}

function parseTndAmount(value: string) {
  const normalized = value.replace(/\s+(?:TND|DT)$/i, "").replaceAll(",", "").trim();
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function createClientInvoiceMarkup(client: ClientRecord, invoice: ClientRecord["invoices"][number]) {
  const logoUrl = getBrandLogoUrl();
  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>${invoice.number}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #efe9de; color: #1f2937; font-family: "Times New Roman", Times, serif; }
      .sheet { width: min(210mm, 100%); min-height: 297mm; margin: 0 auto; background: white; padding: 14mm 12mm 16mm; }
      .header { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
      .brand-block { display: flex; align-items: flex-start; gap: 14px; }
      .logo-shell { width: 82px; min-width: 82px; border: 1px solid #eadfcf; border-radius: 18px; padding: 8px; background: linear-gradient(180deg, #fffdfa 0%, #f7efe2 100%); }
      .logo-shell img { display: block; width: 100%; height: auto; }
      .brand { font-family: Arial, sans-serif; font-size: 28px; font-weight: 800; letter-spacing: -0.03em; color: #111827; }
      .subbrand { margin-top: 4px; font-family: Arial, sans-serif; font-size: 12px; font-weight: 600; color: #111827; }
      .meta { margin-top: 8px; font-size: 11px; line-height: 1.5; }
      .right-meta { text-align: right; font-size: 11px; line-height: 1.65; direction: rtl; unicode-bidi: isolate; }
      .right-meta .arabic-line { display: block; white-space: nowrap; }
      .right-meta .ar-label { direction: rtl; unicode-bidi: isolate; }
      .right-meta .ar-value { direction: ltr; unicode-bidi: isolate; display: inline-block; }
      .city-line { margin-top: 14px; text-align: center; font-size: 12px; }
      .invoice-title { margin: 18px 0 14px; text-align: center; font-family: Arial, sans-serif; font-size: 22px; font-weight: 800; letter-spacing: 0.08em; }
      .client-row { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 10px; font-size: 13px; }
      .line-fill { display: inline-block; min-width: 240px; border-bottom: 1px dotted #6b7280; padding-bottom: 2px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
      table, th, td { border: 1px solid #4b5563; }
      th { padding: 7px 8px; text-align: center; font-weight: 700; background: #fafafa; }
      td { padding: 8px; height: 34px; vertical-align: top; }
      .qty { width: 13%; text-align: center; }
      .designation { width: 55%; }
      .puht { width: 16%; text-align: right; }
      .mht { width: 16%; text-align: right; }
      .summary { margin-top: 16px; margin-left: auto; width: 290px; border: 1px solid #4b5563; }
      .summary-row { display: flex; justify-content: space-between; gap: 12px; padding: 8px 10px; border-bottom: 1px solid #4b5563; font-size: 12px; }
      .summary-row:last-child { border-bottom: 0; font-weight: 700; font-size: 13px; }
      .footer-line { margin-top: 14px; font-size: 13px; }
      .small-note { margin-top: 10px; font-size: 11px; line-height: 1.5; color: #4b5563; }
      @media print { body { background: white; } .sheet { margin: 0; padding: 14mm; } }
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
            <div class="brand">SO.TE.CO</div>
            <div class="subbrand">Société Tunisienne des Etudes et Constructions</div>
            <div class="meta">
            Cité Bouhsina, Sousse<br/>
            Tél: +216 73 230 179<br/>
            RC: B09242852018<br/>
            Matricule fiscal: 1588490B/A/M/000
            </div>
          </div>
        </div>
        <div class="right-meta" lang="ar" dir="rtl">
          <span class="arabic-line"><span class="ar-label">الشركة التونسية للدراسات و البناء</span></span>
          <span class="arabic-line"><span class="ar-label">الهاتف:</span> <span class="ar-value">+216 73 230 179</span></span>
          <span class="arabic-line"><span class="ar-label">العنوان: سوسة</span> <span class="ar-value">4081</span></span>
          <span class="arabic-line"><span class="ar-label">السجل التجاري:</span> <span class="ar-value">B09242852018</span></span>
        </div>
      </div>

      <div class="city-line">Sousse le <span class="line-fill"></span></div>
      <div class="invoice-title">FACTURE N° ${invoice.number}</div>

      <div class="client-row">
        <div>M.: <span class="line-fill">${client.name}</span></div>
        <div>Doit</div>
      </div>

      <table>
        <thead>
          <tr>
            <th class="qty">Quantité</th>
            <th class="designation">Désignation</th>
            <th class="puht">P.U.H.T</th>
            <th class="mht">Montant H.T</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="qty">1</td>
            <td class="designation">Facture client ${client.code} - ${invoice.status.replaceAll("_", " ")}</td>
            <td class="puht">${invoice.balance}</td>
            <td class="mht">${invoice.balance}</td>
          </tr>
          ${Array.from({ length: 7 })
            .map(
              () => `
            <tr>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>

      <div class="summary">
        <div class="summary-row"><span>Total H.T</span><span>${invoice.balance}</span></div>
        <div class="summary-row"><span>Statut</span><span>${invoice.status.replaceAll("_", " ")}</span></div>
        <div class="summary-row"><span>Solde</span><span>${invoice.balance}</span></div>
      </div>

      <div class="footer-line">Arrêtée la présente facture à la somme de <span class="line-fill">${invoice.balance}</span></div>
      <div class="small-note">Code client ${client.code} · ${client.contactName} · ${client.phone} · ${client.email}</div>
    </div>
  </body>
</html>`;
}

function createClientQuotationMarkup(client: ClientRecord, quotation: ClientRecord["quotations"][number]) {
  const logoUrl = getBrandLogoUrl();
  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>${quotation.number}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #efe9de; color: #1f2937; font-family: Arial, sans-serif; }
      .sheet { width: min(210mm, 100%); min-height: 297mm; margin: 0 auto; background: white; padding: 18mm; }
      .topbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 24px; }
      .brand-wrap { display: flex; align-items: flex-start; gap: 14px; }
      .logo-shell { width: 78px; min-width: 78px; border: 1px solid #e9dcc7; border-radius: 18px; padding: 8px; background: linear-gradient(180deg, #fffdfa 0%, #f7efe2 100%); }
      .logo-shell img { display: block; width: 100%; height: auto; }
      .brand { font-size: 28px; font-weight: 800; letter-spacing: -0.04em; color: #233244; }
      .pill { display: inline-block; padding: 6px 12px; border-radius: 999px; background: #eef2f6; color: #233244; font-size: 12px; font-weight: 700; }
      .title { font-size: 28px; font-weight: 800; margin-top: 12px; letter-spacing: -0.04em; }
      .muted { color: #64748b; font-size: 13px; line-height: 1.6; }
      .card { border: 1px solid #e5e7eb; border-radius: 18px; padding: 16px; background: #fcfbf8; margin-top: 24px; }
      .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #94a3b8; font-weight: 700; }
      .value { margin-top: 8px; font-size: 14px; color: #1f2937; font-weight: 700; }
      .amount { margin-top: 18px; font-size: 36px; font-weight: 800; color: #233244; }
      @media print { body { background: white; } .sheet { margin: 0; padding: 14mm; } }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="topbar">
        <div class="brand-wrap">
          <div class="logo-shell">
            <img src="${logoUrl}" alt="SO.TE.CO" />
          </div>
          <div>
            <div class="brand">SO.TE.CO</div>
            <div class="muted">Apercu devis depuis l'espace client</div>
          </div>
        </div>
        <div style="text-align:right">
          <div class="pill">Devis</div>
          <div class="title">${quotation.number}</div>
          <div class="muted">Statut ${quotation.status.replaceAll("_", " ")}<br/>Code client ${client.code}</div>
        </div>
      </div>

      <div class="card">
        <div class="label">Client</div>
        <div class="value">${client.name}</div>
        <div class="muted">${client.contactName}<br/>${client.email}<br/>${client.phone}<br/>${client.address}</div>
      </div>

      <div class="card">
        <div class="label">Resume commercial</div>
        <div class="value">Montant du devis</div>
        <div class="amount">${quotation.amount}</div>
        <div class="muted">Genere directement depuis le panneau detail client pour revision, suivi et export.</div>
      </div>
    </div>
  </body>
</html>`;
}

function createClientAttachmentMarkup(client: ClientRecord, documentName: string) {
  const logoUrl = getBrandLogoUrl();
  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>${documentName}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #efe9de; color: #1f2937; font-family: Arial, sans-serif; }
      .sheet { width: min(210mm, 100%); min-height: 297mm; margin: 0 auto; background: white; padding: 18mm; }
      .card { border: 1px solid #e5e7eb; border-radius: 18px; padding: 18px; background: #fcfbf8; margin-top: 20px; }
      .brand-wrap { display: flex; align-items: flex-start; gap: 14px; }
      .logo-shell { width: 78px; min-width: 78px; border: 1px solid #e9dcc7; border-radius: 18px; padding: 8px; background: linear-gradient(180deg, #fffdfa 0%, #f7efe2 100%); }
      .logo-shell img { display: block; width: 100%; height: auto; }
      .brand { font-size: 28px; font-weight: 800; letter-spacing: -0.04em; color: #233244; }
      .muted { color: #64748b; font-size: 13px; line-height: 1.6; }
      .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #94a3b8; font-weight: 700; }
      .value { margin-top: 8px; font-size: 18px; color: #1f2937; font-weight: 700; }
      @media print { body { background: white; } .sheet { margin: 0; padding: 14mm; } }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="brand-wrap">
        <div class="logo-shell">
          <img src="${logoUrl}" alt="SO.TE.CO" />
        </div>
        <div>
          <div class="brand">SO.TE.CO</div>
          <div class="muted">Apercu document client</div>
        </div>
      </div>

      <div class="card">
        <div class="label">Client</div>
        <div class="value">${client.name}</div>
        <div class="muted">${client.contactName}<br/>${client.email}<br/>${client.phone}</div>
      </div>

      <div class="card">
        <div class="label">Document</div>
        <div class="value">${documentName}</div>
        <div class="muted">Stocke dans la fiche client et disponible au telechargement depuis l'espace ERP.</div>
      </div>
    </div>
  </body>
</html>`;
}

function inferDocumentType(documentName: string) {
  const lower = documentName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    return "Piece jointe PDF";
  }
  if (lower.endsWith(".zip")) {
    return "Archive";
  }
  if (lower.includes("contract")) {
    return "Contrat";
  }
  if (lower.includes("quotation")) {
    return "Document commercial";
  }
  return "Fichier client lie";
}

function sanitizeFilename(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9.-]+/g, "-");
}
