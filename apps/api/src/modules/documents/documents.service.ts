import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { FileKind, FileVisibility, Prisma } from "@sotec/database";
import { PrismaService } from "../../common/prisma/prisma.service";
import { WorkspaceService } from "../../common/workspace/workspace.service";
import type { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { ListQueryDto } from "../../common/dto/list-query.dto";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { UploadDocumentDto } from "./dto/upload-document.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";

type ScopeContext = {
  tenantId: string;
  userId: string | null;
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async list(user: AuthenticatedUser | undefined, query: ListQueryDto) {
    const scope = await this.resolveScope(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();
    const where: Prisma.FileWhereInput = {
      tenantId: scope.tenantId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { originalName: { contains: search, mode: "insensitive" } },
              { objectKey: { contains: search, mode: "insensitive" } },
              { documentLinks: { some: { label: { contains: search, mode: "insensitive" } } } },
              { documentLinks: { some: { client: { displayName: { contains: search, mode: "insensitive" } } } } },
              { documentLinks: { some: { project: { name: { contains: search, mode: "insensitive" } } } } },
              { documentLinks: { some: { quotation: { number: { contains: search, mode: "insensitive" } } } } },
              { documentLinks: { some: { invoice: { number: { contains: search, mode: "insensitive" } } } } },
            ],
          }
        : {}),
    };

    const [totalItems, files] = await this.prisma.$transaction([
      this.prisma.file.count({ where }),
      this.prisma.file.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          uploadedBy: true,
          documentLinks: {
            where: {
              deletedAt: null,
            },
            include: {
              client: true,
              project: true,
              quotation: true,
              invoice: true,
              deliveryNote: true,
              expense: true,
            },
          },
        },
      }),
    ]);

    const data = files.map((file) => this.toDocumentRow(file));

    return {
      data,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      },
      storage: "S3-compatible object storage",
      attachableTo: ["lead", "client", "quotation", "project", "invoice", "delivery-note", "expense"],
    };
  }

  async create(user: AuthenticatedUser | undefined, payload: CreateDocumentDto) {
    const scope = await this.resolveScope(user);
    const originalName = payload.fileName.trim();
    const extension = originalName.includes(".") ? originalName.split(".").pop()?.toLowerCase() : undefined;
    const objectKey = `${Date.now()}-${originalName.toLowerCase().replace(/[^a-z0-9.]+/g, "-")}`;
    const linkData = await this.resolveLinkTarget(scope.tenantId, payload.targetType, payload.targetReference);

    const file = await this.prisma.file.create({
      data: {
        tenantId: scope.tenantId,
        uploadedByUserId: scope.userId ?? undefined,
        originalName,
        objectKey,
        storageDriver: "local",
        mimeType: payload.mimeType.trim(),
        extension,
        byteSize: payload.byteSize,
        fileKind: payload.documentType,
        visibility: payload.visibility ?? FileVisibility.INTERNAL,
        documentLinks: linkData
          ? {
              create: {
                tenantId: scope.tenantId,
                createdByUserId: scope.userId ?? undefined,
                label: payload.label?.trim() || undefined,
                ...linkData,
              },
            }
          : undefined,
      },
      include: {
        uploadedBy: true,
        documentLinks: {
          include: {
            client: true,
            project: true,
            quotation: true,
            invoice: true,
            deliveryNote: true,
            expense: true,
          },
        },
      },
    });

    return this.toDocumentRow(file);
  }

  async update(user: AuthenticatedUser | undefined, id: string, payload: UpdateDocumentDto) {
    const scope = await this.resolveScope(user);
    const file = await this.prisma.file.findFirst({
      where: {
        id,
        tenantId: scope.tenantId,
        deletedAt: null,
      },
      include: {
        uploadedBy: true,
        documentLinks: {
          where: {
            deletedAt: null,
          },
          include: {
            client: true,
            project: true,
            quotation: true,
            invoice: true,
            deliveryNote: true,
            expense: true,
          },
        },
      },
    });

    if (!file) {
      throw new NotFoundException("Document not found");
    }

    const linkData = await this.resolveLinkTarget(scope.tenantId, payload.targetType, payload.targetReference);
    await this.prisma.$transaction(async (tx) => {
      await tx.file.update({
        where: { id: file.id },
        data: {
          visibility: payload.visibility ?? file.visibility,
        },
      });

      await tx.documentLink.updateMany({
        where: {
          fileId: file.id,
          tenantId: scope.tenantId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      if (linkData) {
        await tx.documentLink.create({
          data: {
            tenantId: scope.tenantId,
            fileId: file.id,
            createdByUserId: scope.userId ?? undefined,
            label: payload.label?.trim() || undefined,
            ...linkData,
          },
        });
      }
    });

    const updated = await this.prisma.file.findFirst({
      where: {
        id,
        tenantId: scope.tenantId,
        deletedAt: null,
      },
      include: {
        uploadedBy: true,
        documentLinks: {
          where: {
            deletedAt: null,
          },
          include: {
            client: true,
            project: true,
            quotation: true,
            invoice: true,
            deliveryNote: true,
            expense: true,
          },
        },
      },
    });

    if (!updated) {
      throw new NotFoundException("Document not found after update");
    }

    return this.toDocumentRow(updated);
  }

  async upload(
    user: AuthenticatedUser | undefined,
    payload: UploadDocumentDto,
    file: any,
  ) {
    if (!file) {
      throw new BadRequestException("File upload is required");
    }

    if (!file.buffer) {
      throw new BadRequestException("Uploaded file buffer is missing");
    }

    const scope = await this.resolveScope(user);
    const originalName = file.originalname.trim();
    const extension = originalName.includes(".") ? originalName.split(".").pop()?.toLowerCase() : undefined;
    const safeStem =
      originalName
        .replace(/\.[^.]+$/u, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "document";
    const storageFileName = `${Date.now()}-${safeStem}${extension ? `.${extension}` : ""}`;
    const objectKey = `documents/${storageFileName}`;
    await mkdir(join(this.resolveStorageRoot(), "documents"), { recursive: true });
    await writeFile(this.resolveAbsolutePath(objectKey), file.buffer);
    const linkData = await this.resolveLinkTarget(scope.tenantId, payload.targetType, payload.targetReference);

    const created = await this.prisma.file.create({
      data: {
        tenantId: scope.tenantId,
        uploadedByUserId: scope.userId ?? undefined,
        originalName,
        objectKey,
        storageDriver: "local",
        mimeType: file.mimetype || "application/octet-stream",
        extension,
        byteSize: Math.max(1, file.size),
        fileKind: payload.documentType,
        visibility: payload.visibility ?? FileVisibility.INTERNAL,
        documentLinks: linkData
          ? {
              create: {
                tenantId: scope.tenantId,
                createdByUserId: scope.userId ?? undefined,
                label: payload.label?.trim() || undefined,
                ...linkData,
              },
            }
          : undefined,
      },
      include: {
        uploadedBy: true,
        documentLinks: {
          include: {
            client: true,
            project: true,
            quotation: true,
            invoice: true,
            deliveryNote: true,
            expense: true,
          },
        },
      },
    });

    return this.toDocumentRow(created);
  }

  async download(user: AuthenticatedUser | undefined, id: string) {
    const scope = await this.resolveScope(user);
    const file = await this.prisma.file.findFirst({
      where: {
        id,
        tenantId: scope.tenantId,
        deletedAt: null,
      },
    });

    if (!file) {
      throw new NotFoundException("Document not found");
    }

    const absolutePath = this.resolveAbsolutePath(file.objectKey);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException("Document binary is missing from local storage");
    }

    return {
      absolutePath,
      originalName: file.originalName,
    };
  }

  private async resolveScope(user?: AuthenticatedUser): Promise<ScopeContext> {
    if (user) {
      return {
        tenantId: user.tenantId,
        userId: user.userId,
      };
    }

    const workspace = await this.workspaceService.ensureWorkspace();
    return {
      tenantId: workspace.tenantId,
      userId: workspace.adminUserId,
    };
  }

  private async resolveLinkTarget(tenantId: string, targetType?: string, targetReference?: string) {
    if (!targetType || !targetReference?.trim()) {
      return null;
    }

    const reference = targetReference.trim();

    switch (targetType) {
      case "client": {
        const client = await this.prisma.client.findFirst({
          where: {
            tenantId,
            deletedAt: null,
            OR: [{ displayName: reference }, { code: reference }],
          },
        });
        if (!client) throw new NotFoundException("Client target not found");
        return { clientId: client.id };
      }
      case "project": {
        const project = await this.prisma.project.findFirst({
          where: {
            tenantId,
            deletedAt: null,
            OR: [{ name: reference }, { code: reference }],
          },
        });
        if (!project) throw new NotFoundException("Project target not found");
        return { projectId: project.id };
      }
      case "quotation": {
        const quotation = await this.prisma.quotation.findFirst({
          where: { tenantId, deletedAt: null, number: reference },
        });
        if (!quotation) throw new NotFoundException("Quotation target not found");
        return { quotationId: quotation.id };
      }
      case "invoice": {
        const invoice = await this.prisma.invoice.findFirst({
          where: { tenantId, deletedAt: null, number: reference },
        });
        if (!invoice) throw new NotFoundException("Invoice target not found");
        return { invoiceId: invoice.id };
      }
      case "delivery-note": {
        const note = await this.prisma.deliveryNote.findFirst({
          where: { tenantId, deletedAt: null, number: reference },
        });
        if (!note) throw new NotFoundException("Delivery note target not found");
        return { deliveryNoteId: note.id };
      }
      case "expense": {
        const expense = await this.prisma.expense.findFirst({
          where: {
            tenantId,
            deletedAt: null,
            OR: [{ number: reference }, { title: reference }],
          },
        });
        if (!expense) throw new NotFoundException("Expense target not found");
        return { expenseId: expense.id };
      }
      default:
        return null;
    }
  }

  private resolveEntityLabel(link?: {
    client?: { displayName: string; code: string } | null;
    project?: { code: string; name: string } | null;
    quotation?: { number: string } | null;
    invoice?: { number: string } | null;
    deliveryNote?: { number: string } | null;
    expense?: { number: string | null; title: string } | null;
  } | null) {
    if (!link) return "Unlinked";
    if (link.project) return `Project ${link.project.code}`;
    if (link.quotation) return `Quotation ${link.quotation.number}`;
    if (link.invoice) return `Invoice ${link.invoice.number}`;
    if (link.deliveryNote) return `Delivery ${link.deliveryNote.number}`;
    if (link.client) return `Client ${link.client.code}`;
    if (link.expense) return link.expense.number ? `Expense ${link.expense.number}` : `Expense ${link.expense.title}`;
    return "Unlinked";
  }

  private resolveTypeLabel(kind: FileKind, label?: string | null) {
    if (label) return label;
    return kind.replaceAll("_", " ");
  }

  private toDocumentRow(
    file: Prisma.FileGetPayload<{
      include: {
        uploadedBy: true;
        documentLinks: {
          include: {
            client: true;
            project: true;
            quotation: true;
            invoice: true;
            deliveryNote: true;
            expense: true;
          };
        };
      };
    }>,
  ) {
    const primaryLink = file.documentLinks[0];

    return {
      id: file.id,
      fileName: file.originalName,
      entity: this.resolveEntityLabel(primaryLink),
      type: this.resolveTypeLabel(file.fileKind, primaryLink?.label),
      documentType: file.fileKind,
      visibility: file.visibility,
      targetType: this.resolveTargetType(primaryLink),
      targetReference: this.resolveTargetReference(primaryLink),
      label: primaryLink?.label ?? "",
      uploadedBy: file.uploadedBy ? `${file.uploadedBy.firstName} ${file.uploadedBy.lastName}`.trim() : "System",
      version: "v1",
      status: "ACTIVE",
      uploadedAt: file.createdAt.toISOString().slice(0, 16).replace("T", " "),
      downloadUrl: `/documents/${file.id}/download`,
    };
  }

  private resolveAbsolutePath(objectKey: string) {
    return join(this.resolveStorageRoot(), objectKey);
  }

  private resolveStorageRoot() {
    return process.env.LOCAL_STORAGE_PATH || join(process.cwd(), "storage");
  }

  private resolveTargetType(link?: {
    client?: { id: string } | null;
    project?: { id: string } | null;
    quotation?: { id: string } | null;
    invoice?: { id: string } | null;
    deliveryNote?: { id: string } | null;
    expense?: { id: string } | null;
  } | null) {
    if (!link) return "";
    if (link.client) return "client";
    if (link.project) return "project";
    if (link.quotation) return "quotation";
    if (link.invoice) return "invoice";
    if (link.deliveryNote) return "delivery-note";
    if (link.expense) return "expense";
    return "";
  }

  private resolveTargetReference(link?: {
    client?: { displayName: string; code: string } | null;
    project?: { code: string; name: string } | null;
    quotation?: { number: string } | null;
    invoice?: { number: string } | null;
    deliveryNote?: { number: string } | null;
    expense?: { number: string | null; title: string } | null;
  } | null) {
    if (!link) return "";
    if (link.client) return link.client.code || link.client.displayName;
    if (link.project) return link.project.code || link.project.name;
    if (link.quotation) return link.quotation.number;
    if (link.invoice) return link.invoice.number;
    if (link.deliveryNote) return link.deliveryNote.number;
    if (link.expense) return link.expense.number || link.expense.title;
    return "";
  }
}
