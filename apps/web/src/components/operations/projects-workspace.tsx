"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileText,
  FolderOpen,
  Hammer,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { StatusBadge } from "../admin/status-badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";

type ProjectTab = "summary" | "execution" | "finance" | "documents";

export interface ProjectRecord {
  id: string;
  code: string;
  title: string;
  client: string;
  status: "IN_PROGRESS" | "PLANNED" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  delivery: string;
  progress: string;
  billedPaid: string;
  address: string;
  notes: string;
  manager: string;
  team: string[];
  quotation: string;
  stage: string;
  measurements: string[];
  tasks: { label: string; state: string }[];
  finance: { label: string; value: string; emphasis?: boolean }[];
  deliveryNotes: string[];
  invoices: string[];
  expenses: string[];
  documents: string[];
}

const tabs: { key: ProjectTab; label: string }[] = [
  { key: "summary", label: "Résumé" },
  { key: "execution", label: "Exécution" },
  { key: "finance", label: "Finance" },
  { key: "documents", label: "Documents" },
];

export function ProjectsWorkspace({
  projects,
  createHref,
  onEditProject,
  onDeleteProject,
  deletingProjectId,
}: {
  projects: ProjectRecord[];
  createHref: string;
  onEditProject: (project: ProjectRecord) => void;
  onDeleteProject: (project: ProjectRecord) => void;
  deletingProjectId?: string | null;
}) {
  const [selectedId, setSelectedId] = useState(projects[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<ProjectTab>("summary");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ProjectRecord["status"]>("ALL");

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesSearch =
        !term ||
        [project.code, project.title, project.client, project.address, project.manager]
          .join(" ")
          .toLowerCase()
          .includes(term);
      const matchesStatus = statusFilter === "ALL" || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, search, statusFilter]);

  const selectedProject =
    filteredProjects.find((project) => project.id === selectedId) ?? filteredProjects[0] ?? projects[0];

  const metrics = selectedProject
    ? [
        { label: "Avancement", value: selectedProject.progress },
        { label: "Paye / Facture", value: selectedProject.billedPaid, emphasis: true },
      ]
    : [];
  const activeProjects = projects.filter((project) => project.status === "IN_PROGRESS").length;
  const plannedProjects = projects.filter((project) => project.status === "PLANNED").length;
  const onHoldProjects = projects.filter((project) => project.status === "ON_HOLD").length;
  const completedProjects = projects.filter((project) => project.status === "COMPLETED").length;
  const cancelledProjects = projects.filter((project) => project.status === "CANCELLED").length;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
      <div className="grid gap-5">
        <section className="rounded-[1.75rem] border border-black/6 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8d6a2d]">Chantiers</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Registre des chantiers</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Une lecture simple pour voir ce qui est planifié, ce qui avance, ce qui bloque et ce qui est déjà facturé sur chaque affaire.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="rounded-2xl bg-[#2f4156] hover:bg-[#253548]">
                <Link href={createHref}>
                  <Plus className="h-4 w-4" />
                  Créer un chantier
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <MetricTile label="Total" value={String(projects.length)} />
            <MetricTile label="En cours" value={String(activeProjects)} tone="success" />
            <MetricTile label="Planifiés" value={String(plannedProjects)} />
            <MetricTile label="En attente" value={String(onHoldProjects)} tone="warning" />
            <MetricTile label="Terminés" value={String(completedProjects)} />
            <MetricTile label="Annulés" value={String(cancelledProjects)} tone="danger" />
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 rounded-2xl border-black/8 bg-[#fcfbf8] pl-11 shadow-none"
                placeholder="Rechercher code, titre, client, adresse..."
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "ALL", label: "Tous" },
                { key: "PLANNED", label: "Planifiés" },
                { key: "IN_PROGRESS", label: "En cours" },
                { key: "ON_HOLD", label: "En attente" },
                { key: "COMPLETED", label: "Terminés" },
                { key: "CANCELLED", label: "Annulés" },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setStatusFilter(option.key as "ALL" | ProjectRecord["status"])}
                  className={cn(
                    "rounded-2xl border px-4 py-2 text-sm font-medium transition-colors",
                    statusFilter === option.key
                      ? "border-[#2f4156] bg-[#2f4156] text-white"
                      : "border-black/8 bg-[#fcfbf8] text-slate-600 hover:bg-white",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <Card className="rounded-[1.75rem] border-black/6 shadow-sm">
          <CardContent className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-4 border-b border-black/6 bg-[#fcfbf8] px-6 py-3 text-sm text-slate-500">
              <span>Sélectionnez un chantier pour afficher sa fiche détaillée à droite.</span>
              <span>{filteredProjects.length} chantier(s)</span>
            </div>
            <div className="grid grid-cols-[1.1fr_1.95fr_1.4fr_1fr_1fr_0.9fr_1.15fr_44px] gap-4 border-b border-black/6 px-6 py-4 text-sm font-medium text-slate-500">
              <span>Code</span>
              <span>Projet</span>
              <span>Client</span>
              <span>Statut</span>
              <span>Livraison cible</span>
              <span>Avancement</span>
              <span>Paye / Facture</span>
              <span />
            </div>

            <div className="divide-y divide-black/6">
              {filteredProjects.length ? filteredProjects.map((project) => {
                const isActive = project.id === selectedProject?.id;

                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(project.id);
                      setActiveTab("summary");
                    }}
                    aria-pressed={isActive}
                    aria-label={`Ouvrir les details du chantier ${project.title}`}
                    className={cn(
                      "grid w-full cursor-pointer grid-cols-[1.1fr_1.95fr_1.4fr_1fr_1fr_0.9fr_1.15fr_44px] gap-4 px-6 py-5 text-left transition-colors hover:bg-[#faf7f1]",
                      isActive && "bg-[#f4efe5] ring-1 ring-inset ring-[#e7dbc5]",
                    )}
                  >
                    <div className="font-semibold text-slate-800">{project.code}</div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800">{project.title}</p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{project.address}</p>
                    </div>
                    <div className="text-sm text-slate-700">{project.client}</div>
                    <div className="flex items-center">
                      <StatusBadge status={project.status} />
                    </div>
                    <div className="text-sm text-slate-700">{project.delivery}</div>
                    <div className="text-sm font-medium text-slate-700">{project.progress}</div>
                    <div className="text-sm font-medium text-slate-700">{project.billedPaid}</div>
                    <div className="flex items-center justify-end">
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </button>
                );
              }) : (
                <div className="px-6 py-10 text-center text-sm text-slate-500">
                  Aucun chantier ne correspond aux filtres actuels.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <aside className="rounded-[1.75rem] border border-black/6 bg-white shadow-sm">
        {selectedProject ? (
          <div className="flex h-full flex-col">
            <div className="border-b border-black/6 px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium uppercase tracking-[0.14em] text-slate-400">{selectedProject.code}</p>
                  <p className="mt-2 text-[1.15rem] font-semibold leading-7 text-slate-800">{selectedProject.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedProject.client}</p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <StatusBadge status={selectedProject.status} />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="outline" className="h-9 rounded-xl px-3" onClick={() => onEditProject(selectedProject)}>
                      <Pencil className="h-4 w-4" />
                      Modifier
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-xl px-3 text-rose-700 hover:text-rose-800"
                      disabled={deletingProjectId === selectedProject.id}
                      onClick={() => onDeleteProject(selectedProject)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Supprimer
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {metrics.map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-black/6 bg-[#fcfbf8] p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{metric.label}</p>
                    <p className={cn("mt-2 text-2xl font-semibold leading-none text-slate-800", metric.emphasis && "text-[#ff5b21]")}>
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-b border-black/6 px-6">
              <div className="flex flex-wrap gap-2 py-4">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "rounded-2xl px-4 py-2 text-sm font-medium transition-colors",
                      activeTab === tab.key
                        ? "bg-[#2f4156] text-white"
                        : "bg-[#fcfbf8] text-slate-500 hover:bg-white hover:text-slate-700",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-6 px-6 py-6">
              {activeTab === "summary" ? (
                <>
                  <div className="rounded-2xl border border-black/6 bg-[#fcfbf8] p-5">
                    <p className="text-sm font-semibold text-slate-800">Fiche chantier</p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <InfoRow icon={<MapPin className="h-4 w-4 text-slate-400" />} label="Adresse" value={selectedProject.address} />
                      <InfoRow icon={<CalendarDays className="h-4 w-4 text-slate-400" />} label="Livraison cible" value={selectedProject.delivery} />
                      <InfoRow icon={<Users className="h-4 w-4 text-slate-400" />} label="Responsable" value={selectedProject.manager} />
                      <InfoRow icon={<FileText className="h-4 w-4 text-slate-400" />} label="Devis" value={selectedProject.quotation} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/6 bg-[#fcfbf8] p-4">
                    <p className="text-sm font-medium text-slate-500">Équipe affectée</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedProject.team.map((member) => (
                        <span key={member} className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
                          {member}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              {activeTab === "execution" ? (
                <div className="grid gap-4">
                  <div className="rounded-2xl border border-black/6 bg-[#fcfbf8] p-4">
                    <p className="text-sm font-medium text-slate-500">Étape actuelle</p>
                    <div className="mt-2 flex items-center gap-3">
                      <Hammer className="h-4 w-4 text-slate-400" />
                      <span className="font-medium text-slate-800">{selectedProject.stage}</span>
                    </div>
                  </div>

                  <ListCard
                    title="Mesures"
                    icon={<ClipboardList className="h-4 w-4 text-slate-400" />}
                    items={selectedProject.measurements}
                  />

                  <div className="rounded-2xl border border-black/6 bg-[#fcfbf8] p-4">
                    <p className="text-sm font-medium text-slate-500">Tâches opérationnelles</p>
                    <div className="mt-3 grid gap-3">
                      {selectedProject.tasks.map((task) => (
                        <div key={task.label} className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3">
                          <span className="text-sm font-medium text-slate-800">{task.label}</span>
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{task.state}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === "finance" ? (
                <div className="grid gap-4">
                  <div className="rounded-2xl border border-black/6 bg-[#fcfbf8] p-4">
                    <p className="text-sm font-medium text-slate-500">Lecture financière</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Vérifiez ici ce qui a été livré, facturé, encaissé et les dépenses déjà rattachées au chantier.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedProject.finance.map((item) => (
                      <div key={item.label} className="rounded-2xl border border-black/6 bg-[#fcfbf8] p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                        <p className={cn("mt-2 text-sm font-semibold text-slate-700", item.emphasis && "text-[#ff5b21]")}>
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <ListCard title="Bons de livraison" icon={<FileText className="h-4 w-4 text-slate-400" />} items={selectedProject.deliveryNotes} />
                  <ListCard title="Factures" icon={<Wallet className="h-4 w-4 text-slate-400" />} items={selectedProject.invoices} />
                  <ListCard title="Depenses" icon={<Wallet className="h-4 w-4 text-slate-400" />} items={selectedProject.expenses} />
                </div>
              ) : null}

              {activeTab === "documents" ? (
                <ListCard title="Documents du chantier" icon={<FolderOpen className="h-4 w-4 text-slate-400" />} items={selectedProject.documents} />
              ) : null}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <div className="mt-2 flex items-start gap-2 text-[1.02rem] text-slate-800">
        {icon}
        <span>{value}</span>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  return (
    <div className="rounded-[1.25rem] border border-black/6 bg-[#fcfbf8] px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p
        className={cn(
          "mt-3 text-[1.85rem] font-semibold leading-none text-slate-800",
          tone === "success" && "text-emerald-600",
          tone === "warning" && "text-amber-600",
          tone === "danger" && "text-rose-600",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ListCard({
  title,
  icon,
  items,
}: {
  title: string;
  icon: ReactNode;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-black/6 bg-[#fcfbf8] p-4">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <div className="mt-3 grid gap-3">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm text-slate-700">
            {icon}
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
