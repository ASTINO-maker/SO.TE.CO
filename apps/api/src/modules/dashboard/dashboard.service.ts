import { Injectable } from "@nestjs/common";
import { formatTndCompact } from "@sotec/config";
import { DeliveryStatus, InvoiceStatus, LeadStatus, ProjectStatus, QuotationStatus } from "@sotec/database";
import { PrismaService } from "../../common/prisma/prisma.service";
import { WorkspaceService } from "../../common/workspace/workspace.service";
import type { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async getOverview(user: AuthenticatedUser | undefined) {
    const scope = await this.resolveScope(user);
    const [leads, quotations, projects, invoices, deliveryNotes] = await Promise.all([
      this.prisma.lead.findMany({
        where: { tenantId: scope.tenantId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.quotation.findMany({
        where: { tenantId: scope.tenantId, deletedAt: null },
        orderBy: { issueDate: "desc" },
      }),
      this.prisma.project.findMany({
        where: { tenantId: scope.tenantId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.invoice.findMany({
        where: { tenantId: scope.tenantId, deletedAt: null },
        orderBy: { issueDate: "desc" },
        include: { client: true },
      }),
      this.prisma.deliveryNote.findMany({
        where: { tenantId: scope.tenantId, deletedAt: null },
        orderBy: { deliveryDate: "desc" },
      }),
    ]);

    const openLeads = leads.filter((lead) => !["WON", "LOST", "ARCHIVED"].includes(lead.status)).length;
    const acceptedQuotations = quotations.filter((quotation) => quotation.status === QuotationStatus.ACCEPTED).length;
    const activeProjectStatuses = new Set<ProjectStatus>([
      ProjectStatus.PLANNED,
      ProjectStatus.IN_PROGRESS,
      ProjectStatus.ON_HOLD,
    ]);
    const activeProjects = projects.filter((project) => activeProjectStatuses.has(project.status)).length;
    const outstandingAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue), 0);
    const totalInvoiced = invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
    const totalCollected = invoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount), 0);
    const overdueInvoices = invoices.filter(
      (invoice) =>
        Number(invoice.balanceDue) > 0 &&
        (invoice.status === InvoiceStatus.OVERDUE ||
          (invoice.dueDate ? invoice.dueDate.getTime() < Date.now() : false)),
    );
    const overdueAmount = overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue), 0);
    const preparedDeliveryNotes = deliveryNotes.filter((note) => note.status === DeliveryStatus.PREPARED).length;
    const inTransitDeliveryNotes = deliveryNotes.filter((note) => note.status === DeliveryStatus.IN_TRANSIT).length;

    const draftQuotations = quotations.filter((quotation) => quotation.status === QuotationStatus.DRAFT);
    const sentQuotations = quotations.filter((quotation) => quotation.status === QuotationStatus.SENT);
    const underReviewQuotations = quotations.filter((quotation) => quotation.status === QuotationStatus.UNDER_REVIEW);
    const rejectedQuotations = quotations.filter((quotation) => quotation.status === QuotationStatus.REJECTED);
    const quotationsToFollowUp = [...sentQuotations, ...underReviewQuotations];
    const activeCommercialStatuses: QuotationStatus[] = [
      QuotationStatus.SENT,
      QuotationStatus.UNDER_REVIEW,
      QuotationStatus.ACCEPTED,
      QuotationStatus.REJECTED,
    ];
    const activeCommercialQuotations = quotations.filter((quotation) =>
      activeCommercialStatuses.includes(quotation.status),
    );
    const conversionRate =
      activeCommercialQuotations.length === 0
        ? 0
        : Math.round((acceptedQuotations / activeCommercialQuotations.length) * 100);
    const pipelineValue = [...draftQuotations, ...sentQuotations, ...underReviewQuotations].reduce(
      (sum, quotation) => sum + Number(quotation.totalAmount),
      0,
    );
    const acceptedValue = quotations
      .filter((quotation) => quotation.status === QuotationStatus.ACCEPTED)
      .reduce((sum, quotation) => sum + Number(quotation.totalAmount), 0);
    const quotesExpiringSoon = quotations.filter((quotation) => {
      if (!quotation.validUntil) {
        return false;
      }

      const daysUntilExpiry = Math.ceil((quotation.validUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const followUpStatuses: QuotationStatus[] = [QuotationStatus.SENT, QuotationStatus.UNDER_REVIEW];
      return followUpStatuses.includes(quotation.status) && daysUntilExpiry >= 0 && daysUntilExpiry <= 14;
    }).length;

    const monthlyBuckets = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      date.setMonth(date.getMonth() - (5 - index));
      const year = date.getFullYear();
      const month = date.getMonth();
      const monthInvoices = invoices.filter(
        (invoice) => invoice.issueDate.getFullYear() === year && invoice.issueDate.getMonth() === month,
      );
      return {
        label: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(date),
        total: monthInvoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0),
        paid: monthInvoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount), 0),
      };
    });
    const maxMonthlyInvoiced = Math.max(0, ...monthlyBuckets.map((bucket) => bucket.total));
    const monthlyPerformance = monthlyBuckets.map((bucket) => ({
      month: bucket.label,
      revenue: maxMonthlyInvoiced === 0 ? 0 : Math.round((bucket.total / maxMonthlyInvoiced) * 100),
      cashIn: bucket.total === 0 ? 0 : Math.min(100, Math.round((bucket.paid / bucket.total) * 100)),
    }));

    const quotationStatusLabels: Record<QuotationStatus, string> = {
      [QuotationStatus.DRAFT]: "Brouillon",
      [QuotationStatus.SENT]: "Envoyé",
      [QuotationStatus.UNDER_REVIEW]: "En négociation",
      [QuotationStatus.ACCEPTED]: "Accepté",
      [QuotationStatus.REJECTED]: "Refusé",
      [QuotationStatus.EXPIRED]: "Expiré",
      [QuotationStatus.CANCELLED]: "Annulé",
    };
    const quotationStatus = [
      QuotationStatus.DRAFT,
      QuotationStatus.SENT,
      QuotationStatus.UNDER_REVIEW,
      QuotationStatus.ACCEPTED,
      QuotationStatus.REJECTED,
    ].map((status) => ({
      label: quotationStatusLabels[status],
      count: quotations.filter((quotation) => quotation.status === status).length,
    }));

    const projectPipeline = [
      { stage: "Planifiés", count: projects.filter((project) => project.status === ProjectStatus.PLANNED).length, note: "En attente de lancement" },
      { stage: "En cours", count: projects.filter((project) => project.status === ProjectStatus.IN_PROGRESS).length, note: "Fabrication, atelier ou chantier" },
      { stage: "En attente", count: projects.filter((project) => project.status === ProjectStatus.ON_HOLD).length, note: "Bloqués ou en attente de validation" },
      { stage: "Terminés", count: projects.filter((project) => project.status === ProjectStatus.COMPLETED).length, note: "Livrés et clôturés" },
    ];

    const allUnpaidInvoices = invoices.filter((invoice) => Number(invoice.balanceDue) > 0);
    const unpaidInvoices = allUnpaidInvoices
      .slice(0, 4)
      .map((invoice) => ({
        number: invoice.number,
        client: invoice.client.displayName,
        due: invoice.dueDate ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(invoice.dueDate) : "—",
        amount: formatTndCompact(Number(invoice.balanceDue)),
        status: invoice.status === InvoiceStatus.OVERDUE ? "OVERDUE" : "OPEN",
      }));

    const reminders = [
      ...leads
        .filter((lead) => lead.nextFollowUpAt)
        .slice(0, 2)
        .map((lead) => ({
          title: `Relancer ${lead.fullName}`,
          due: lead.nextFollowUpAt
            ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(lead.nextFollowUpAt)
            : "—",
          owner: "Commercial",
        })),
      ...invoices
        .filter((invoice) => invoice.status === InvoiceStatus.OVERDUE)
        .slice(0, 1)
        .map((invoice) => ({
          title: `Encaisser ${invoice.number}`,
          due: invoice.dueDate
            ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(invoice.dueDate)
            : "—",
          owner: "Comptabilité",
        })),
    ];

    const activities = [
      ...quotations.slice(0, 2).map((quotation) => ({
        title: `${quotation.number} · ${quotationStatusLabels[quotation.status] ?? quotation.status}`,
        time: this.relativeDate(quotation.updatedAt),
        type: "Commercial",
      })),
      ...invoices.slice(0, 2).map((invoice) => ({
        title: `${invoice.number} · ${this.invoiceStatusLabel(invoice.status)}`,
        time: this.relativeDate(invoice.updatedAt),
        type: "Finance",
      })),
      ...deliveryNotes.slice(0, 1).map((note) => ({
        title: `${note.number} · ${this.deliveryStatusLabel(note.status)}`,
        time: this.relativeDate(note.updatedAt),
        type: "Logistique",
      })),
    ].slice(0, 5);

    return {
      kpis: [
        { label: "Prospects ouverts", value: String(openLeads), trend: `${leads.length} prospect(s) au total`, tone: "warning" },
        { label: "Devis acceptés", value: String(acceptedQuotations), trend: `${quotations.length} devis au total`, tone: "positive" },
        { label: "Chantiers actifs", value: String(activeProjects), trend: `${projects.length} chantier(s) au total`, tone: "neutral" },
        {
          label: "Reste à encaisser",
          value: formatTndCompact(outstandingAmount),
          trend: `${allUnpaidInvoices.length} facture(s) ouverte(s)`,
          tone: "warning",
        },
      ],
      monthlyPerformance,
      quotationStatus,
      cashSnapshot: {
        totalInvoiced: this.formatMoney(totalInvoiced),
        totalCollected: this.formatMoney(totalCollected),
        outstanding: this.formatMoney(outstandingAmount),
        overdueAmount: this.formatMoney(overdueAmount),
        overdueCount: overdueInvoices.length,
        unpaidCount: allUnpaidInvoices.length,
        preparedDeliveries: preparedDeliveryNotes,
        inTransitDeliveries: inTransitDeliveryNotes,
      },
      quotationSnapshot: {
        draftCount: draftQuotations.length,
        followUpCount: quotationsToFollowUp.length,
        acceptedCount: acceptedQuotations,
        rejectedCount: rejectedQuotations.length,
        conversionRate,
        pipelineValue: this.formatMoney(pipelineValue),
        acceptedValue: this.formatMoney(acceptedValue),
        expiringSoonCount: quotesExpiringSoon,
      },
      projectPipeline,
      unpaidInvoices,
      reminders,
      activities,
      sections: ["pipeline commercial", "suivi chantiers", "encaissements", "dépenses"],
    };
  }

  private async resolveScope(user?: AuthenticatedUser) {
    if (user) {
      return {
        tenantId: user.tenantId,
      };
    }

    const workspace = await this.workspaceService.ensureWorkspace();
    return {
      tenantId: workspace.tenantId,
    };
  }

  private relativeDate(value: Date) {
    const diffMs = Date.now() - value.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) {
      const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
      return `il y a ${diffMinutes} min`;
    }
    if (diffHours < 24) {
      return `il y a ${diffHours} h`;
    }
    return `il y a ${Math.floor(diffHours / 24)} j`;
  }

  private invoiceStatusLabel(status: InvoiceStatus) {
    const labels: Partial<Record<InvoiceStatus, string>> = {
      [InvoiceStatus.DRAFT]: "Brouillon",
      [InvoiceStatus.ISSUED]: "Émise",
      [InvoiceStatus.PARTIALLY_PAID]: "Partiellement réglée",
      [InvoiceStatus.PAID]: "Réglée",
      [InvoiceStatus.OVERDUE]: "En retard",
      [InvoiceStatus.VOID]: "Annulée",
    };
    return labels[status] ?? status;
  }

  private deliveryStatusLabel(status: DeliveryStatus) {
    const labels: Partial<Record<DeliveryStatus, string>> = {
      [DeliveryStatus.PREPARED]: "Préparé",
      [DeliveryStatus.IN_TRANSIT]: "En transit",
      [DeliveryStatus.DELIVERED]: "Livré",
      [DeliveryStatus.CANCELLED]: "Annulé",
    };
    return labels[status] ?? status;
  }

  private formatMoney(value: number) {
    return formatTndCompact(value);
  }
}
