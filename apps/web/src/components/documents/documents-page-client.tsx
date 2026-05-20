"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  Clock3,
  Download,
  FileImage,
  FileText,
  FolderOpen,
  Link2,
  Pencil,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { DialogShell } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { FilterBanner } from "../admin/filter-banner";
import { StatusBadge } from "../admin/status-badge";
import { AdminEmptyState, AdminLoadingState } from "../admin/state-blocks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { FormField } from "../admin/form-field";
import { apiClient } from "../../lib/api/client";
import type { ApiError, PaginatedResponse } from "../../lib/api/types";
import { cn } from "../../lib/utils";

interface DocumentRow {
  id: string;
  fileName: string;
  entity: string;
  type: string;
  documentType: "IMAGE" | "PDF" | "CONTRACT" | "DRAWING" | "INVOICE_ATTACHMENT" | "DELIVERY_ATTACHMENT" | "OTHER";
  visibility: "INTERNAL" | "CLIENT_SHARED";
  targetType: string;
  targetReference: string;
  label: string;
  uploadedBy: string;
  version: string;
  status: string;
  uploadedAt: string;
  downloadUrl?: string;
}

interface DocumentFormState {
  file: File | null;
  documentType: "IMAGE" | "PDF" | "CONTRACT" | "DRAWING" | "INVOICE_ATTACHMENT" | "DELIVERY_ATTACHMENT" | "OTHER";
  visibility: "INTERNAL" | "CLIENT_SHARED";
  targetType: string;
  targetReference: string;
  label: string;
}

function serializeDocumentDialogState(form: DocumentFormState) {
  return JSON.stringify({
    fileName: form.file?.name ?? "",
    documentType: form.documentType,
    visibility: form.visibility,
    targetType: form.targetType,
    targetReference: form.targetReference,
    label: form.label,
  });
}

