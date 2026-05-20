import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { formatTnd as formatTndShared } from "@sotec/config";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { WorkspaceService } from "../../common/workspace/workspace.service";
import { CreateWorkerPaymentDto } from "./dto/create-worker-payment.dto";
import { UpdateOwnerProfileDto } from "./dto/update-owner-profile.dto";
import { UpdateWorkspaceSettingsDto } from "./dto/update-workspace-settings.dto";

const GLOBAL_SCOPE = "global";
const WORKER_PAYMENTS_KEY = "finance.worker_payment_batches";

interface StoredWorkerPaymentBatch {
  id: string;
  paymentType: "ADVANCE" | "MONTH_END";
  paymentDate: string;
  note: string;
  createdAt: string;
  workerCount: number;
  totalAmountValue: number;
  totalAmount: string;
  workers: Array<{
    id: string;
    name: string;
    role: string;
    amountValue: number;
    amount: string;
  }>;
}

interface OwnerAccountSettings {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface WorkspaceSettings {
  companyName: string;
  branchName: string;
  city: string;
  addressLine1: string;
  postalCode: string;
  phone: string;
  email: string;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly prisma: PrismaService,
  ) {}

  async getDocumentSettings() {
    const workspace = await this.workspaceService.ensureWorkspace();
    return this.workspaceService.getDocumentSettings(workspace.tenantId);
  }

