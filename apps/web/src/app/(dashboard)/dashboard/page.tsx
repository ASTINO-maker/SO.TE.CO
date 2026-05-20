"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Clock3,
  FileText,
  Hammer,
  Receipt,
  Truck,
  type LucideIcon,
  Wallet,
} from "lucide-react";
import { WorkspaceHero } from "../../../components/admin/workspace-hero";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { apiClient } from "../../../lib/api/client";
import type { ApiError } from "../../../lib/api/types";
import { cn } from "../../../lib/utils";

export default function DashboardPage() {
  const text = {
    loading: "Chargement des indicateurs...",
    failed: "Le tableau de bord n'a pas pu être chargé.",
    noData: "Aucune donnée disponible.",
    title: "Dashboard direction",
    description:
      "Vue quotidienne du gérant pour piloter la société: devis à relancer, factures à encaisser, livraisons à sortir et chantiers sous pression.",
    newQuotation: "Nouveau devis",
    newInvoice: "Nouvelle facture",
    viewProjects: "Voir les chantiers",
    openInvoices: "Ouvrir les factures",
    openQuotations: "Ouvrir les devis",
    openPayments: "Voir les paiements",
    openDocuments: "Voir les documents",
  };
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setPageError("");
      try {
        const response = await apiClient.get<DashboardOverview>("/dashboard/overview");
        setData(response);
      } catch (error) {
        const apiError = error as ApiError;
        setPageError(apiError.error?.message || text.failed);
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  if (loading) {
    return <LoadingPanel label={text.loading} />;
  }

  if (pageError || !data) {
    return (
      <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
        <p className="font-medium">{text.failed}</p>
        <p className="mt-2">{pageError || text.noData}</p>
      </div>
    );
  }

  const collectionRate = getCollectionRate(data.cashSnapshot.totalCollected, data.cashSnapshot.totalInvoiced);
  const criticalActions = buildCriticalActions(data);
  const quickLinks: QuickLink[] = [
    {
      href: "/sales/quotations?action=new",
      title: "Créer un devis",
      subtitle: "Préparer une offre client chantier ou fabrication.",
      icon: FileText,
      tone: "accent",
    },
    {
      href: "/sales/invoices?action=new",
      title: "Créer une facture",
      subtitle: "Sortir la facture dès que la livraison ou l'avancement est prêt.",
      icon: Receipt,
      tone: "danger",
    },
    {
      href: "/operations/projects",
      title: "Suivre les chantiers",
      subtitle: "Contrôler l'avancement atelier, pose et blocages terrain.",
      icon: Hammer,
      tone: "neutral",
    },
    {
      href: "/finance/payments",
      title: "Contrôler les encaissements",
      subtitle: "Vérifier les règlements entrants et les affectations facture.",
      icon: Wallet,
      tone: "success",
    },
  ];

  return (
    <div className="grid gap-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_380px]">
        <WorkspaceHero
          eyebrow="Dashboard · Direction"
          title={text.title}
          description={text.description}
          note="Pensé pour une société tunisienne de construction métallique: devis, fabrication, transport, pose, facturation et encaissement dans une seule lecture."
          actions={
            <>
              <Button variant="outline" asChild className="rounded-2xl">
                <Link href="/sales/quotations?action=new">{text.newQuotation}</Link>
              </Button>
              <Button variant="outline" asChild className="rounded-2xl">
                <Link href="/sales/invoices?action=new">{text.newInvoice}</Link>
              </Button>
              <Button asChild className="rounded-2xl">
                <Link href="/operations/projects">{text.viewProjects}</Link>
              </Button>
            </>
          }
          metrics={[
            { label: "À encaisser", value: data.cashSnapshot.outstanding, tone: "warning" },
            { label: "Devis pipeline", value: data.quotationSnapshot.pipelineValue, tone: "accent" },
            { label: "Chantiers actifs", value: data.kpis[2]?.value ?? "-", tone: "default" },
            { label: "Devis à relancer", value: String(data.quotationSnapshot.followUpCount), tone: "warning" },
          ]}
        />

        <Card className="overflow-hidden border-[#25364b] bg-[#182433] text-white shadow-[0_30px_80px_rgba(24,36,51,0.28)]">
          <CardHeader className="border-b border-white/10">
            <CardTitle className="text-[1.35rem] text-white">Vue gérant</CardTitle>
            <p className="text-sm leading-6 text-slate-300">
              Les points à traiter en premier avant d'ouvrir les modules détaillés.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 pt-6">
            {criticalActions.map((item) => (
              <PriorityRow key={item.title} {...item} dark />
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.95fr)]">
        <DashboardSection
          title="Radar trésorerie"
          description="Lecture directe de la facture vers l'encaissement, avec pression de retard et charge logistique."
        >
          <div className="grid gap-4">
            <div className="rounded-[1.5rem] border border-[#e7dece] bg-[#fcf8f1] p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Taux d'encaissement</p>
                  <p className="mt-2 text-[2.8rem] font-semibold tracking-[-0.05em] text-slate-950">
                    {collectionRate}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Encaissé</p>
                  <p className="text-lg font-semibold text-emerald-700">{data.cashSnapshot.totalCollected}</p>
                </div>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#e7e0d2]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#1f9d72] via-[#3ab88c] to-[#8ad2b8]"
                  style={{ width: `${Math.max(8, collectionRate)}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                <span>Facturé: {data.cashSnapshot.totalInvoiced}</span>
                <span>Reste à encaisser: {data.cashSnapshot.outstanding}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SignalTile label="Factures ouvertes" value={String(data.cashSnapshot.unpaidCount)} tone="warning" />
              <SignalTile label="Montant en retard" value={data.cashSnapshot.overdueAmount} tone="danger" />
              <SignalTile label="Bons préparés" value={String(data.cashSnapshot.preparedDeliveries)} tone="neutral" />
              <SignalTile label="Bons en transit" value={String(data.cashSnapshot.inTransitDeliveries)} tone="accent" />
            </div>

            <div className="grid gap-3">
              {[
                {
                  title: "Recouvrement urgent",
                  value: `${data.cashSnapshot.overdueCount} facture(s) en retard`,
                  hint: "Priorité appel client / relance terrain / confirmation de paiement.",
                  tone: "danger" as const,
                },
                {
                  title: "Charge logistique",
                  value: `${data.cashSnapshot.preparedDeliveries + data.cashSnapshot.inTransitDeliveries} bon(s) à surveiller`,
                  hint: "Coordination atelier, transport et réception chantier.",
                  tone: "accent" as const,
                },
              ].map((item) => (
                <PriorityRow key={item.title} {...item} />
              ))}
            </div>
          </div>
        </DashboardSection>

        <DashboardSection
          title="Tableau commercial devis"
          description="Ce qui doit être préparé, relancé ou transformé en commande chantier."
        >
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <SignalTile label="Brouillons" value={String(data.quotationSnapshot.draftCount)} tone="neutral" />
              <SignalTile label="À relancer" value={String(data.quotationSnapshot.followUpCount)} tone="warning" />
              <SignalTile label="Acceptés" value={String(data.quotationSnapshot.acceptedCount)} tone="success" />
              <SignalTile label="Transformation" value={`${data.quotationSnapshot.conversionRate}%`} tone="accent" />
            </div>

            <div className="grid gap-3">
              <StatusBand
                label="Valeur du pipeline"
                value={data.quotationSnapshot.pipelineValue}
                detail="Devis en préparation, envoyés ou en négociation."
                tone="accent"
              />
              <StatusBand
                label="Valeur gagnée"
                value={data.quotationSnapshot.acceptedValue}
                detail="Charge à préparer côté atelier et chantier."
                tone="success"
              />
              <StatusBand
                label="Échéance proche"
                value={`${data.quotationSnapshot.expiringSoonCount} devis`}
                detail={`${data.quotationSnapshot.rejectedCount} devis refusés gardés pour mémoire commerciale.`}
                tone="warning"
              />
            </div>

            <div className="grid gap-2">
              {data.quotationStatus.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-[1.1rem] border border-[#ece4d7] bg-white px-4 py-3"
                >
                  <span className="font-medium text-slate-700">{item.label}</span>
                  <Badge variant="outline" className="rounded-full border-black/8 bg-[#f8f2e8] text-slate-700">
                    {item.count}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </DashboardSection>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,0.9fr)]">
        <DashboardSection
          title="Chantiers et livraisons"
          description="Lecture opérationnelle des affaires qui demandent du suivi terrain ou atelier."
        >
          <div className="grid gap-3">
            {data.projectPipeline.map((item) => (
              <div
                key={item.stage}
                className="flex items-center justify-between gap-4 rounded-[1.35rem] border border-[#e7dece] bg-[#fcf8f1] px-4 py-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600">
                    <Hammer className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{item.stage}</p>
                    <p className="truncate text-sm text-slate-500">{item.note}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[1.5rem] font-semibold tracking-[-0.03em] text-slate-900">{item.count}</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Projet(s)</p>
                </div>
              </div>
            ))}
          </div>
        </DashboardSection>

        <DashboardSection
          title="Factures à relancer"
          description="Les dossiers client qui pèsent le plus sur la trésorerie."
        >
          <div className="grid gap-3">
            {data.unpaidInvoices.map((invoice) => (
              <div
                key={invoice.number}
                className="rounded-[1.35rem] border border-[#e7dece] bg-[#fffdfa] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{invoice.number}</p>
                    <p className="truncate text-sm text-slate-500">{invoice.client}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full",
                      invoice.status === "Overdue"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-[#d8ccb7] bg-[#f8f2e8] text-slate-700",
                    )}
                  >
                    {invoice.status === "Overdue" ? "En retard" : "Ouverte"}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center justify-between gap-4 text-sm">
                  <span className="text-slate-500">Échéance {invoice.due}</span>
                  <span className="font-semibold text-slate-900">{invoice.amount}</span>
                </div>
              </div>
            ))}

            <Button variant="ghost" asChild className="justify-start px-0 text-primary hover:bg-transparent">
              <Link href="/sales/invoices">
                {text.openInvoices}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </DashboardSection>

        <DashboardSection
          title="Urgences du jour"
          description="Actions concrètes avant de passer au détail."
        >
          <div className="grid gap-3">
            {data.reminders.map((item) => (
              <PriorityRow
                key={`${item.title}-${item.due}`}
                title={item.title}
                value={item.due}
                hint={item.owner}
                tone="warning"
              />
            ))}
            {data.reminders.length === 0 ? (
              <div className="rounded-[1.35rem] border border-[#e7dece] bg-[#fcf8f1] px-4 py-5 text-sm text-slate-500">
                Aucun rappel urgent remonté pour le moment.
              </div>
            ) : null}
          </div>
        </DashboardSection>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <DashboardSection
          title="Activité récente"
          description="Les derniers mouvements commerciaux, facturation et logistique."
        >
          <div className="grid gap-3">
            {data.activities.map((item) => (
              <div
                key={`${item.title}-${item.time}`}
                className="flex items-start gap-4 rounded-[1.35rem] border border-[#e7dece] bg-[#fffdfa] px-4 py-4"
              >
                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f1e7d7] text-[#c45b2d]">
                  {item.type === "Finance" ? (
                    <Receipt className="h-4 w-4" />
                  ) : item.type === "Logistics" ? (
                    <Truck className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span>{item.type}</span>
                    <span>•</span>
                    <span>{item.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DashboardSection>

        <DashboardSection
          title="Accès direct"
          description="Raccourcis pour ce que le gérant ouvre le plus souvent dans la journée."
        >
          <div className="grid gap-3">
            {quickLinks.map((link) => (
              <QuickLinkCard key={link.href} {...link} />
            ))}
          </div>
        </DashboardSection>
      </section>
    </div>
  );
}

type DashboardOverview = {
  kpis: Array<{ label: string; value: string; trend?: string; tone: string }>;
  monthlyPerformance: Array<{ month: string; revenue: number; cashIn: number }>;
  quotationStatus: Array<{ label: string; count: number }>;
  cashSnapshot: {
    totalInvoiced: string;
    totalCollected: string;
    outstanding: string;
    overdueAmount: string;
    overdueCount: number;
    unpaidCount: number;
    preparedDeliveries: number;
    inTransitDeliveries: number;
  };
  quotationSnapshot: {
    draftCount: number;
    followUpCount: number;
    acceptedCount: number;
    rejectedCount: number;
    conversionRate: number;
    pipelineValue: string;
    acceptedValue: string;
    expiringSoonCount: number;
  };
  projectPipeline: Array<{ stage: string; count: number; note: string }>;
  unpaidInvoices: Array<{ number: string; client: string; due: string; amount: string; status: string }>;
  reminders: Array<{ title: string; due: string; owner: string }>;
  activities: Array<{ title: string; time: string; type: string }>;
};

type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

type QuickLink = {
  href: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tone: Tone;
};

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="rounded-[1.75rem] border border-black/6 bg-white p-6 text-sm text-slate-500 shadow-sm">
      {label}
    </div>
  );
}

function DashboardSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-[#ddd3c3] bg-[#fffdfa] shadow-[0_24px_56px_rgba(31,41,55,0.07)]">
      <CardHeader>
        <CardTitle className="text-[1.45rem] text-slate-950">{title}</CardTitle>
        <p className="text-sm leading-6 text-slate-500">{description}</p>
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
    </Card>
  );
}

function SignalTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: Tone;
}) {
  return (
    <div className="rounded-[1.35rem] border border-[#e7dece] bg-[#fcf8f1] p-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={cn("mt-2 text-[1.55rem] font-semibold tracking-[-0.03em]", toneTextClass[tone])}>{value}</p>
    </div>
  );
}

function StatusBand({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: Tone;
}) {
  return (
    <div className="rounded-[1.35rem] border border-[#e7dece] bg-[#fffdfa] px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-slate-900">{label}</p>
        <p className={cn("text-right text-base font-semibold", toneTextClass[tone])}>{value}</p>
      </div>
      <p className="mt-1 text-sm leading-6 text-slate-500">{detail}</p>
    </div>
  );
}

function PriorityRow({
  title,
  value,
  hint,
  tone,
  dark = false,
}: {
  title: string;
  value: string;
  hint: string;
  tone: Tone;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[1.25rem] px-4 py-4",
        dark ? "border border-white/10 bg-white/5" : "border border-[#e7dece] bg-[#fffdfa]",
      )}
    >
      <span className={cn("mt-1.5 h-2.5 w-2.5 rounded-full", toneDotClass[tone])} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={cn("font-semibold", dark ? "text-white" : "text-slate-900")}>{title}</p>
          <p className={cn("text-sm font-semibold", dark ? "text-slate-200" : "text-slate-700")}>{value}</p>
        </div>
        <p className={cn("mt-1 text-sm leading-6", dark ? "text-slate-400" : "text-slate-500")}>{hint}</p>
      </div>
    </div>
  );
}

function QuickLinkCard({ href, title, subtitle, icon: Icon, tone }: QuickLink) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 rounded-[1.35rem] border border-[#e7dece] bg-[#fcf8f1] px-4 py-4 transition-colors hover:bg-white"
    >
      <div className="min-w-0 flex items-center gap-3">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl bg-white", toneTextClass[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />
    </Link>
  );
}

function buildCriticalActions(data: DashboardOverview) {
  const actions = [
    {
      title: "Relances factures",
      value: `${data.cashSnapshot.overdueCount} retard(s)`,
      hint: `Montant bloqué: ${data.cashSnapshot.overdueAmount}`,
      tone: "danger" as const,
    },
    {
      title: "Suivi devis",
      value: `${data.quotationSnapshot.followUpCount} à relancer`,
      hint: `${data.quotationSnapshot.expiringSoonCount} devis proches d'échéance`,
      tone: "warning" as const,
    },
    {
      title: "Pression chantier",
      value: `${data.cashSnapshot.preparedDeliveries} bons préparés`,
      hint: `${data.projectPipeline.find((item) => item.stage === "In progress")?.count ?? 0} chantier(s) en cours`,
      tone: "accent" as const,
    },
  ];

  if (!actions.some((item) => item.value !== "0 retard(s)" && item.value !== "0 à relancer" && item.value !== "0 bons préparés")) {
    return [
      {
        title: "Exploitation stable",
        value: "Aucune urgence critique",
        hint: "Vous pouvez passer en revue chantiers, dépenses et production sans alerte prioritaire.",
        tone: "success" as const,
      },
    ];
  }

  return actions;
}

function getCollectionRate(collected: string, invoiced: string) {
  const collectedValue = parseMoneyValue(collected);
  const invoicedValue = parseMoneyValue(invoiced);
  if (!invoicedValue) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((collectedValue / invoicedValue) * 100)));
}

function parseMoneyValue(value: string) {
  return Number(value.replace(/[^\d.-]/g, "")) || 0;
}

const toneTextClass: Record<Tone, string> = {
  neutral: "text-slate-900",
  success: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-rose-700",
  accent: "text-[#c45b2d]",
};

const toneDotClass: Record<Tone, string> = {
  neutral: "bg-slate-400",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  accent: "bg-[#c45b2d]",
};
