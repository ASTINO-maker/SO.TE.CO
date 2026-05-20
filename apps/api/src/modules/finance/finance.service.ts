import { Injectable, NotFoundException } from "@nestjs/common";
import { formatTnd } from "@sotec/config";
import { ExpenseStatus, Prisma } from "@sotec/database";
import { PrismaService } from "../../common/prisma/prisma.service";
import { WorkspaceService } from "../../common/workspace/workspace.service";
import type { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { ListQueryDto } from "../../common/dto/list-query.dto";
import { CreateExpenseDto, UpdateExpenseDto } from "./dto";

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async expenses(user: AuthenticatedUser | undefined, query: ListQueryDto) {
    const scope = await this.resolveScope(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const search = query.search?.trim();
    const where: Prisma.ExpenseWhereInput = {
      tenantId: scope.tenantId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: "insensitive" } },
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { category: { name: { contains: search, mode: "insensitive" } } },
              { project: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [totalItems, items] = await this.prisma.$transaction([
      this.prisma.expense.count({ where }),
      this.prisma.expense.findMany({
        where,
        orderBy: {
          expenseDate: "desc",
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: true,
          project: true,
        },
      }),
    ]);

    return {
      data: items.map((expense) => this.toExpenseRow(expense)),
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      },
      focus: ["project-linked costs", "overheads", "cash visibility"],
    };
  }

  async createExpense(user: AuthenticatedUser | undefined, dto: CreateExpenseDto) {
    const scope = await this.resolveScope(user);
    const category = await this.findOrCreateCategory(scope.tenantId, dto.category);
    const project = await this.resolveProject(scope.tenantId, dto.project);
    const count = await this.prisma.expense.count({
      where: {
        tenantId: scope.tenantId,
      },
    });

    const expense = await this.prisma.expense.create({
      data: {
        tenantId: scope.tenantId,
        expenseCategoryId: category.id,
        projectId: project?.id ?? null,
        createdByUserId: user?.userId ?? null,
        number: `EXP-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        amount: new Prisma.Decimal(dto.amount),
        currency: "TND",
        expenseDate: new Date(dto.expenseDate),
        status: dto.status ?? ExpenseStatus.DRAFT,
        reference: dto.reference?.trim() || null,
      },
      include: {
        category: true,
        project: true,
      },
    });

    return this.toExpenseRow(expense);
  }

  async updateExpense(user: AuthenticatedUser | undefined, id: string, dto: UpdateExpenseDto) {
    const scope = await this.resolveScope(user);
    const existing = await this.prisma.expense.findFirst({
      where: {
        id,
        tenantId: scope.tenantId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException("Expense not found.");
    }

    const category = dto.category ? await this.findOrCreateCategory(scope.tenantId, dto.category) : null;
    const project =
      dto.project !== undefined ? await this.resolveProject(scope.tenantId, dto.project) : undefined;

    const expense = await this.prisma.expense.update({
      where: { id: existing.id },
      data: {
        expenseCategoryId: category?.id,
        projectId: project === undefined ? undefined : project?.id ?? null,
        title: dto.title?.trim(),
        description: dto.description !== undefined ? dto.description.trim() || null : undefined,
        amount: dto.amount ? new Prisma.Decimal(dto.amount) : undefined,
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
        status: dto.status,
        reference: dto.reference !== undefined ? dto.reference.trim() || null : undefined,
      },
      include: {
        category: true,
        project: true,
      },
    });

    return this.toExpenseRow(expense);
  }

  async deleteExpense(user: AuthenticatedUser | undefined, id: string) {
    const scope = await this.resolveScope(user);
    const result = await this.prisma.expense.updateMany({
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
      throw new NotFoundException("Expense not found.");
    }

    return { success: true };
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

  private toExpenseRow(expense: {
    id: string;
    number: string | null;
    title: string;
    amount: Prisma.Decimal;
    status: ExpenseStatus;
    expenseDate: Date;
    reference: string | null;
    description: string | null;
    category: { name: string };
    project: { name: string } | null;
  }) {
    return {
      id: expense.id,
      reference: expense.number || expense.id,
      category: expense.category.name,
      description: expense.title,
      project: expense.project?.name || "General",
      amount: formatTnd(Number(expense.amount)),
      status: expense.status,
      date: expense.expenseDate.toISOString().slice(0, 10),
      note: expense.description || "-",
      externalReference: expense.reference || "-",
    };
  }

  private async findOrCreateCategory(tenantId: string, rawName: string) {
    const name = rawName.trim();
    const existing = await this.prisma.expenseCategory.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      return existing;
    }

    const codeBase =
      name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 16) || "GENERAL";

    return this.prisma.expenseCategory.create({
      data: {
        tenantId,
        code: `${codeBase}_${Date.now().toString().slice(-4)}`,
        name,
      },
    });
  }

  private async resolveProject(tenantId: string, projectName?: string) {
    const name = projectName?.trim();
    if (!name) {
      return null;
    }

    return this.prisma.project.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });
  }
}