  async getOwnerAccount(userId: string): Promise<OwnerAccountSettings> {
    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    });

    if (!owner) {
      throw new NotFoundException("Owner account not found");
    }

    return {
      firstName: owner.firstName,
      lastName: owner.lastName,
      email: owner.email,
      phone: owner.phone ?? "",
    };
  }

  async updateOwnerAccount(userId: string, payload: UpdateOwnerProfileDto): Promise<OwnerAccountSettings> {
    const owner = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        email: payload.email.trim().toLowerCase(),
        phone: payload.phone?.trim() || null,
      },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    });

    return {
      firstName: owner.firstName,
      lastName: owner.lastName,
      email: owner.email,
      phone: owner.phone ?? "",
    };
  }

  async getWorkspaceSettings(tenantId: string, branchId: string | null): Promise<WorkspaceSettings> {
    const [tenant, branch] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      }),
      this.prisma.branch.findUnique({
        where: { id: branchId ?? "" },
        select: {
          name: true,
          city: true,
          addressLine1: true,
          postalCode: true,
          phone: true,
          email: true,
        },
      }),
    ]);

    if (!tenant || !branch) {
      throw new NotFoundException("Workspace settings not found");
    }

    return {
      companyName: tenant.name,
      branchName: branch.name,
      city: branch.city ?? "",
      addressLine1: branch.addressLine1 ?? "",
      postalCode: branch.postalCode ?? "",
      phone: branch.phone ?? "",
      email: branch.email ?? "",
    };
  }

  async updateWorkspaceSettings(
    tenantId: string,
    branchId: string | null,
    payload: UpdateWorkspaceSettingsDto,
  ): Promise<WorkspaceSettings> {
    if (!branchId) {
      throw new NotFoundException("Workspace branch not found");
    }

    const [tenant, branch] = await this.prisma.$transaction([
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          name: payload.companyName.trim(),
        },
        select: {
          name: true,
        },
      }),
      this.prisma.branch.update({
        where: { id: branchId },
        data: {
          name: payload.branchName.trim(),
          city: payload.city?.trim() || null,
          addressLine1: payload.addressLine1?.trim() || null,
          postalCode: payload.postalCode?.trim() || null,
          phone: payload.phone?.trim() || null,
          email: payload.email?.trim().toLowerCase() || null,
        },
        select: {
          name: true,
          city: true,
          addressLine1: true,
          postalCode: true,
          phone: true,
          email: true,
        },
      }),
    ]);

    return {
      companyName: tenant.name,
      branchName: branch.name,
      city: branch.city ?? "",
      addressLine1: branch.addressLine1 ?? "",
      postalCode: branch.postalCode ?? "",
      phone: branch.phone ?? "",
      email: branch.email ?? "",
    };
  }

  async updateDocumentSettings(payload: {
    headerCompanyName?: string;
    headerCompanySubtitle?: string;
    headerAddressLine?: string;
    headerPhone?: string;
    headerPhoneSecondary?: string;
    headerRc?: string;
    headerTaxId?: string;
    headerCapital?: string;
    headerArabicCompanyName?: string;
    headerArabicAddressLine?: string;
    invoiceFooterConditions?: string;
    bankIban?: string;
    bankBic?: string;
    bankAccountHolder?: string;
  }) {
    const workspace = await this.workspaceService.ensureWorkspace();
    return this.workspaceService.updateDocumentSettings(workspace.tenantId, payload);
  }

  async getWorkerPayments() {
    const workspace = await this.workspaceService.ensureWorkspace();
    const items = await this.readWorkerPaymentBatches(workspace.tenantId);
    return {
      data: items,
      meta: {
        page: 1,
        pageSize: items.length,
        totalItems: items.length,
        totalPages: 1,
      },
    };
  }

  async createWorkerPayment(payload: CreateWorkerPaymentDto) {
    const workspace = await this.workspaceService.ensureWorkspace();
    const current = await this.readWorkerPaymentBatches(workspace.tenantId);
    const workers = payload.workers
      .map((worker) => ({
        id: randomUUID(),
        name: worker.name.trim(),
        role: worker.role?.trim() || "",
        amountValue: Number(worker.amount),
        amount: this.formatTnd(Number(worker.amount)),
      }))
      .filter((worker) => worker.name && worker.amountValue > 0);

    if (!workers.length) {
      throw new BadRequestException("At least one valid worker payment is required");
    }

    this.assertUniqueWorkerNames(workers);

    const totalAmountValue = workers.reduce((sum, worker) => sum + worker.amountValue, 0);
    const batch: StoredWorkerPaymentBatch = {
      id: randomUUID(),
      paymentType: payload.paymentType ?? "ADVANCE",
      paymentDate: payload.paymentDate,
      note: payload.note?.trim() || "",
      createdAt: new Date().toISOString(),
      workerCount: workers.length,
      totalAmountValue,
      totalAmount: this.formatTnd(totalAmountValue),
      workers,
    };

    const next = [batch, ...current];
    await this.prisma.setting.upsert({
      where: {
        tenantId_scopeKey_key: {
          tenantId: workspace.tenantId,
          scopeKey: GLOBAL_SCOPE,
          key: WORKER_PAYMENTS_KEY,
        },
      },
      update: {
        value: next as unknown as Prisma.InputJsonValue,
      },
      create: {
        tenantId: workspace.tenantId,
        scopeKey: GLOBAL_SCOPE,
        key: WORKER_PAYMENTS_KEY,
        value: next as unknown as Prisma.InputJsonValue,
      },
    });

    return batch;
  }

  async deleteWorkerPayment(id: string) {
    const workspace = await this.workspaceService.ensureWorkspace();
    const current = await this.readWorkerPaymentBatches(workspace.tenantId);
    const next = current.filter((item) => item.id !== id);

    if (next.length === current.length) {
      throw new NotFoundException("Worker payment batch not found");
    }

    await this.prisma.setting.upsert({
      where: {
        tenantId_scopeKey_key: {
          tenantId: workspace.tenantId,
          scopeKey: GLOBAL_SCOPE,
          key: WORKER_PAYMENTS_KEY,
        },
      },
      update: {
        value: next as unknown as Prisma.InputJsonValue,
      },
      create: {
        tenantId: workspace.tenantId,
        scopeKey: GLOBAL_SCOPE,
        key: WORKER_PAYMENTS_KEY,
        value: next as unknown as Prisma.InputJsonValue,
      },
    });

    return { success: true };
  }

  async updateWorkerPayment(
    id: string,
    payload: CreateWorkerPaymentDto,
  ): Promise<StoredWorkerPaymentBatch> {
    const workspace = await this.workspaceService.ensureWorkspace();
    const current = await this.readWorkerPaymentBatches(workspace.tenantId);
    const index = current.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new NotFoundException("Worker payment batch not found");
    }

    const workers = payload.workers
      .map((worker) => ({
        id: randomUUID(),
        name: worker.name.trim(),
        role: worker.role?.trim() || "",
        amountValue: Number(worker.amount),
        amount: this.formatTnd(Number(worker.amount)),
      }))
      .filter((worker) => worker.name && worker.amountValue > 0);

    if (!workers.length) {
      throw new BadRequestException("At least one valid worker payment is required");
    }

    this.assertUniqueWorkerNames(workers);

    const totalAmountValue = workers.reduce((sum, worker) => sum + worker.amountValue, 0);
    const existing = current[index]!;
    const updated: StoredWorkerPaymentBatch = {
      ...existing,
      paymentType: payload.paymentType ?? existing.paymentType ?? "ADVANCE",
      paymentDate: payload.paymentDate,
      note: payload.note?.trim() || "",
      workerCount: workers.length,
      totalAmountValue,
      totalAmount: this.formatTnd(totalAmountValue),
      workers,
    };

    const next = [...current];
    next[index] = updated;

    await this.prisma.setting.upsert({
      where: {
        tenantId_scopeKey_key: {
          tenantId: workspace.tenantId,
          scopeKey: GLOBAL_SCOPE,
          key: WORKER_PAYMENTS_KEY,
        },
      },
      update: {
        value: next as unknown as Prisma.InputJsonValue,
      },
      create: {
        tenantId: workspace.tenantId,
        scopeKey: GLOBAL_SCOPE,
        key: WORKER_PAYMENTS_KEY,
        value: next as unknown as Prisma.InputJsonValue,
      },
    });

    return updated;
  }

  private async readWorkerPaymentBatches(tenantId: string): Promise<StoredWorkerPaymentBatch[]> {
    const setting = await this.prisma.setting.findUnique({
      where: {
        tenantId_scopeKey_key: {
          tenantId,
          scopeKey: GLOBAL_SCOPE,
          key: WORKER_PAYMENTS_KEY,
        },
      },
      select: {
        value: true,
      },
    });

    if (!Array.isArray(setting?.value)) {
      return [];
    }

    return (setting.value as unknown as StoredWorkerPaymentBatch[]).map((item) => ({
      ...item,
      paymentType: item.paymentType === "MONTH_END" ? "MONTH_END" : "ADVANCE",
    }));
  }

  private formatTnd(value: number) {
    return formatTndShared(value);
  }

  private assertUniqueWorkerNames(workers: Array<{ name: string }>) {
    const normalizedNames = workers.map((worker) =>
      worker.name.trim().replace(/\s+/g, " ").toLowerCase(),
    );

    if (new Set(normalizedNames).size !== normalizedNames.length) {
      throw new BadRequestException("Duplicate worker names are not allowed in the same batch");
    }
  }
}