export function DocumentsPageClient({
  action,
  filter,
  documentId,
}: {
  action?: string;
  filter?: string;
  documentId?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<DocumentFormState>({
    file: null,
    documentType: "PDF",
    visibility: "INTERNAL",
    targetType: "project",
    targetReference: "",
    label: "",
  });
  const documentDialogInitialRef = useRef<string | null>(null);

  const baseHref = filter ? `/documents?filter=${filter}` : "/documents";
  const actionHref = `${baseHref}${baseHref.includes("?") ? "&" : "?"}action=`;
  const editingDocument = rows.find((row) => row.id === documentId);
  const serializedDocumentDialogState = useMemo(() => serializeDocumentDialogState(form), [form]);
  const isDocumentDialogDirty =
    (action === "upload" || action === "edit") &&
    documentDialogInitialRef.current !== null &&
    documentDialogInitialRef.current !== serializedDocumentDialogState;
  const text = {
    loading: "Chargement des documents...",
    pageFailed: "La page des documents n'a pas pu etre chargee.",
    loadFailed: "Impossible de charger les documents.",
    chooseFile: "Choisissez d'abord un fichier.",
    added: "ajoute a la bibliotheque documentaire.",
    createFailed: "Impossible d'enregistrer le fichier.",
    notFound: "Document introuvable.",
    updated: "mis a jour avec succes.",
    updateFailed: "Impossible de mettre a jour le fichier.",
    unlinkedLabel: "Fichiers non lies",
    unlinkedDescription: "Affiche les fichiers qui doivent encore etre lies a un client, un chantier, un devis ou une facture.",
    eyebrow: "Documents",
    title: "Documents",
    description: "Gerez les fichiers importes, les metadonnees et les liens vers les entites depuis le registre documentaire partage.",
    uploadFile: "Importer un fichier",
    search: "Rechercher un fichier, une entite, un tag...",
    allTypes: "Tous les types",
    linkedEntityReference: "Reference liee",
    unlinkedOnly: "Non lies uniquement",
    editRecords: "Modifier les fiches ci-dessous",
    tableTitle: "Bibliotheque documentaire",
    emptyTitle: "Aucun document a afficher",
    emptyDescription:
      "Aucun document ne correspond aux filtres actuels. Importez un fichier pour alimenter la bibliotheque.",
    file: "Fichier",
    linkedEntity: "Entite liee",
    type: "Type",
    uploadedBy: "Importe par",
    version: "Version",
    status: "Statut",
    uploadedAt: "Importe le",
    actions: "Actions",
  };

  async function loadData() {
    setLoading(true);
    setPageError("");
    try {
      const response = await apiClient.get<
        PaginatedResponse<DocumentRow> & {
          storage: string;
          attachableTo: string[];
        }
      >("/documents", {
        page: 1,
        pageSize: 100,
      });
      setRows(response.data);
    } catch (error) {
      setPageError(getApiErrorMessage(error, text.loadFailed));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const queryParam = params.get("q") || "";
    const typeParam = params.get("type") || "ALL";

    setSearch(queryParam);
    setTypeFilter(typeParam || "ALL");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);

    if (search.trim()) {
      url.searchParams.set("q", search.trim());
    } else {
      url.searchParams.delete("q");
    }

    if (typeFilter !== "ALL") {
      url.searchParams.set("type", typeFilter);
    } else {
      url.searchParams.delete("type");
    }

    const nextPath = `${url.pathname}${url.search ? `?${url.searchParams.toString()}` : ""}`;
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (nextPath !== currentPath) {
      window.history.replaceState(null, "", nextPath);
    }
  }, [search, typeFilter]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesText =
        !term ||
        [row.fileName, row.entity, row.type, row.uploadedBy, row.version].join(" ").toLowerCase().includes(term);
      const matchesType = typeFilter === "ALL" || row.type === typeFilter;
      const matchesFilter = filter === "unlinked" ? row.entity === "Non lie" : true;
      return matchesText && matchesType && matchesFilter;
    });
  }, [filter, rows, search, typeFilter]);

  const unlinkedDocuments = rows.filter((row) => row.entity === "Non lie").length;
  const sharedDocuments = rows.filter((row) => row.visibility === "CLIENT_SHARED").length;
  const activeTypeCount = new Set(rows.map((row) => row.type)).size;
  const filteredSharedDocuments = filteredRows.filter((row) => row.visibility === "CLIENT_SHARED").length;
  const dominantTypes = useMemo(() => {
    const totals = new Map<string, number>();
    rows.forEach((row) => {
      totals.set(row.type, (totals.get(row.type) ?? 0) + 1);
    });

    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [rows]);
  const recentDocuments = useMemo(
    () =>
      [...filteredRows]
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
        .slice(0, 3),
    [filteredRows],
  );
  const latestDocument = recentDocuments[0];
  const selectClassName =
    "flex h-11 w-full rounded-2xl border border-[#ddd3c3] bg-white/90 px-4 text-sm text-slate-700 outline-none transition focus:border-[#c45b2d] focus:ring-2 focus:ring-[#c45b2d]/15";
  const focusItems = [
    {
      title: "Fichiers a rattacher",
      value: String(unlinkedDocuments),
      helper:
        unlinkedDocuments > 0
          ? "Ces pieces restent difficiles a retrouver tant qu'elles ne sont pas liees."
          : "Le registre est entierement rattache a une entite metier.",
      icon: Link2,
      tone: "warning" as const,
    },
    {
      title: "Partages client",
      value: String(sharedDocuments),
      helper:
        sharedDocuments > 0
          ? "Verifier que seules les versions valides sont visibles cote client."
          : "Aucun document n'est expose au client pour le moment.",
      icon: ShieldCheck,
      tone: "success" as const,
    },
    {
      title: "Dernier import",
      value: latestDocument ? latestDocument.fileName : "Aucun",
      helper: latestDocument ? `${latestDocument.uploadedBy} • ${latestDocument.uploadedAt}` : "Ajoutez un premier fichier au registre.",
      icon: Clock3,
      tone: "default" as const,
    },
  ];

  async function handleCreateDocument() {
    if (!form.file) {
      setFormError(text.chooseFile);
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      const payload = new FormData();
      payload.append("file", form.file);
      payload.append("documentType", form.documentType);
      payload.append("visibility", form.visibility);
      if (form.targetType) payload.append("targetType", form.targetType);
      if (form.targetReference.trim()) payload.append("targetReference", form.targetReference.trim());
      if (form.label.trim()) payload.append("label", form.label.trim());

      const created = await apiClient.postFormData<DocumentRow>("/documents/upload", payload);

      setRows((current) => [created, ...current]);
      setFeedback(`${created.fileName} ${text.added}`);
      setForm({
        file: null,
        documentType: "PDF",
        visibility: "INTERNAL",
        targetType: "project",
        targetReference: "",
        label: "",
      });
      documentDialogInitialRef.current = null;
      router.replace(baseHref, { scroll: false });
    } catch (error) {
      setFormError(getApiErrorMessage(error, text.createFailed));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateDocument() {
    if (!editingDocument) {
      setFormError(text.notFound);
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      const updated = await apiClient.patch<DocumentRow>(`/documents/${editingDocument.id}`, {
        visibility: form.visibility,
        targetType: form.targetType || undefined,
        targetReference: form.targetReference.trim() || undefined,
        label: form.label.trim() || undefined,
      });

      setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      setFeedback(`${updated.fileName} ${text.updated}`);
      documentDialogInitialRef.current = null;
      router.replace(baseHref, { scroll: false });
    } catch (error) {
      setFormError(getApiErrorMessage(error, text.updateFailed));
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (action === "edit" && editingDocument) {
      const nextForm: DocumentFormState = {
        file: null,
        documentType: editingDocument.documentType,
        visibility: editingDocument.visibility,
        targetType: editingDocument.targetType,
        targetReference: editingDocument.targetReference,
        label: editingDocument.label,
      };
      setForm(nextForm);
      documentDialogInitialRef.current = serializeDocumentDialogState(nextForm);
      setFormError("");
    }

    if (action === "upload") {
      const nextForm: DocumentFormState = {
        file: null,
        documentType: "PDF",
        visibility: "INTERNAL",
        targetType: "project",
        targetReference: "",
        label: "",
      };
      setForm(nextForm);
      documentDialogInitialRef.current = serializeDocumentDialogState(nextForm);
      setFormError("");
    }

    if (action !== "upload" && action !== "edit") {
      documentDialogInitialRef.current = null;
    }
  }, [action, editingDocument]);

  function closeDocumentDialog() {
    setFormError("");
    setSubmitting(false);
    documentDialogInitialRef.current = null;
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
        <Button type="button" className="mt-4 rounded-2xl" onClick={() => void loadData()}>
          {"Réessayer"}
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6">
        {filter === "unlinked" ? (
          <FilterBanner
            label={text.unlinkedLabel}
            description={text.unlinkedDescription}
            clearHref="/documents"
          />
        ) : null}

        <section className="relative overflow-hidden rounded-[2rem] border border-[#283443] bg-[linear-gradient(135deg,#17212d_0%,#243548_48%,#c45b2d_150%)] p-6 text-white shadow-[0_30px_90px_rgba(19,30,44,0.24)]">
          <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_42%)]" />
          <div className="absolute right-[-5rem] top-[-4rem] h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(243,194,141,0.26),transparent_68%)]" />
          <div className="absolute bottom-[-6rem] left-[22%] h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(98,146,186,0.18),transparent_70%)]" />

          <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_340px]">
            <div className="space-y-6">
              <div className="space-y-4">
                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-white/72">
                  Registre documentaire
                </span>
                <div className="space-y-3">
                  <h1 className="max-w-4xl text-[clamp(2.4rem,5vw,4.4rem)] font-semibold leading-[0.95] tracking-[-0.05em]">
                    Documents qui se retrouvent en un coup d'oeil.
                  </h1>
                  <p className="max-w-3xl text-[15px] leading-7 text-white/78">
                    Centralisez les imports, les liaisons metier et les versions actives dans un registre plus lisible.
                    Le bon fichier doit rester evident, meme quand les equipes jonglent entre chantier, devis et
                    facture.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  asChild
                  size="lg"
                  className="bg-[#f3c28d] text-slate-950 shadow-[0_16px_30px_rgba(243,194,141,0.25)] hover:bg-[#efb87a]"
                >
                  <Link href={`${actionHref}upload`}>
                    <Upload className="h-4 w-4" />
                    {text.uploadFile}
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  asChild
                  className="border-white/18 bg-white/10 text-white hover:bg-white/16 hover:text-white"
                >
                  <Link href="/documents?filter=unlinked">
                    <AlertTriangle className="h-4 w-4" />
                    {text.unlinkedLabel}
                  </Link>
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Documents" value={String(rows.length)} />
                <MetricCard label="Non lies" value={String(unlinkedDocuments)} tone="warning" />
                <MetricCard label="Partage client" value={String(sharedDocuments)} tone="success" />
                <MetricCard label="Types actifs" value={String(activeTypeCount)} tone="accent" />
              </div>
            </div>

            <div className="grid gap-4 self-start">
              <div className="rounded-[1.6rem] border border-white/14 bg-white/10 p-5 backdrop-blur">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/58">Objectif du registre</p>
                <p className="mt-3 text-sm leading-6 text-white/82">
                  Chaque fichier doit repondre immediatement a quatre questions: ou il se rattache, qui l'a importe,
                  quelle version est courante et si le client peut y acceder.
                </p>
              </div>

              <div className="grid gap-3 rounded-[1.6rem] border border-white/12 bg-[#fff7ec] p-4 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Vue actuelle</p>
                    <p className="mt-1 text-2xl font-semibold tracking-[-0.03em]">{filteredRows.length}</p>
                  </div>
                  <div className="rounded-2xl bg-[#1f2937] px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-white">
                    {filter === "unlinked" ? "Non lies" : "Tout le registre"}
                  </div>
                </div>
                <div className="grid gap-2 text-sm text-slate-600">
                  <div className="flex items-center justify-between rounded-2xl bg-white/85 px-3 py-2">
                    <span>Resultats partages client</span>
                    <span className="font-semibold text-slate-900">{filteredSharedDocuments}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-white/85 px-3 py-2">
                    <span>Recherche active</span>
                    <span className="max-w-[13rem] truncate font-semibold text-slate-900">
                      {search.trim() || "Aucune"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-white/85 px-3 py-2">
                    <span>Filtre type</span>
                    <span className="font-semibold text-slate-900">{typeFilter === "ALL" ? "Tous" : typeFilter}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Card className="overflow-hidden border-[#ddd3c3] bg-[linear-gradient(180deg,rgba(255,250,244,0.98),rgba(255,253,250,0.98))]">
          <CardContent className="p-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_220px_220px_auto] xl:items-end">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{text.search}</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder={text.search}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-11 rounded-2xl border-[#ddd3c3] bg-white pl-11 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{text.type}</label>
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  className={selectClassName}
                >
                  <option value="ALL">{text.allTypes}</option>
                  <option value="Plan">Plan</option>
                  <option value="Signed quotation">Devis signe</option>
                  <option value="Invoice attachment">Piece jointe facture</option>
                  <option value="Receipt">Recu</option>
                  <option value="PDF">PDF</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Mode</label>
                <Input
                  value={filter === "unlinked" ? text.unlinkedOnly : "Registre complet"}
                  readOnly
                  className="h-11 rounded-2xl border-[#ddd3c3] bg-[#fcfbf8] text-slate-600"
                />
              </div>

              <div className="flex justify-start xl:justify-end">
                <Button variant="outline" type="button" disabled className="h-11 rounded-2xl">
                  {text.editRecords}
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <FilterChip label="Documents affiches" value={String(filteredRows.length)} />
              <FilterChip label="Partages client" value={String(filteredSharedDocuments)} tone="success" />
              {typeFilter !== "ALL" ? <FilterChip label="Type" value={typeFilter} tone="accent" /> : null}
              {search.trim() ? <FilterChip label="Recherche" value={search.trim()} tone="accent" /> : null}
              {filter === "unlinked" ? <FilterChip label="Priorite" value="A rattacher" tone="warning" /> : null}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.62fr)_300px]">
          <Card className="overflow-hidden border-[#ddd3c3] bg-[#fffdfa]">
            <CardHeader className="border-b border-[#e7dece] bg-[linear-gradient(180deg,#fbf5ec_0%,#f7efe2_100%)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle className="text-[1.95rem] text-slate-900">{text.tableTitle}</CardTitle>
                  <CardDescription className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Une lecture plus claire du registre: fichier, liaison metier, gouvernance et actions sont visibles
                    sans multiplier les allers-retours.
                  </CardDescription>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <FilterChip label="A rattacher" value={String(unlinkedDocuments)} tone="warning" />
                    <FilterChip label="Visibles client" value={String(sharedDocuments)} tone="success" />
                    <FilterChip label="Types distincts" value={String(activeTypeCount)} />
                  </div>
                </div>
                <div className="rounded-[1.35rem] border border-[#dbcdb8] bg-white/90 px-4 py-3 text-right">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Volume</p>
                  <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-900">{filteredRows.length}</p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {filteredRows.length ? (
                <div className="overflow-hidden">
                  <table className="w-full table-fixed border-separate border-spacing-0 text-left">
                    <colgroup>
                      <col className="w-[27%]" />
                      <col className="w-[24%]" />
                      <col className="w-[22%]" />
                      <col className="w-[15%]" />
                      <col className="w-[12%]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-[#fffaf3]">
                        <th className="border-b border-[#ece3d4] px-4 py-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                          {text.file}
                        </th>
                        <th className="border-b border-[#ece3d4] px-4 py-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                          Liaison
                        </th>
                        <th className="border-b border-[#ece3d4] px-4 py-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                          Gouvernance
                        </th>
                        <th className="border-b border-[#ece3d4] px-4 py-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                          Import
                        </th>
                        <th className="border-b border-[#ece3d4] px-4 py-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                          {text.actions}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => (
                        <tr
                          key={row.id}
                          className={cn(
                            "align-top transition hover:bg-[#fbf6ee]",
                            row.entity === "Non lie" && "bg-amber-50/40",
                          )}
                        >
                          <td className="border-b border-[#f0e7d9] px-4 py-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#e5d8c7] bg-[#f7efe2] text-[#2f4156]">
                                {row.documentType === "IMAGE" ? (
                                  <FileImage className="h-4 w-4" />
                                ) : (
                                  <FileText className="h-4 w-4" />
                                )}
                              </div>
                              <div className="min-w-0 space-y-2">
                                <div>
                                  <p className="break-words text-sm font-semibold leading-5 text-slate-900">
                                    {row.fileName}
                                  </p>
                                  <p className="mt-1 truncate text-xs text-slate-500">
                                    {row.label || getDocumentTypeLabel(row.documentType)}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  <span className="rounded-full border border-[#e3d7c7] bg-white px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                                    {row.type}
                                  </span>
                                  <span className="rounded-full border border-transparent bg-[#eef3f8] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#2f4156]">
                                    v{row.version.replace(/^v/i, "")}
                                  </span>
                                  {row.entity === "Non lie" ? (
                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-800">
                                      A rattacher
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="border-b border-[#f0e7d9] px-4 py-4">
                            <div className="space-y-2">
                              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#e3d7c7] bg-[#fffcf7] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                                <FolderOpen className="h-3.5 w-3.5" />
                                {getTargetTypeLabel(row.targetType)}
                              </div>
                              <p className="break-words text-sm font-medium leading-5 text-slate-900">{row.entity}</p>
                              <p className="break-words text-xs leading-5 text-slate-500">
                                {row.targetReference || "Reference a completer"}
                              </p>
                            </div>
                          </td>
                          <td className="border-b border-[#f0e7d9] px-4 py-4">
                            <div className="space-y-2.5">
                              <StatusBadge status={row.status} />
                              <div className="flex flex-wrap gap-1.5">
                                <span
                                  className={cn(
                                    "rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em]",
                                    row.visibility === "CLIENT_SHARED"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-slate-100 text-slate-600",
                                  )}
                                >
                                  {row.visibility === "CLIENT_SHARED" ? "Partage client" : "Interne"}
                                </span>
                                <span className="rounded-full bg-[#f3ecdf] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#9b5a2d]">
                                  {getDocumentTypeLabel(row.documentType)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="border-b border-[#f0e7d9] px-4 py-4">
                            <div className="space-y-1.5 text-sm">
                              <p className="break-words text-sm font-medium leading-5 text-slate-900">{row.uploadedBy}</p>
                              <p className="text-xs text-slate-500">{row.uploadedAt}</p>
                            </div>
                          </td>
                          <td className="border-b border-[#f0e7d9] px-4 py-4">
                            <div className="rounded-[1.15rem] border border-[#eadfce] bg-[#fffaf4] p-1.5">
                              <div className="flex flex-col gap-2">
                                <Button
                                  asChild
                                  size="sm"
                                  className="h-8 justify-between rounded-xl bg-[#2f4156] px-2.5 text-xs text-white hover:bg-[#243548]"
                                >
                                  <Link href={`${actionHref}edit&id=${row.id}`}>
                                    <span className="inline-flex items-center gap-2">
                                      <Pencil className="h-3.5 w-3.5" />
                                      Modifier
                                    </span>
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                  </Link>
                                </Button>
                                {row.downloadUrl ? (
                                  <Button
                                    asChild
                                    size="sm"
                                    variant="outline"
                                    className="h-8 justify-between rounded-xl border-[#d9cdbd] bg-white px-2.5 text-xs text-slate-700 hover:bg-[#f6efe3]"
                                  >
                                    <a href={apiClient.resolveUrl(row.downloadUrl)} target="_blank" rel="noreferrer">
                                      <span className="inline-flex items-center gap-2">
                                        <Download className="h-3.5 w-3.5" />
                                        Telecharger
                                      </span>
                                      <ArrowUpRight className="h-3.5 w-3.5" />
                                    </a>
                                  </Button>
                                ) : (
                                  <div className="rounded-xl border border-dashed border-[#ddd3c3] px-2 py-2 text-center text-[11px] font-medium text-slate-400">
                                    Indisponible
                                  </div>
                                )}
                              </div>
                              {row.entity === "Non lie" ? (
                                <p className="mt-2 px-1 text-[11px] leading-4 text-amber-800">
                                  Rattacher d'abord.
                                </p>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6">
                  <AdminEmptyState
                    title={text.emptyTitle}
                    description={text.emptyDescription}
                    action={
                      <Button asChild>
                        <Link href={`${actionHref}upload`}>{text.uploadFile}</Link>
                      </Button>
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card className="border-[#ddd3c3] bg-[#fffdfa]">
              <CardHeader>
                <CardTitle className="text-[1.45rem]">Points d'attention</CardTitle>
                <CardDescription>
                  Les indicateurs utiles pour nettoyer la bibliotheque sans perdre du temps dans le detail.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {focusItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="rounded-[1.35rem] border border-[#e8dece] bg-[#fcfaf6] p-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                            item.tone === "warning" && "bg-amber-100 text-amber-700",
                            item.tone === "success" && "bg-emerald-100 text-emerald-700",
                            item.tone === "default" && "bg-[#eef3f8] text-[#2f4156]",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-sm font-medium text-slate-900">{item.title}</p>
                            <p className="truncate text-base font-semibold tracking-[-0.03em] text-slate-900">
                              {item.value}
                            </p>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-500">{item.helper}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="border-[#ddd3c3] bg-[#fffdfa]">
              <CardHeader>
                <CardTitle className="text-[1.45rem]">Structure du registre</CardTitle>
                <CardDescription>Les types qui dominent aujourd'hui et les regles a garder visibles.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div className="space-y-3">
                  {dominantTypes.length ? (
                    dominantTypes.map(([type, total]) => (
                      <div key={type} className="rounded-[1.2rem] bg-[#f7efe2] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-slate-900">{type}</p>
                          <span className="text-sm font-semibold text-[#9b5a2d]">{total}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Aucun type disponible pour le moment.</p>
                  )}
                </div>

                <div className="rounded-[1.4rem] border border-dashed border-[#d8cbb8] bg-[#fff9f2] p-4 text-sm leading-6 text-slate-600">
                  <p className="font-medium text-slate-900">Cadre de gestion</p>
                  <p className="mt-2">1. Liez chaque document a une entite claire avant diffusion.</p>
                  <p>2. Conservez une seule version active visible pour le client.</p>
                  <p>3. Utilisez des libelles courts qui restent exploitables dans la recherche.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {feedback ? (
          <div className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {feedback}
          </div>
        ) : null}
      </div>

      <DialogShell
        open={action === "upload"}
        title="Importer un fichier"
        description="Enregistrer un fichier et le rattacher a la bonne entite metier."
        onClose={closeDocumentDialog}
        isDirty={isDocumentDialogDirty}
        dirtyWarningText="Des modifications non enregistrees seront perdues. Fermer ce formulaire ?"
      >
        <div className="grid gap-4">
          {formError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {formError}
            </div>
          ) : null}
          <FormField label="Fichier">
            <Input
              type="file"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  file: event.target.files?.[0] ?? null,
                }))
              }
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Type de document">
              <select
                value={form.documentType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    documentType: event.target.value as DocumentFormState["documentType"],
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="PDF">PDF</option>
                <option value="IMAGE">Image</option>
                <option value="DRAWING">Dessin</option>
                <option value="CONTRACT">Contrat</option>
                <option value="INVOICE_ATTACHMENT">Piece jointe facture</option>
                <option value="DELIVERY_ATTACHMENT">Piece jointe livraison</option>
                <option value="OTHER">Autre</option>
              </select>
            </FormField>
            <FormField label="Visibilite">
              <select
                value={form.visibility}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    visibility: event.target.value as DocumentFormState["visibility"],
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="INTERNAL">Interne</option>
                <option value="CLIENT_SHARED">Partage client</option>
              </select>
            </FormField>
            <FormField label="Type de cible">
              <select
                value={form.targetType}
                onChange={(event) => setForm((current) => ({ ...current, targetType: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Non lie</option>
                <option value="client">Client</option>
                <option value="project">Chantier</option>
                <option value="quotation">Devis</option>
                <option value="invoice">Facture</option>
                <option value="delivery-note">Bon de livraison</option>
                <option value="expense">Depense</option>
              </select>
            </FormField>
            <FormField label="Reference cible">
              <Input
                value={form.targetReference}
                onChange={(event) => setForm((current) => ({ ...current, targetReference: event.target.value }))}
                placeholder="Code client, code chantier, numero facture..."
              />
            </FormField>
            <FormField label="Libelle de liaison">
              <Input
                value={form.label}
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                placeholder="Plan, devis signe, recu..."
              />
            </FormField>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={closeDocumentDialog}>
              Annuler
            </Button>
            <Button type="button" onClick={() => void handleCreateDocument()} disabled={submitting}>
              {submitting ? ("Enregistrement...") : "Enregistrer le document"}
            </Button>
          </div>
        </div>
      </DialogShell>

      <DialogShell
        open={action === "edit"}
        title="Modifier le document"
        description="Mettre a jour la visibilite et la liaison metier depuis le registre partage."
        onClose={closeDocumentDialog}
        isDirty={isDocumentDialogDirty}
        dirtyWarningText="Des modifications non enregistrees seront perdues. Fermer ce formulaire ?"
      >
        <div className="grid gap-4">
          {formError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {formError}
            </div>
          ) : null}
          <div className="rounded-2xl border border-black/6 bg-[#fcfbf8] px-4 py-3 text-sm text-slate-600">
            {editingDocument ? (
              <>
                <p className="font-medium text-slate-800">{editingDocument.fileName}</p>
                <p className="mt-1">Importe par {editingDocument.uploadedBy} le {editingDocument.uploadedAt}</p>
              </>
            ) : (
              "Chargement des métadonnées du document..."
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Type de document">
              <Input value={editingDocument?.documentType.replaceAll("_", " ") ?? ""} readOnly />
            </FormField>
            <FormField label="Visibilite">
              <select
                value={form.visibility}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    visibility: event.target.value as DocumentFormState["visibility"],
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="INTERNAL">Interne</option>
                <option value="CLIENT_SHARED">Partage client</option>
              </select>
            </FormField>
            <FormField label="Type de cible">
              <select
                value={form.targetType}
                onChange={(event) => setForm((current) => ({ ...current, targetType: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Non lie</option>
                <option value="client">Client</option>
                <option value="project">Chantier</option>
                <option value="quotation">Devis</option>
                <option value="invoice">Facture</option>
                <option value="delivery-note">Bon de livraison</option>
                <option value="expense">Depense</option>
              </select>
            </FormField>
            <FormField label="Reference cible">
              <Input
                value={form.targetReference}
                onChange={(event) => setForm((current) => ({ ...current, targetReference: event.target.value }))}
                placeholder="Code client, code chantier, numero facture..."
              />
            </FormField>
            <FormField label="Libelle de liaison">
              <Input
                value={form.label}
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                placeholder="Plan, devis signe, recu..."
              />
            </FormField>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" type="button" onClick={closeDocumentDialog}>
              {"Annuler"}
            </Button>
            <Button type="button" disabled={submitting || !editingDocument} onClick={() => void handleUpdateDocument()}>
              {submitting ? ("Enregistrement...") : "Enregistrer les modifications"}
            </Button>
          </div>
        </div>
      </DialogShell>
    </>
  );
}

function getApiErrorMessage(error: unknown, fallback: string) {
  const apiError = error as ApiError;
  return apiError?.error?.message || fallback;
}

function getTargetTypeLabel(targetType: string) {
  if (!targetType) {
    return "Non lie";
  }

  return (
    {
      client: "Client",
      project: "Chantier",
      quotation: "Devis",
      invoice: "Facture",
      "delivery-note": "Livraison",
      expense: "Depense",
    }[targetType] ?? targetType
  );
}

function getDocumentTypeLabel(documentType: DocumentRow["documentType"]) {
  return (
    {
      IMAGE: "Image",
      PDF: "PDF",
      CONTRACT: "Contrat",
      DRAWING: "Dessin",
      INVOICE_ATTACHMENT: "Facture",
      DELIVERY_ATTACHMENT: "Livraison",
      OTHER: "Autre",
    }[documentType] ?? documentType
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning" | "success" | "accent";
}) {
  return (
    <div className="rounded-[1.4rem] border border-white/12 bg-white/10 px-4 py-4 backdrop-blur">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">{label}</p>
      <p
        className={cn(
          "mt-2 text-[1.9rem] font-semibold leading-none tracking-[-0.04em] text-white",
          tone === "warning" && "text-[#ffe1a8]",
          tone === "success" && "text-[#bdf2cd]",
          tone === "accent" && "text-[#f7cfa7]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FilterChip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "accent";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
        tone === "default" && "border-[#e2d6c6] bg-[#fffaf4] text-slate-600",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
        tone === "accent" && "border-[#edd4c0] bg-[#f8eee3] text-[#9b5a2d]",
      )}
    >
      <span className="text-slate-400">{label}</span>
      <span className="max-w-[16rem] truncate text-current">{value}</span>
    </span>
  );
}
