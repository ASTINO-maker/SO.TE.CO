import { Injectable, NotFoundException } from "@nestjs/common";
import { formatTnd, formatTnQuantity } from "@sotec/config";
import {
  DeliveryStatus,
  InvoiceStatus,
  PaymentStatus,
  Prisma,
  QuotationStatus,
  type DeliveryNote,
  type DeliveryNoteItem,
  type Invoice,
  type InvoiceItem,
  type Payment,
  type PaymentAllocation,
  type Quotation,
  type QuotationItem,
} from "@sotec/database";
import { PrismaService } from "../../common/prisma/prisma.service";
import { WorkspaceService } from "../../common/workspace/workspace.service";
import type { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { CreateQuotationDto } from "./dto/create-quotation.dto";
import { CreateDeliveryNoteDto } from "./dto/create-delivery-note.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { ListInvoicesDto } from "./dto/list-invoices.dto";
import { ListQuotationsDto } from "./dto/list-quotations.dto";
import { ListQueryDto } from "../../common/dto/list-query.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { UpdatePaymentDto } from "./dto/update-payment.dto";
import { UpdateQuotationDto } from "./dto/update-quotation.dto";
import { UpdateDeliveryNoteDto } from "./dto/update-delivery-note.dto";

type ScopeContext = {
  tenantId: string;
  branchId: string | null;
  userId: string | null;
};

type QuotationWithRelations = Prisma.QuotationGetPayload<{
  include: {
    client: true;
    items: true;
  };
}>;

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: {
    client: true;
    items: true;
  };
}>;

type DeliveryNoteWithRelations = Prisma.DeliveryNoteGetPayload<{
  include: {
    client: true;
    project: true;
    vehicle: true;
    items: true;
  };
}>;

