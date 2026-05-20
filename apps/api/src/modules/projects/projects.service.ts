import { Injectable, NotFoundException } from "@nestjs/common";
import { formatTnd } from "@sotec/config";
import { Prisma, ProjectStatus } from "@sotec/database";
import { ListQueryDto } from "../../common/dto/list-query.dto";
import { PrismaService } from "../../common/prisma/prisma.service";
import { WorkspaceService } from "../../common/workspace/workspace.service";
import type { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

type ScopeContext = {
  tenantId: string;
  branchId: string | null;
  userId: string | null;
};

const projectDetailsInclude = Prisma.validator<Prisma.ProjectInclude>()({
  client: true,
  quotation: true,
  projectManager: true,
  assignments: {
    include: {
      user: true,
    },
  },
  stages: {
    where: {
      deletedAt: null,
    },
    orderBy: {
      sortOrder: "asc",
    },
  },
  measurements: {
    orderBy: {
      measuredAt: "desc",
    },
    take: 8,
  },
  tasks: {
    where: {
      deletedAt: null,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 8,
  },
  deliveryNotes: {
    where: {
      deletedAt: null,
    },
    orderBy: {
      deliveryDate: "desc",
    },
    take: 6,
  },
  invoices: {
    where: {
      deletedAt: null,
    },
    orderBy: {
      issueDate: "desc",
    },
    take: 6,
  },
  expenses: {
    where: {
      deletedAt: null,
    },
    orderBy: {
      expenseDate: "desc",
    },
    take: 6,
    include: {
      category: true,
    },
  },
  files: {
    include: {
      file: true,
    },
    take: 8,
  },
});

type ProjectWithDetails = Prisma.ProjectGetPayload<{
  include: typeof projectDetailsInclude;
}>;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async list(user: AuthenticatedUser | undefined, query: ListQueryDto) {
    const scope = await this.resolveScope(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const search = query.search?.trim();
    const where: Prisma.ProjectWhereInput = {
      tenantId: scope.tenantId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { siteAddress: { contains: search, mode: "insensitive" } },
              { client: { displayName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [totalItems, items] = await this.prisma.$transaction([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        orderBy: [{ targetDeliveryDate: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: projectDetailsInclude,
      }),
    ]);

    return {
      data: items.map((project) => this.toProjectRecord(project)),
      meta: this.buildMeta(page, pageSize, totalItems),
    };
  }

  async create(user: AuthenticatedUser | undefined, payload: CreateProjectDto) {
    const scope = await this.resolveScope(user);
    const client = await this.prisma.client.findFirst({
      where: {
        tenantId: scope.tenantId,
        displayName: payload.client.trim(),
        deletedAt: null,
      },
    });

    if (!client) {
      throw new NotFoundException("Client not found");
    }

    const quotation = payload.quotationLink?.trim()
      ? await this.prisma.quotation.findFirst({
          where: {
            tenantId: scope.tenantId,
            number: payload.quotationLink.trim(),
            deletedAt: null,
          },
        })
      : null;

    const code = await this.nextProjectCode(scope.tenantId, payload.targetDelivery);
    const budgetAmount = quotation?.totalAmount ? Number(quotation.totalAmount) : 0;

    const project = await this.prisma.project.create({
      data: {
        tenantId: scope.tenantId,
        branchId: scope.branchId ?? undefined,
        clientId: client.id,
        quotationId: quotation?.id,
        projectManagerId: scope.userId ?? undefined,
        createdByUserId: scope.userId ?? undefined,
        code,
        name: payload.title.trim(),
        description: payload.notes?.trim() || undefined,
        siteAddress: payload.address.trim(),
        city: this.extractCity(payload.address),
        status: payload.status ?? ProjectStatus.PLANNED,
        targetDeliveryDate: payload.targetDelivery ? new Date(payload.targetDelivery) : undefined,
        budgetAmount: budgetAmount ? new Prisma.Decimal(budgetAmount) : undefined,
        billedAmount: new Prisma.Decimal(0),
        paidAmount: new Prisma.Decimal(0),
        progressPercent: 0,
      },
      include: projectDetailsInclude,
    });

    return this.toProjectRecord(project);
  }

  async update(user: AuthenticatedUser | undefined, id: string, payload: UpdateProjectDto) {
    const scope = await this.resolveScope(user);
    const existing = await this.prisma.project.findFirst({
      where: {
        id,
        tenantId: scope.tenantId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException("Project not found");
    }

    const client = payload.client?.trim()
      ? await this.prisma.client.findFirst({
          where: {
            tenantId: scope.tenantId,
            displayName: payload.client.trim(),
            deletedAt: null,
          },
        })
      : undefined;

    if (payload.client !== undefined && !client) {
      throw new NotFoundException("Client not found");
    }

    const quotationLink = payload.quotationLink?.trim();
    const quotation = quotationLink
      ? await this.prisma.quotation.findFirst({
          where: {
            tenantId: scope.tenantId,
            number: quotationLink,
            deletedAt: null,
          },
        })
      : undefined;

    if (payload.quotationLink !== undefined && quotationLink && !quotation) {
      throw new NotFoundException("Quotation not found");
    }

    const nextAddress = payload.address?.trim() ?? existing.siteAddress ?? "";
    const project = await this.prisma.project.update({
      where: {
        id: existing.id,
      },
      data: {
        ...(client ? { clientId: client.id } : {}),
        ...(payload.title !== undefined ? { name: payload.title.trim() } : {}),
        ...(payload.notes !== undefined ? { description: payload.notes?.trim() || null } : {}),
        ...(payload.address !== undefined
          ? {
              siteAddress: nextAddress,
              city: this.extractCity(nextAddress),
            }
          : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.targetDelivery !== undefined
          ? {
              targetDeliveryDate: payload.targetDelivery ? new Date(payload.targetDelivery) : null,
            }
          : {}),
        ...(payload.quotationLink !== undefined
          ? {
              quotationId: quotationLink ? quotation?.id ?? null : null,
            }
          : {}),
      },
      include: projectDetailsInclude,
    });

    return this.toProjectRecord(project);
  }

  async remove(user: AuthenticatedUser | undefined, id: string) {
    const scope = await this.resolveScope(user);
    const result = await this.prisma.project.updateMany({
      where: {
        id,
        tenantId: scope.tenantId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    if (!result.count) {
      throw new NotFoundException("Project not found");
    }

    return { success: true };
  }

  async statusTimeline(user: AuthenticatedUser | undefined) {
    const scope = await this.resolveScope(user);
    const events = await this.prisma.projectStatusHistory.findMany({
      where: {
        tenantId: scope.tenantId,
      },
      orderBy: {
        changedAt: "desc",
      },
      take: 20,
      include: {
        project: true,
      },
    });

    return {
      events: events.map((event) => ({
        project: event.project.code,
        title: `${event.project.name} -> ${event.toStatus.replaceAll("_", " ")}`,
        at: event.changedAt,
      })),
      purpose: "Track chantier progress and blockers",
    };
  }

  private async resolveScope(user?: AuthenticatedUser): Promise<ScopeContext> {
    if (user) {
      return {
        tenantId: user.tenantId,
        branchId: user.branchId,
        userId: user.userId,
      };
    }

    const workspace = await this.workspaceService.ensureWorkspace();
    return {
      tenantId: workspace.tenantId,
      branchId: workspace.branchId,
      userId: workspace.adminUserId,
    };
  }

  private async nextProjectCode(tenantId: string, targetDelivery?: string) {
    const year = targetDelivery ? new Date(targetDelivery).getUTCFullYear() : new Date().getUTCFullYear();
    const latest = await this.prisma.project.findFirst({
      where: {
        tenantId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        code: true,
      },
    });
    const current = latest?.code.match(/PRO-\d{4}-(\d{4})$/u)?.[1];
    return `PRO-${year}-${String((current ? Number.parseInt(current, 10) : 0) + 1).padStart(4, "0")}`;
  }

  private toProjectRecord(project: ProjectWithDetails) {
    const currentStage =
      project.stages.find((stage) => stage.status === "IN_PROGRESS") ??
      project.stages.find((stage) => stage.status === "BLOCKED") ??
      project.stages[0];

    return {
      id: project.id,
      code: project.code,
      title: project.name,
      client: project.client.displayName,
      status: this.mapProjectStatus(project.status),
      delivery: project.targetDeliveryDate ? this.formatDate(project.targetDeliveryDate) : "-",
      progress: `${project.progressPercent}%`,
      billedPaid: `${this.formatCompactMoney(project.paidAmount)} / ${this.formatCompactMoney(project.billedAmount || project.budgetAmount || 0)}`,
      address: this.buildAddress(project.siteAddress, project.city),
      notes: project.description || "",
      manager: [project.projectManager?.firstName, project.projectManager?.lastName].filter(Boolean).join(" ") || "Unassigned",
      team: project.assignments.map((assignment) => [assignment.user.firstName, assignment.user.lastName].filter(Boolean).join(" ")),
      quotation: project.quotation?.number || "-",
      stage: currentStage?.name || project.status.replaceAll("_", " "),
      measurements: project.measurements.map((measurement) => measurement.label),
      tasks: project.tasks.map((task) => ({
        label: task.title,
        state: task.status.replaceAll("_", " "),
      })),
      finance: [
        { label: "Budget", value: this.formatCompactMoney(project.budgetAmount || 0) },
        { label: "Billed", value: this.formatCompactMoney(project.billedAmount) },
        { label: "Collected", value: this.formatCompactMoney(project.paidAmount) },
        {
          label: "Remaining to bill",
          value: this.formatCompactMoney((project.budgetAmount || new Prisma.Decimal(0)).minus(project.billedAmount || new Prisma.Decimal(0))),
          emphasis: true,
        },
      ],
      deliveryNotes: project.deliveryNotes.map((note) => `${note.number} - ${this.formatDate(note.deliveryDate)}`),
      invoices: project.invoices.map((invoice) => `${invoice.number} - ${this.formatCompactMoney(invoice.totalAmount)}`),
      expenses: project.expenses.map((expense) => `${expense.title} - ${this.formatCompactMoney(expense.amount)}`),
      documents: project.files.map((file) => file.file.originalName),
    };
  }

  private buildAddress(siteAddress?: string | null, city?: string | null) {
    return [siteAddress, city].filter(Boolean).join(", ") || "-";
  }

  private mapProjectStatus(status: ProjectStatus) {
    if (status === "DRAFT") {
      return "PLANNED";
    }
    return status;
  }

  private formatCompactMoney(value: Prisma.Decimal | number | string) {
    return formatTnd(Number(value));
  }

  private formatDate(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private buildMeta(page: number, pageSize: number, totalItems: number) {
    return {
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    };
  }

  private extractCity(address?: string | null) {
    const value = address?.trim();
    if (!value) {
      return null;
    }

    return value.split(",").at(-1)?.trim() || value;
  }
}
