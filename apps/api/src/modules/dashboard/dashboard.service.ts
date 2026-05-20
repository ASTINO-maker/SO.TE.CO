import { Injectable } from "@nestjs/common";
import { formatTnd as formatTndShared } from "@sotec/config";
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

    const issuedInvoices = invoices.filter((invoice) => invoice.issueDate).slice(-6);
    const monthlyPerformance = issuedInvoices.map((invoice) => {
      const total = Number(invoice.totalAmount);
      const paid = Number(invoice.paidAmount);
      const revenue = total === 0 ? 0 : Math.min(100, Math.round((total / total) * 100));
      const cashIn = total === 0 ? 0 : Math.min(100, Math.round((paid / total) * 100));
      return {
        month: new Intl.DateTimeFormat("en-US", { month: "short" }).format(invoice.issueDate),
        revenue,
        cashIn,
      };
    });

    const quotationStatus = [
      QuotationStatus.DRAFT,
      QuotationStatus.SENT,
      QuotationStatus.UNDER_REVIEW,
      QuotationStatus.ACCEPTED,
      QuotationStatus.REJECTED,
    ].map((status) => ({
      label: status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()),
      count: quotations.filter((quotation) => quotation.status === status).length,
    }));

    const projectPipeline = [
      { stage: "Planned", count: projects.filter((project) => project.status === ProjectStatus.PLANNED).length, note: "Awaiting launch" },
      { stage: "In progress", count: projects.filter((project) => project.status === ProjectStatus.IN_PROGRESS).length, note: "Workshop or site execution" },
      { stage: "On hold", count: projects.filter((project) => project.status === ProjectStatus.ON_HOLD).length, note: "Blocked or pending approval" },
      { stage: "Completed", count: projects.filter((project) => project.status === ProjectStatus.COMPLETED).length, note: "Delivered and closed" },
    ];

    const unpaidInvoices = invoices
      .filter((invoice) => Number(invoice.balanceDue) > 0)
      .slice(0, 4)
      .map((invoice) => ({
        number: invoice.number,
        client: invoice.client.displayName,
        due: invoice.dueDate ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(invoice.dueDate) : "-",
        amount: formatTndShared(Number(invoice.balanceDue)),
        status: invoice.status === InvoiceStatus.OVERDUE ? "Overdue" : "Open",
      }));

    const reminders = [
      ...leads
        .filter((lead) => lead.nextFollowUpAt)
        .slice(0, 2)
        .map((lead) => ({
          title: `Follow up ${lead.fullName}`,
          due: lead.nextFollowUpAt
            ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(lead.nextFollowUpAt)
            : "-",
          owner: "Sales",
        })),
      ...invoices
        .filter((invoice) => invoice.status === InvoiceStatus.OVERDUE)
        .slice(0, 1)
        .map((invoice) => ({
          title: `Collect ${invoice.number}`,
          due: invoice.dueDate
            ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(invoice.dueDate)
            : "-",
          owner: "Accounting",
        })),
    ];

    const activities = [
      ...quotations.slice(0, 2).map((quotation) => ({
        title: `${quotation.number} ${quotation.status.replaceAll("_", " ").toLowerCase()}`,
        time: this.relativeDate(quotation.updatedAt),
        type: "Commercial",
      })),
      ...invoices.slice(0, 2).map((invoice) => ({
        title: `${invoice.number} ${invoice.status.replaceAll("_", " ").toLowerCase()}`,
        time: this.relativeDate(invoice.updatedAt),
        type: "Finance",
      })),
      ...deliveryNotes.slice(0, 1).map((note) => ({
        title: `${note.number} ${note.status.replaceAll("_", " ").toLowerCase()}`,
        time: this.relativeDate(note.updatedAt),
        type: "Logistics",
      })),
    ].slice(0, 5);

    return {
      kpis: [
        { label: "Open leads", value: String(openLeads), trend: `${leads.length} total leads`, tone: "warning" },
        { label: "Accepted quotations", value: String(acceptedQuotations), trend: `${quotations.length} quotations`, tone: "positive" },
        { label: "Active projects", value: String(activeProjects), trend: `${projects.length} total chantiers`, tone: "neutral" },
        {
          label: "Outstanding receivables",
          value: formatTndShared(outstandingAmount),
          trend: `${unpaidInvoices.length} invoices unpaid`,
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
        unpaidCount: invoices.filter((invoice) => Number(invoice.balanceDue) > 0).length,
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
      sections: ["sales pipeline", "execution health", "cash collection", "expense watch"],
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
      return `${diffMinutes} min ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    return `${Math.floor(diffHours / 24)}d ago`;
  }

  private formatMoney(value: number) {
    return formatTndShared(value);
  }
}