type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: {
    client: true;
    project: true;
    allocations: {
      include: {
        invoice: true;
      };
    };
  };
}>;

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async quotations(user: AuthenticatedUser | undefined, query: ListQuotationsDto) {
    const scope = await this.resolveScope(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildQuotationWhere(scope.tenantId, query);
    const orderBy = this.buildQuotationOrder(query);

    const [totalItems, quotations] = await this.prisma.$transaction([
      this.prisma.quotation.count({ where }),
      this.prisma.quotation.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          client: true,
          items: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      }),
    ]);

    return {
      data: quotations.map((quotation) => this.toQuotationRecord(quotation)),
      meta: this.buildMeta(page, pageSize, totalItems),
    };
  }

  async createQuotation(user: AuthenticatedUser | undefined, payload: CreateQuotationDto) {
    const scope = await this.resolveScope(user);
    const client = await this.findClientByName(scope.tenantId, payload.client);
    const number = await this.nextQuotationNumber(scope.tenantId, new Date(payload.issueDate));
    const customLines = (payload.lines ?? [])
      .map((line) => ({
        label: line.description.trim(),
        quantityValue: line.quantity,
        unitLabel: (line.unit ?? "").trim() || "u",
        unitPriceValue: line.unitPrice,
        totalValue: line.quantity * line.unitPrice,
      }))
      .filter((line) => line.label && line.quantityValue > 0 && line.unitPriceValue > 0);

    const lines = customLines.length
      ? customLines
      : this.buildQuotationLines(payload.scope.trim(), payload.itemCount, payload.amount);
    const totalAmountValue = lines.reduce((sum, line) => sum + line.totalValue, 0);
    const totalAmount = new Prisma.Decimal(totalAmountValue);

    const quotation = await this.prisma.quotation.create({
      data: {
        tenantId: scope.tenantId,
        branchId: scope.branchId ?? undefined,
        clientId: client.id,
        createdByUserId: scope.userId ?? undefined,
        number,
        title: payload.chantier.trim(),
        status: payload.status,
        issueDate: new Date(payload.issueDate),
        validUntil: new Date(payload.validUntil),
        currency: "TND",
        subtotalAmount: totalAmount,
        totalAmount,
        clientNotes: payload.scope.trim(),
        internalNotes: payload.note?.trim() || undefined,
        items: {
          create: lines.map((line, index) => ({
            tenantId: scope.tenantId,
            sortOrder: index + 1,
            itemName: line.label,
            description: line.label,
            quantity: new Prisma.Decimal(line.quantityValue),
            unitLabel: ("unitLabel" in line && line.unitLabel) || "u",
            unitPrice: new Prisma.Decimal(line.unitPriceValue),
            lineSubtotal: new Prisma.Decimal(line.totalValue),
            lineTotal: new Prisma.Decimal(line.totalValue),
          })),
        },
      },
      include: {
        client: true,
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    return this.toQuotationRecord(quotation);
  }

  async quotationById(user: AuthenticatedUser | undefined, id: string) {
    const scope = await this.resolveScope(user);
    const quotation = await this.prisma.quotation.findFirst({
      where: {
        id,
        tenantId: scope.tenantId,
        deletedAt: null,
      },
      include: {
        client: true,
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    if (!quotation) {
      throw new NotFoundException("Quotation not found");
    }

    return this.toQuotationRecord(quotation);
  }

  async updateQuotation(user: AuthenticatedUser | undefined, id: string, payload: UpdateQuotationDto) {
    const scope = await this.resolveScope(user);
    const existing = await this.prisma.quotation.findFirst({
      where: {
        id,
        tenantId: scope.tenantId,
        deletedAt: null,
      },
      include: {
        client: true,
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException("Quotation not found");
    }

    const client = payload.client ? await this.findClientByName(scope.tenantId, payload.client) : null;
    const validLines = payload.lines
      ? payload.lines
          .map((line) => ({
            label: line.description.trim(),
            quantityValue: line.quantity,
            unitLabel: (line.unit ?? "").trim() || "u",
            unitPriceValue: line.unitPrice,
            totalValue: line.quantity * line.unitPrice,
          }))
          .filter((line) => line.label && line.quantityValue > 0 && line.unitPriceValue > 0)
      : null;

    if (payload.lines && (!validLines || !validLines.length)) {
      throw new NotFoundException("At least one quotation line is required");
    }

    const updated = await this.prisma.quotation.update({
      where: {
        id: existing.id,
      },
      data: {
        ...(client ? { clientId: client.id } : {}),
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.issueDate ? { issueDate: new Date(payload.issueDate) } : {}),
        ...(payload.validUntil ? { validUntil: new Date(payload.validUntil) } : {}),
        ...(payload.chantier !== undefined ? { title: payload.chantier.trim() } : {}),
        ...(payload.scope !== undefined ? { clientNotes: payload.scope.trim() } : {}),
        ...(payload.note !== undefined ? { internalNotes: payload.note?.trim() || null } : {}),
        ...(validLines
          ? {
              subtotalAmount: new Prisma.Decimal(validLines.reduce((sum, line) => sum + line.totalValue, 0)),
              totalAmount: new Prisma.Decimal(validLines.reduce((sum, line) => sum + line.totalValue, 0)),
              items: {
                deleteMany: {},
                create: validLines.map((line, index) => ({
                  tenantId: scope.tenantId,
                  sortOrder: index + 1,
                  itemName: line.label,
                  description: line.label,
                  quantity: new Prisma.Decimal(line.quantityValue),
                  unitLabel: line.unitLabel,
                  unitPrice: new Prisma.Decimal(line.unitPriceValue),
                  lineSubtotal: new Prisma.Decimal(line.totalValue),
                  lineTotal: new Prisma.Decimal(line.totalValue),
                })),
              },
            }
          : {}),
      },
      include: {
        client: true,
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    return this.toQuotationRecord(updated);
  }

  async deleteQuotation(user: AuthenticatedUser | undefined, id: string) {
    const scope = await this.resolveScope(user);
    const result = await this.prisma.quotation.updateMany({
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
      throw new NotFoundException("Quotation not found");
    }

    return { success: true };
  }

  async invoices(user: AuthenticatedUser | undefined, query: ListInvoicesDto) {
    const scope = await this.resolveScope(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildInvoiceWhere(scope.tenantId, query);
    const orderBy = this.buildInvoiceOrder(query);

    const [totalItems, invoices] = await this.prisma.$transaction([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          client: true,
          items: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      }),
    ]);

    return {
      data: invoices.map((invoice) => this.toInvoiceRecord(invoice)),
      meta: this.buildMeta(page, pageSize, totalItems),
    };
  }

  async createInvoice(user: AuthenticatedUser | undefined, payload: CreateInvoiceDto) {
    const scope = await this.resolveScope(user);
    const client = await this.findClientByName(scope.tenantId, payload.client);
    const number = await this.nextInvoiceNumber(scope.tenantId);
    const validLines = payload.lines
      .map((line) => ({
        label: line.description.trim(),
        quantityValue: line.quantity,
        unitLabel: (line.unit ?? "").trim() || "u",
        unitPriceValue: line.unitPrice,
        totalValue: line.quantity * line.unitPrice,
      }))
      .filter((line) => line.label && line.unitPriceValue > 0 && line.quantityValue > 0);

    if (!validLines.length) {
      throw new NotFoundException("At least one invoice line is required");
    }

    const totalAmount = validLines.reduce((sum, line) => sum + line.totalValue, 0);
    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId: scope.tenantId,
        branchId: scope.branchId ?? undefined,
        clientId: client.id,
        createdByUserId: scope.userId ?? undefined,
        number,
        status: InvoiceStatus.ISSUED,
        issueDate: new Date(payload.issueDate),
        dueDate: new Date(payload.dueDate),
        currency: "TND",
        subtotalAmount: new Prisma.Decimal(totalAmount),
        totalAmount: new Prisma.Decimal(totalAmount),
        paidAmount: new Prisma.Decimal(0),
        balanceDue: new Prisma.Decimal(totalAmount),
        customerNotes: payload.note?.trim() || undefined,
        internalNotes: payload.origin.trim(),
        items: {
          create: validLines.map((line, index) => ({
            tenantId: scope.tenantId,
            sortOrder: index + 1,
            itemName: line.label,
            description: payload.note?.trim() || payload.origin.trim(),
            quantity: new Prisma.Decimal(line.quantityValue),
            unitLabel: line.unitLabel,
            unitPrice: new Prisma.Decimal(line.unitPriceValue),
            lineSubtotal: new Prisma.Decimal(line.totalValue),
            lineTotal: new Prisma.Decimal(line.totalValue),
          })),
        },
      },
      include: {
        client: true,
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    return this.toInvoiceRecord(invoice, payload.paymentTerms);
  }

  async invoiceById(user: AuthenticatedUser | undefined, id: string) {
    const scope = await this.resolveScope(user);
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        tenantId: scope.tenantId,
        deletedAt: null,
      },
      include: {
        client: true,
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    return this.toInvoiceRecord(invoice);
  }

  async updateInvoice(user: AuthenticatedUser | undefined, id: string, payload: UpdateInvoiceDto) {
    const scope = await this.resolveScope(user);
    const existing = await this.prisma.invoice.findFirst({
      where: {
        id,
        tenantId: scope.tenantId,
        deletedAt: null,
      },
      include: {
        client: true,
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException("Invoice not found");
    }

    const client = payload.client ? await this.findClientByName(scope.tenantId, payload.client) : null;
    const validLines = payload.lines
      ? payload.lines
          .map((line) => ({
            label: line.description.trim(),
            quantityValue: line.quantity,
            unitLabel: (line.unit ?? "").trim() || "u",
            unitPriceValue: line.unitPrice,
            totalValue: line.quantity * line.unitPrice,
          }))
          .filter((line) => line.label && line.unitPriceValue > 0 && line.quantityValue > 0)
      : null;

    if (payload.lines && (!validLines || !validLines.length)) {
      throw new NotFoundException("At least one invoice line is required");
    }

    const nextTotal = validLines
      ? validLines.reduce((sum, line) => sum + line.totalValue, 0)
      : this.decimalToNumber(existing.totalAmount);
    const paidAmount = this.decimalToNumber(existing.paidAmount);
    const nextBalanceDue = Math.max(0, nextTotal - paidAmount);

    const updated = await this.prisma.invoice.update({
      where: {
        id: existing.id,
      },
      data: {
        ...(client ? { clientId: client.id } : {}),
        ...(payload.issueDate ? { issueDate: new Date(payload.issueDate) } : {}),
        ...(payload.dueDate ? { dueDate: new Date(payload.dueDate) } : {}),
        ...(payload.note !== undefined ? { customerNotes: payload.note?.trim() || null } : {}),
        ...(payload.origin !== undefined ? { internalNotes: payload.origin.trim() } : {}),
        ...(validLines
          ? {
              subtotalAmount: new Prisma.Decimal(nextTotal),
              totalAmount: new Prisma.Decimal(nextTotal),
              balanceDue: new Prisma.Decimal(nextBalanceDue),
              items: {
                deleteMany: {},
                create: validLines.map((line, index) => ({
                  tenantId: scope.tenantId,
                  sortOrder: index + 1,
                  itemName: line.label,
                  description: payload.note?.trim() || payload.origin?.trim() || existing.internalNotes || undefined,
                  quantity: new Prisma.Decimal(line.quantityValue),
                  unitLabel: line.unitLabel,
                  unitPrice: new Prisma.Decimal(line.unitPriceValue),
                  lineSubtotal: new Prisma.Decimal(line.totalValue),
                  lineTotal: new Prisma.Decimal(line.totalValue),
                })),
              },
            }
          : {}),
      },
      include: {
        client: true,
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    return this.toInvoiceRecord(updated, payload.paymentTerms || undefined);
  }

  async deleteInvoice(user: AuthenticatedUser | undefined, id: string) {
    const scope = await this.resolveScope(user);
    const result = await this.prisma.invoice.updateMany({
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
      throw new NotFoundException("Invoice not found");
    }

    return { success: true };
  }

  async deliveryNotes(user: AuthenticatedUser | undefined, query: ListQueryDto) {
    const scope = await this.resolveScope(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();

    const where: Prisma.DeliveryNoteWhereInput = {
      tenantId: scope.tenantId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: "insensitive" } },
              { receiverName: { contains: search, mode: "insensitive" } },
              { siteAddress: { contains: search, mode: "insensitive" } },
              { client: { displayName: { contains: search, mode: "insensitive" } } },
              { project: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [totalItems, notes] = await this.prisma.$transaction([
      this.prisma.deliveryNote.count({ where }),
      this.prisma.deliveryNote.findMany({
        where,
        orderBy: { deliveryDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          client: true,
          project: true,
          vehicle: true,
          items: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      }),
    ]);

    return {
      data: notes.map((note) => this.toDeliveryNoteRecord(note)),
      meta: this.buildMeta(page, pageSize, totalItems),
    };
  }

  async createDeliveryNote(user: AuthenticatedUser | undefined, payload: CreateDeliveryNoteDto) {
    const scope = await this.resolveScope(user);
    const project = await this.prisma.project.findFirst({
      where: {
        tenantId: scope.tenantId,
        name: payload.project.trim(),
        deletedAt: null,
      },
      include: {
        client: true,
      },
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    const vehicle = await this.ensureVehicle(scope, payload.vehicle);
    const number = await this.nextDeliveryNoteNumber(scope.tenantId);
    const items = payload.itemsNote
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const match = line.match(/(.+?)\sx(.+)$/u);
        const quantityRaw = match?.[2]?.trim() || "1";
        const quantityValue = Number.parseFloat(quantityRaw.replace(/[^\d.,-]/g, "").replace(",", "."));
        return {
          sortOrder: index + 1,
          itemName: (match?.[1]?.trim() || line).trim(),
          quantity: Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : 1,
          unitLabel: /lot/i.test(quantityRaw) ? "lot" : /pc/i.test(quantityRaw) ? "pcs" : "unit",
          rawQuantity: quantityRaw,
        };
      });

    if (!items.length) {
      throw new NotFoundException("At least one delivery item is required");
    }

    const note = await this.prisma.deliveryNote.create({
      data: {
        tenantId: scope.tenantId,
        branchId: scope.branchId ?? undefined,
        clientId: project.clientId,
        projectId: project.id,
        vehicleId: vehicle?.id,
        createdByUserId: scope.userId ?? undefined,
        number,
        status: payload.status,
        deliveryDate: new Date(payload.scheduledAt),
        receiverName: payload.responsible.trim(),
        receiverPhone: project.client.phone || project.client.mobile || undefined,
        siteAddress: payload.destination.trim(),
        internalNotes: payload.itemsNote.trim(),
        items: {
          create: items.map((item) => ({
            tenantId: scope.tenantId,
            sortOrder: item.sortOrder,
            itemName: item.itemName,
            quantity: new Prisma.Decimal(item.quantity),
            unitLabel: item.unitLabel,
          })),
        },
      },
      include: {
        client: true,
        project: true,
        vehicle: true,
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    return this.toDeliveryNoteRecord(note);
  }

  async deliveryNoteById(user: AuthenticatedUser | undefined, id: string) {
    const scope = await this.resolveScope(user);
    const note = await this.prisma.deliveryNote.findFirst({
      where: {
        id,
        tenantId: scope.tenantId,
        deletedAt: null,
      },
      include: {
        client: true,
        project: true,
        vehicle: true,
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    if (!note) {
      throw new NotFoundException("Delivery note not found");
    }

    return this.toDeliveryNoteRecord(note);
  }

  async updateDeliveryNote(user: AuthenticatedUser | undefined, id: string, payload: UpdateDeliveryNoteDto) {
    const scope = await this.resolveScope(user);
    const existing = await this.prisma.deliveryNote.findFirst({
      where: {
        id,
        tenantId: scope.tenantId,
        deletedAt: null,
      },
      include: {
        client: true,
        project: true,
        vehicle: true,
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException("Delivery note not found");
    }

    const project = payload.project?.trim()
      ? await this.prisma.project.findFirst({
          where: {
            tenantId: scope.tenantId,
            name: payload.project.trim(),
            deletedAt: null,
          },
          include: {
            client: true,
          },
        })
      : null;

    if (payload.project && !project) {
      throw new NotFoundException("Project not found");
    }

    const vehicle = payload.vehicle !== undefined ? await this.ensureVehicle(scope, payload.vehicle) : undefined;
    const items = payload.itemsNote
      ? payload.itemsNote
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line, index) => {
            const match = line.match(/(.+?)\sx(.+)$/u);
            const quantityRaw = match?.[2]?.trim() || "1";
            const quantityValue = Number.parseFloat(quantityRaw.replace(/[^\d.,-]/g, "").replace(",", "."));
            return {
              sortOrder: index + 1,
              itemName: (match?.[1]?.trim() || line).trim(),
              quantity: Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : 1,
              unitLabel: /lot/i.test(quantityRaw) ? "lot" : /pc/i.test(quantityRaw) ? "pcs" : "unit",
            };
          })
      : null;

    if (payload.itemsNote && (!items || !items.length)) {
      throw new NotFoundException("At least one delivery item is required");
    }

    const updated = await this.prisma.deliveryNote.update({
      where: {
        id: existing.id,
      },
      data: {
        ...(project
          ? {
              projectId: project.id,
              clientId: project.clientId,
            }
          : {}),
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.destination !== undefined ? { siteAddress: payload.destination.trim() } : {}),
        ...(payload.responsible !== undefined ? { receiverName: payload.responsible.trim() } : {}),
        ...(payload.scheduledAt ? { deliveryDate: new Date(payload.scheduledAt) } : {}),
        ...(vehicle !== undefined ? { vehicleId: vehicle?.id || null } : {}),
        ...(payload.itemsNote !== undefined ? { internalNotes: payload.itemsNote.trim() } : {}),
        ...(items
          ? {
              items: {
                deleteMany: {},
                create: items.map((item) => ({
                  tenantId: scope.tenantId,
                  sortOrder: item.sortOrder,
                  itemName: item.itemName,
                  quantity: new Prisma.Decimal(item.quantity),
                  unitLabel: item.unitLabel,
                })),
              },
            }
          : {}),
      },
      include: {
        client: true,
        project: true,
        vehicle: true,
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    return this.toDeliveryNoteRecord(updated);
  }

  async deleteDeliveryNote(user: AuthenticatedUser | undefined, id: string) {
    const scope = await this.resolveScope(user);
    const result = await this.prisma.deliveryNote.updateMany({
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
      throw new NotFoundException("Delivery note not found");
    }

    return { success: true };
  }

  async payments(user: AuthenticatedUser | undefined, query: ListQueryDto) {
    const scope = await this.resolveScope(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();
    const where: Prisma.PaymentWhereInput = {
      tenantId: scope.tenantId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: "insensitive" } },
              { reference: { contains: search, mode: "insensitive" } },
              { internalNotes: { contains: search, mode: "insensitive" } },
              { client: { displayName: { contains: search, mode: "insensitive" } } },
              { project: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [totalItems, items] = await this.prisma.$transaction([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        orderBy: {
          paymentDate: "desc",
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          client: true,
          project: true,
          allocations: {
            include: {
              invoice: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      }),
    ]);

    return {
      data: items.map((payment) => this.toPaymentRecord(payment)),
      meta: this.buildMeta(page, pageSize, totalItems),
    };
  }

  async createPayment(user: AuthenticatedUser | undefined, payload: CreatePaymentDto) {
    const scope = await this.resolveScope(user);
    const client = await this.findClientByName(scope.tenantId, payload.client);
    const project = payload.project?.trim()
      ? await this.prisma.project.findFirst({
          where: {
            tenantId: scope.tenantId,
            deletedAt: null,
            OR: [{ name: payload.project.trim() }, { code: payload.project.trim() }],
          },
        })
      : null;
    const paymentDate = new Date(payload.paymentDate);
    const number = await this.nextPaymentNumber(scope.tenantId, paymentDate);

    const payment = await this.prisma.payment.create({
      data: {
        tenantId: scope.tenantId,
        branchId: scope.branchId ?? undefined,
        clientId: client.id,
        projectId: project?.id,
        receivedByUserId: scope.userId ?? undefined,
        number,
        status: payload.status,
        method: payload.method,
        paymentDate,
        amount: new Prisma.Decimal(payload.amount),
        currency: "TND",
        reference: payload.reference?.trim() || undefined,
        internalNotes: payload.note?.trim() || undefined,
      },
      include: {
        client: true,
        project: true,
        allocations: {
          include: {
            invoice: true,
          },
        },
      },
    });

    return this.toPaymentRecord(payment);
  }

  async updatePayment(user: AuthenticatedUser | undefined, id: string, payload: UpdatePaymentDto) {
    const scope = await this.resolveScope(user);
    const existing = await this.prisma.payment.findFirst({
      where: {
        id,
        tenantId: scope.tenantId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException("Payment not found");
    }

    const client = payload.client ? await this.findClientByName(scope.tenantId, payload.client) : null;
    const projectLabel = payload.project?.trim();
    const project =
      payload.project === undefined
        ? undefined
        : projectLabel
          ? await this.prisma.project.findFirst({
              where: {
                tenantId: scope.tenantId,
                deletedAt: null,
                OR: [{ name: projectLabel }, { code: projectLabel }],
              },
            })
          : null;

    if (payload.project !== undefined && projectLabel && !project) {
      throw new NotFoundException("Project not found");
    }

    const payment = await this.prisma.payment.update({
      where: {
        id: existing.id,
      },
      data: {
        ...(client ? { clientId: client.id } : {}),
        ...(payload.project !== undefined ? { projectId: project?.id ?? null } : {}),
        ...(payload.method !== undefined ? { method: payload.method } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.amount !== undefined ? { amount: new Prisma.Decimal(payload.amount) } : {}),
        ...(payload.paymentDate !== undefined ? { paymentDate: new Date(payload.paymentDate) } : {}),
        ...(payload.reference !== undefined ? { reference: payload.reference?.trim() || null } : {}),
        ...(payload.note !== undefined ? { internalNotes: payload.note?.trim() || null } : {}),
      },
      include: {
        client: true,
        project: true,
        allocations: {
          include: {
            invoice: true,
          },
        },
      },
    });

    return this.toPaymentRecord(payment);
  }

  async deletePayment(user: AuthenticatedUser | undefined, id: string) {
    const scope = await this.resolveScope(user);
    const result = await this.prisma.payment.updateMany({
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
      throw new NotFoundException("Payment not found");
    }

    return { success: true };
  }

  paymentsWorkflow() {
    return {
      workflow: ["record payment", "allocate to invoice", "update balance"],
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

  private buildQuotationWhere(
    tenantId: string,
    query: ListQuotationsDto,
  ): Prisma.QuotationWhereInput {
    const search = query.search?.trim();
    return {
      tenantId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.client
        ? {
            client: {
              displayName: {
                equals: query.client,
                mode: "insensitive",
              },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: "insensitive" } },
              { title: { contains: search, mode: "insensitive" } },
              { clientNotes: { contains: search, mode: "insensitive" } },
              { client: { displayName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
  }

  private buildInvoiceWhere(tenantId: string, query: ListInvoicesDto): Prisma.InvoiceWhereInput {
    const search = query.search?.trim();
    return {
      tenantId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.client
        ? {
            client: {
              displayName: {
                equals: query.client,
                mode: "insensitive",
              },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: "insensitive" } },
              { customerNotes: { contains: search, mode: "insensitive" } },
              { internalNotes: { contains: search, mode: "insensitive" } },
              { client: { displayName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
  }

  private buildQuotationOrder(
    query: ListQuotationsDto,
  ): Prisma.QuotationOrderByWithRelationInput {
    switch (query.sortBy) {
      case "number":
      case "issueDate":
      case "validUntil":
      case "status":
      case "createdAt":
        return { [query.sortBy]: query.sortOrder };
      default:
        return { issueDate: "desc" };
    }
  }

  private buildInvoiceOrder(query: ListInvoicesDto): Prisma.InvoiceOrderByWithRelationInput {
    switch (query.sortBy) {
      case "number":
      case "issueDate":
      case "dueDate":
      case "status":
      case "createdAt":
        return { [query.sortBy]: query.sortOrder };
      default:
        return { issueDate: "desc" };
    }
  }

  private async findClientByName(tenantId: string, clientName: string) {
    const client = await this.prisma.client.findFirst({
      where: {
        tenantId,
        displayName: clientName.trim(),
        deletedAt: null,
      },
    });

    if (!client) {
      throw new NotFoundException("Client not found");
    }

    return client;
  }

  private async nextQuotationNumber(tenantId: string, issueDate: Date) {
    const year = issueDate.getUTCFullYear();
    const latest = await this.prisma.quotation.findFirst({
      where: {
        tenantId,
        number: {
          startsWith: `Q-${year}-`,
        },
      },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const current = latest?.number.match(/Q-\d{4}-(\d{4})$/u)?.[1];
    return `Q-${year}-${String((current ? Number.parseInt(current, 10) : 0) + 1).padStart(4, "0")}`;
  }

  private async nextInvoiceNumber(tenantId: string) {
    const latest = await this.prisma.invoice.findFirst({
      where: {
        tenantId,
        number: {
          startsWith: "N ",
        },
      },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const current = latest?.number.match(/^N\s*(\d{6})$/u)?.[1];
    const next = (current ? Number.parseInt(current, 10) : 2210) + 1;
    return `N ${String(next).padStart(6, "0")}`;
  }

  private async nextDeliveryNoteNumber(tenantId: string) {
    const latest = await this.prisma.deliveryNote.findFirst({
      where: {
        tenantId,
        number: {
          startsWith: "N ",
        },
      },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const current = latest?.number.match(/^N\s*(\d+)$/u)?.[1];
    const next = (current ? Number.parseInt(current, 10) : 610) + 1;
    return `N ${String(next).padStart(5, "0")}`;
  }

  private async nextPaymentNumber(tenantId: string, paymentDate: Date) {
    const year = paymentDate.getUTCFullYear();
    const latest = await this.prisma.payment.findFirst({
      where: {
        tenantId,
        number: {
          startsWith: `PAY-${year}-`,
        },
      },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const current = latest?.number?.match(/PAY-\d{4}-(\d{4})$/u)?.[1];
    return `PAY-${year}-${String((current ? Number.parseInt(current, 10) : 0) + 1).padStart(4, "0")}`;
  }

  private async ensureVehicle(scope: ScopeContext, vehicleLabel: string) {
    const trimmed = vehicleLabel.trim();
    if (!trimmed) {
      return null;
    }

    const normalizedCode = trimmed
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);

    const existing = await this.prisma.vehicle.findFirst({
      where: {
        tenantId: scope.tenantId,
        code: normalizedCode,
        deletedAt: null,
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.vehicle.create({
      data: {
        tenantId: scope.tenantId,
        branchId: scope.branchId ?? undefined,
        code: normalizedCode || `VEH-${Date.now()}`,
        model: trimmed,
        isActive: true,
      },
    });
  }

  private buildQuotationLines(scope: string, itemCount: number, totalAmount: number) {
    const sanitizedScope = scope.trim();
    const baseNames = [
      `Main ${sanitizedScope}`,
      "Fabrication",
      "Installation",
      "Finish and adjustments",
      "Transport",
    ];
    const perLine = totalAmount / itemCount;
    return Array.from({ length: itemCount }).map((_, index) => {
      const rawTotal = index === itemCount - 1 ? totalAmount - perLine * (itemCount - 1) : perLine;
      const totalValue = Number(rawTotal.toFixed(3));
      return {
        label: baseNames[index] || `${sanitizedScope} item ${index + 1}`,
        quantityValue: 1,
        unitLabel: "u",
        unitPriceValue: totalValue,
        totalValue,
      };
    });
  }

  private toQuotationRecord(quotation: QuotationWithRelations) {
    return {
      id: quotation.id,
      number: quotation.number,
      client: quotation.client.displayName,
      clientDetails: {
        contact: quotation.client.displayName,
        phone: quotation.client.phone || quotation.client.mobile || "-",
        email: quotation.client.email || "-",
        address: this.buildAddress(quotation.client.addressLine1, quotation.client.postalCode, quotation.client.city),
        city: quotation.client.city || "-",
        clientCode: quotation.client.code,
      },
      date: this.formatDisplayDate(quotation.issueDate),
      validUntil: quotation.validUntil ? this.formatDisplayDate(quotation.validUntil) : "-",
      amount: this.formatMoney(quotation.totalAmount),
      items: quotation.items.length,
      status: this.mapQuotationStatus(quotation.status),
      scope: quotation.clientNotes || quotation.title,
      chantier: quotation.title,
      notes: quotation.internalNotes || quotation.clientNotes || "",
      lines: quotation.items.map((item) => this.toLineItem(item)),
      linkedActivity: [
        { title: "Current status", meta: quotation.status.replaceAll("_", " ") },
        { title: "Issued", meta: this.formatDisplayDate(quotation.issueDate) },
      ],
    };
  }

  private toInvoiceRecord(invoice: InvoiceWithRelations, paymentTerms = "Bank transfer - 30 days") {
    return {
      id: invoice.id,
      number: invoice.number,
      client: invoice.client.displayName,
      clientDetails: {
        contact: invoice.client.displayName,
        phone: invoice.client.phone || invoice.client.mobile || "-",
        email: invoice.client.email || "-",
        address: this.buildAddress(invoice.client.addressLine1, invoice.client.postalCode, invoice.client.city),
        city: invoice.client.city || "-",
        clientCode: invoice.client.code,
      },
      date: this.formatDisplayDate(invoice.issueDate),
      dueDate: invoice.dueDate ? this.formatDisplayDate(invoice.dueDate) : "-",
      amount: this.formatMoney(invoice.totalAmount),
      paid: this.formatMoney(invoice.paidAmount),
      remaining: this.formatMoney(invoice.balanceDue),
      status: this.mapInvoiceStatus(invoice.status, invoice.balanceDue),
      paymentTerms,
      scope: invoice.customerNotes || invoice.internalNotes || "Invoice",
      linkedActivity: [
        { title: "Invoice status", meta: invoice.status.replaceAll("_", " ") },
        { title: "Issued", meta: this.formatDisplayDate(invoice.issueDate) },
      ],
      lines: invoice.items.map((item) => this.toLineItem(item)),
      allocations: [
        { label: "Initial issue", value: this.formatMoney(invoice.totalAmount) },
        { label: "Collected", value: this.formatMoney(invoice.paidAmount) },
      ],
    };
  }

  private toLineItem(item: InvoiceItem | QuotationItem) {
    return {
      label: item.itemName,
      quantity: formatTnQuantity(this.decimalToNumber(item.quantity), item.unitLabel),
      unit: item.unitLabel,
      unitPrice: this.formatMoney(item.unitPrice),
      total: this.formatMoney(item.lineTotal),
    };
  }

  private toDeliveryNoteRecord(note: DeliveryNoteWithRelations) {
    return {
      id: note.id,
      number: note.number,
      project: note.project?.name || "Unlinked project",
      destination: note.siteAddress || "-",
      responsible: note.receiverName || "-",
      vehicle: [note.vehicle?.make, note.vehicle?.model, note.vehicle?.licensePlate].filter(Boolean).join(" - ") || note.vehicle?.code || "-",
      scheduledAt: this.formatDateTime(note.deliveryDate),
      status: note.status,
      clientDetails: {
        client: note.client.displayName,
        contact: note.receiverName || note.client.displayName,
        phone: note.receiverPhone || note.client.phone || note.client.mobile || "-",
        address: note.siteAddress || this.buildAddress(note.client.addressLine1, note.client.postalCode, note.client.city),
        city: note.client.city || "-",
      },
      items: note.items.map((item) => ({
        label: item.itemName,
        quantity: formatTnQuantity(this.decimalToNumber(item.quantity), item.unitLabel),
      })),
      linkedActivity: [
        { title: "Current status", meta: note.status.replaceAll("_", " ") },
        { title: "Scheduled", meta: this.formatDateTime(note.deliveryDate) },
        ...(note.project ? [{ title: "Project", meta: note.project.code }] : []),
      ],
    };
  }

  private toPaymentRecord(payment: PaymentWithRelations) {
    const allocationLabels = payment.allocations
      .map((allocation) => allocation.invoice.number)
      .filter(Boolean);

    return {
      id: payment.id,
      reference: payment.number || payment.reference || payment.id,
      client: payment.client.displayName,
      method: payment.method.replaceAll("_", " "),
      status: this.mapPaymentStatus(payment.status, payment.allocations.length),
      amount: this.formatMoney(payment.amount),
      allocations: allocationLabels.length ? allocationLabels.join(", ") : "Pending allocation",
      paidAt: payment.paymentDate.toISOString().slice(0, 10),
      note: payment.internalNotes || "",
      project: payment.project?.name || "General",
      sourceReference: payment.reference || "-",
    };
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

  private formatMoney(value: Prisma.Decimal | number | string | null | undefined) {
    return formatTnd(this.decimalToNumber(value));
  }

  private formatDisplayDate(value: Date) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(value);
  }

  private formatDateTime(value: Date) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(value);
  }

  private buildAddress(addressLine1?: string | null, postalCode?: string | null, city?: string | null) {
    const parts = [addressLine1, postalCode, city].filter(Boolean);
    return parts.length ? parts.join(", ") : "-";
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

  private mapPaymentStatus(status: PaymentStatus, allocationCount: number) {
    if (status === PaymentStatus.CONFIRMED && allocationCount > 0) {
      return "PARTIALLY_ALLOCATED";
    }
    return status;
  }
}
