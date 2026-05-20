import { Injectable, NotFoundException } from "@nestjs/common";
import { formatTnd } from "@sotec/config";
import {
  ClientType,
  LeadSource,
  LeadStatus,
  Prisma,
  type QuotationStatus,
  type InvoiceStatus,
} from "@sotec/database";
import { PrismaService } from "../../common/prisma/prisma.service";
import { WorkspaceService } from "../../common/workspace/workspace.service";
import type { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { CreateClientDto } from "./dto/create-client.dto";
import { CreateLeadDto } from "./dto/create-lead.dto";
import { ListClientsDto } from "./dto/list-clients.dto";
import { ListLeadsDto } from "./dto/list-leads.dto";
import { UpdateClientDto } from "./dto/update-client.dto";
import { UpdateLeadDto } from "./dto/update-lead.dto";

type ScopeContext = {
  tenantId: string;
  branchId: string | null;
  userId: string | null;
};

type ClientWithRelations = Prisma.ClientGetPayload<{
  include: {
    contacts: true;
    quotations: {
      select: {
        number: true;
        status: true;
        totalAmount: true;
      };
    };
    invoices: {
      select: {
        number: true;
        status: true;
        balanceDue: true;
      };
    };
    projects: {
      select: {
        code: true;
        status: true;
        targetDeliveryDate: true;
      };
    };
    notes: {
      select: {
        body: true;
      };
    };
    documentLinks: {
      include: {
        file: {
          select: {
            originalName: true;
          };
        };
      };
    };
  };
}>;

type LeadWithRelations = Prisma.LeadGetPayload<{
  include: {
    assignedUser: true;
  };
}>;

@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async listClients(user: AuthenticatedUser | undefined, query: ListClientsDto) {
    const scope = await this.resolveScope(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildClientWhere(scope.tenantId, query);
    const orderBy = this.buildClientOrder(query);

    const [totalItems, clients] = await this.prisma.$transaction([
      this.prisma.client.count({ where }),
      this.prisma.client.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          contacts: {
            where: {
              deletedAt: null,
            },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          },
          quotations: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              issueDate: "desc",
            },
            select: {
              number: true,
              status: true,
              totalAmount: true,
            },
          },
          invoices: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              issueDate: "desc",
            },
            select: {
              number: true,
              status: true,
              balanceDue: true,
            },
          },
          projects: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              createdAt: "desc",
            },
            select: {
              code: true,
              status: true,
              targetDeliveryDate: true,
            },
          },
          notes: {
            take: 8,
            orderBy: {
              createdAt: "desc",
            },
            select: {
              body: true,
            },
          },
          documentLinks: {
            where: {
              file: {
                deletedAt: null,
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 8,
            include: {
              file: {
                select: {
                  originalName: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: clients.map((client) => this.toClientRecord(client)),
      meta: this.buildMeta(page, pageSize, totalItems),
    };
  }

  async getClient(user: AuthenticatedUser | undefined, clientId: string) {
    const scope = await this.resolveScope(user);
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        tenantId: scope.tenantId,
        deletedAt: null,
      },
      include: {
        contacts: {
          where: { deletedAt: null },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
        quotations: {
          where: { deletedAt: null },
          orderBy: { issueDate: "desc" },
          select: { number: true, status: true, totalAmount: true },
        },
        invoices: {
          where: { deletedAt: null },
          orderBy: { issueDate: "desc" },
          select: { number: true, status: true, balanceDue: true },
        },
        projects: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: { code: true, status: true, targetDeliveryDate: true },
        },
        notes: {
          take: 8,
          orderBy: { createdAt: "desc" },
          select: { body: true },
        },
        documentLinks: {
          where: {
            file: {
              deletedAt: null,
            },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { file: { select: { originalName: true } } },
        },
      },
    });

    if (!client) {
      throw new NotFoundException("Client not found");
    }

    return this.toClientRecord(client);
  }

  async createClient(user: AuthenticatedUser | undefined, payload: CreateClientDto) {
    const scope = await this.resolveScope(user);
    const code = payload.code?.trim() || (await this.nextClientCode(scope.tenantId));

    const client = await this.prisma.client.create({
      data: {
        tenantId: scope.tenantId,
        branchId: scope.branchId ?? undefined,
        code,
        type: payload.type === "Company" ? ClientType.COMPANY : ClientType.INDIVIDUAL,
        displayName: payload.name.trim(),
        legalName: payload.name.trim(),
        taxId: payload.taxIdentifier?.trim() || undefined,
        email: payload.email?.trim() || undefined,
        phone: payload.phone.trim(),
        city: payload.city.trim(),
        addressLine1: payload.address.trim(),
        creditLimit: this.toDecimalOrNull(payload.openingBalance),
        isActive: true,
        contacts: {
          create: {
            tenantId: scope.tenantId,
            firstName: this.firstNameFromFullName(payload.contactName),
            lastName: this.lastNameFromFullName(payload.contactName),
            email: payload.email?.trim() || undefined,
            phone: payload.phone.trim(),
            isPrimary: true,
          },
        },
        notes: payload.notes?.trim()
          ? {
              create: {
                tenantId: scope.tenantId,
                userId: scope.userId ?? undefined,
                body: payload.notes.trim(),
              },
            }
          : undefined,
      },
      select: {
        id: true,
      },
    });

    return this.getClient(user, client.id);
  }

  async updateClient(
    user: AuthenticatedUser | undefined,
    clientId: string,
    payload: UpdateClientDto,
  ) {
    const scope = await this.resolveScope(user);
    const existing = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        tenantId: scope.tenantId,
        deletedAt: null,
      },
      include: {
        contacts: {
          where: {
            deletedAt: null,
          },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!existing) {
      throw new NotFoundException("Client not found");
    }

    const primaryContact = existing.contacts[0];

    await this.prisma.client.update({
      where: {
        id: existing.id,
      },
      data: {
        code: payload.code?.trim() || existing.code,
        type:
          payload.type !== undefined
            ? payload.type === "Company"
              ? ClientType.COMPANY
              : ClientType.INDIVIDUAL
            : existing.type,
        displayName: payload.name?.trim() || existing.displayName,
        legalName: payload.name?.trim() || existing.legalName,
        taxId: payload.taxIdentifier?.trim() || existing.taxId,
        email:
          payload.email !== undefined ? payload.email.trim() || null : existing.email,
        phone: payload.phone?.trim() || existing.phone,
        city: payload.city?.trim() || existing.city,
        addressLine1: payload.address?.trim() || existing.addressLine1,
        creditLimit:
          payload.openingBalance !== undefined
            ? this.toDecimalOrNull(payload.openingBalance)
            : existing.creditLimit,
        contacts: {
          update:
            primaryContact && payload.contactName
              ? {
                  where: { id: primaryContact.id },
                  data: {
                    firstName: this.firstNameFromFullName(payload.contactName),
                    lastName: this.lastNameFromFullName(payload.contactName),
                    email:
                      payload.email !== undefined ? payload.email.trim() || null : primaryContact.email,
                    phone:
                      payload.phone !== undefined ? payload.phone.trim() || null : primaryContact.phone,
                  },
                }
              : undefined,
          create:
            !primaryContact && payload.contactName
              ? {
                  tenantId: scope.tenantId,
                  firstName: this.firstNameFromFullName(payload.contactName),
                  lastName: this.lastNameFromFullName(payload.contactName),
                  email: payload.email?.trim() || undefined,
                  phone: payload.phone?.trim() || undefined,
                  isPrimary: true,
                }
              : undefined,
        },
      },
    });

    if (payload.notes?.trim()) {
      await this.prisma.note.create({
        data: {
          tenantId: scope.tenantId,
          clientId: existing.id,
          userId: scope.userId ?? undefined,
          body: payload.notes.trim(),
        },
      });
    }

    return this.getClient(user, existing.id);
  }

  async listLeads(user: AuthenticatedUser | undefined, query: ListLeadsDto) {
    const scope = await this.resolveScope(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildLeadWhere(scope.tenantId, query);
    const orderBy = this.buildLeadOrder(query);

    const [totalItems, leads] = await this.prisma.$transaction([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          assignedUser: true,
        },
      }),
    ]);

    return {
      data: leads.map((lead) => this.toLeadRecord(lead)),
      meta: this.buildMeta(page, pageSize, totalItems),
    };
  }

  async createLead(user: AuthenticatedUser | undefined, payload: CreateLeadDto) {
    const scope = await this.resolveScope(user);
    const lead = await this.prisma.lead.create({
      data: {
        tenantId: scope.tenantId,
        branchId: scope.branchId ?? undefined,
        assignedUserId: scope.userId ?? undefined,
        fullName: payload.contactPerson.trim(),
        companyName: payload.prospect.trim(),
        phone: payload.phone.trim(),
        source: payload.source,
        status: payload.status,
        requestedWork: payload.requestedWork.trim(),
        estimatedBudget: new Prisma.Decimal(payload.budget),
        city: payload.city?.trim() || undefined,
        addressLine1: payload.address?.trim() || undefined,
        nextFollowUpAt: new Date(payload.followUp),
      },
      include: {
        assignedUser: true,
      },
    });

    return this.toLeadRecord(lead);
  }

  async updateLead(user: AuthenticatedUser | undefined, leadId: string, payload: UpdateLeadDto) {
    const scope = await this.resolveScope(user);
    const existing = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        tenantId: scope.tenantId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException("Lead not found");
    }

    const lead = await this.prisma.lead.update({
      where: {
        id: existing.id,
      },
      data: {
        fullName: payload.contactPerson?.trim() || existing.fullName,
        companyName: payload.prospect?.trim() || existing.companyName,
        phone: payload.phone?.trim() || existing.phone,
        source: payload.source ?? existing.source,
        status: payload.status ?? existing.status,
        requestedWork: payload.requestedWork?.trim() || existing.requestedWork,
        estimatedBudget:
          payload.budget !== undefined ? new Prisma.Decimal(payload.budget) : existing.estimatedBudget,
        city: payload.city?.trim() || existing.city,
        addressLine1: payload.address?.trim() || existing.addressLine1,
        nextFollowUpAt: payload.followUp ? new Date(payload.followUp) : existing.nextFollowUpAt,
      },
      include: {
        assignedUser: true,
      },
    });

    return this.toLeadRecord(lead);
  }

  async deleteLead(user: AuthenticatedUser | undefined, leadId: string) {
    const scope = await this.resolveScope(user);
    const existing = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        tenantId: scope.tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw new NotFoundException("Lead not found");
    }

    await this.prisma.lead.update({
      where: {
        id: existing.id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return { success: true };
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

  private buildClientWhere(tenantId: string, query: ListClientsDto): Prisma.ClientWhereInput {
    const search = query.search?.trim();
    return {
      tenantId,
      deletedAt: null,
      ...(query.status ? { isActive: query.status === "ACTIVE" } : {}),
      ...(query.city ? { city: { equals: query.city, mode: "insensitive" } } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { displayName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { city: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }

  private buildLeadWhere(tenantId: string, query: ListLeadsDto): Prisma.LeadWhereInput {
    const search = query.search?.trim();
    return {
      tenantId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { companyName: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { requestedWork: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }

  private buildClientOrder(query: ListClientsDto): Prisma.ClientOrderByWithRelationInput {
    switch (query.sortBy) {
      case "displayName":
      case "city":
      case "code":
      case "createdAt":
        return { [query.sortBy]: query.sortOrder };
      default:
        return { createdAt: "desc" };
    }
  }

  private buildLeadOrder(query: ListLeadsDto): Prisma.LeadOrderByWithRelationInput {
    switch (query.sortBy) {
      case "fullName":
      case "status":
      case "nextFollowUpAt":
      case "createdAt":
        return { [query.sortBy]: query.sortOrder };
      default:
        return { createdAt: "desc" };
    }
  }

  private toClientRecord(client: ClientWithRelations) {
    const primaryContact = client.contacts[0];
    const unpaidBalance = client.invoices.reduce(
      (sum, invoice) => sum + this.decimalToNumber(invoice.balanceDue),
      0,
    );

    return {
      id: client.id,
      code: client.code,
      name: client.displayName,
      type: client.type === ClientType.COMPANY ? "Company" : "Individual",
      contactName:
        `${primaryContact?.firstName ?? ""} ${primaryContact?.lastName ?? ""}`.trim() || client.displayName,
      phone: primaryContact?.phone || primaryContact?.mobile || client.phone || client.mobile || "-",
      email: primaryContact?.email || client.email || "-",
      address: this.buildAddress(client.addressLine1, client.city),
      city: client.city || "-",
      projects: client.projects.length,
      unpaidBalance: this.formatMoney(unpaidBalance),
      status: client.isActive ? "ACTIVE" : "INACTIVE",
      initials: this.buildInitials(client.displayName),
      quotations: client.quotations.map((quotation) => ({
        number: quotation.number,
        status: this.mapQuotationStatus(quotation.status),
        amount: this.formatMoney(quotation.totalAmount),
      })),
      invoices: client.invoices.map((invoice) => ({
        number: invoice.number,
        status: this.mapInvoiceStatus(invoice.status, invoice.balanceDue),
        balance: this.formatMoney(invoice.balanceDue),
      })),
      projectList: client.projects.map((project) => ({
        code: project.code,
        stage: project.status.replaceAll("_", " "),
        target: project.targetDeliveryDate
          ? `Delivery target ${this.formatDate(project.targetDeliveryDate)}`
          : "Target not set",
      })),
      documents: client.documentLinks.map((link) => link.file.originalName),
      notes: client.notes.map((note) => note.body),
    };
  }

  private toLeadRecord(lead: LeadWithRelations) {
    return {
      id: lead.id,
      prospect: lead.companyName || lead.fullName,
      source: this.formatLeadSource(lead.source),
      status: lead.status,
      requestedWork: lead.requestedWork || "-",
      budget: this.formatMoney(lead.estimatedBudget),
      assignedTo:
        lead.assignedUser
          ? `${lead.assignedUser.firstName} ${lead.assignedUser.lastName}`.trim()
          : "Unassigned",
      followUp: lead.nextFollowUpAt ? this.formatIsoDate(lead.nextFollowUpAt) : "-",
      contactPerson: lead.fullName,
      phone: lead.phone || "-",
    };
  }

  private async nextClientCode(tenantId: string) {
    const latest = await this.prisma.client.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: { code: true },
    });
    const current = latest?.code.match(/CLI-(\d{4})$/u)?.[1];
    return `CLI-${String((current ? Number.parseInt(current, 10) : 0) + 1).padStart(4, "0")}`;
  }

  private buildMeta(page: number, pageSize: number, totalItems: number) {
    return {
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    };
  }

  private decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
    if (value === null || value === undefined) {
      return 0;
    }

    return Number(value);
  }

  private toDecimalOrNull(value?: string) {
    if (!value?.trim()) {
      return null;
    }
    const normalized = Number.parseFloat(value.replaceAll(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(normalized) ? new Prisma.Decimal(normalized) : null;
  }

  private formatMoney(value: Prisma.Decimal | number | string | null | undefined) {
    return formatTnd(this.decimalToNumber(value));
  }

  private buildAddress(addressLine1?: string | null, city?: string | null) {
    const parts = [addressLine1, city].filter(Boolean);
    return parts.length ? parts.join(", ") : "-";
  }

  private buildInitials(name: string) {
    return (
      name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "C"
    );
  }

  private formatDate(value: Date) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(value);
  }

  private formatIsoDate(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private firstNameFromFullName(value: string) {
    return value.trim().split(/\s+/u)[0] || value.trim();
  }

  private lastNameFromFullName(value: string) {
    const parts = value.trim().split(/\s+/u);
    return parts.slice(1).join(" ") || parts[0] || "";
  }

  private mapQuotationStatus(status: QuotationStatus) {
    return status === "REJECTED" ? "REFUSED" : status;
  }

  private mapInvoiceStatus(status: InvoiceStatus, balanceDue: Prisma.Decimal | number | string) {
    if (status === "ISSUED" && this.decimalToNumber(balanceDue) > 0) {
      return "UNPAID";
    }
    if (status === "PARTIALLY_PAID") {
      return "PARTIAL";
    }
    return status;
  }

  private formatLeadSource(source: LeadSource) {
    return source.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}
