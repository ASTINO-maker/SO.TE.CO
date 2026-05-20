import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { seedTenantRbac } from "@sotec/database";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword, verifyPassword } from "../../modules/auth/auth.utils";

export interface WorkspaceContext {
  tenantId: string;
  branchId: string;
  adminUserId: string;
}

export interface WorkspaceFlags {
  workspaceSetupCompleted: boolean;
  requiresPasswordChange: boolean;
}

export interface BootstrapWorkspacePayload {
  companyName: string;
  branchName: string;
  city?: string;
  addressLine1?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  ownerFirstName: string;
  ownerLastName: string;
}

export interface DocumentSettings {
  headerCompanyName: string;
  headerCompanySubtitle: string;
  headerAddressLine: string;
  headerPhone: string;
  headerPhoneSecondary: string;
  headerRc: string;
  headerTaxId: string;
  headerCapital: string;
  headerArabicCompanyName: string;
  headerArabicAddressLine: string;
  invoiceFooterConditions: string;
  bankIban: string;
  bankBic: string;
  bankAccountHolder: string;
}

const GLOBAL_SCOPE = "global";
const SETUP_COMPLETED_KEY = "workspace.setup_completed";
const FORCE_PASSWORD_CHANGE_KEY = "auth.force_password_change";
const INVOICE_FOOTER_CONDITIONS_KEY = "documents.invoice_footer_conditions";
const HEADER_COMPANY_NAME_KEY = "documents.header_company_name";
const HEADER_COMPANY_SUBTITLE_KEY = "documents.header_company_subtitle";
const HEADER_ADDRESS_LINE_KEY = "documents.header_address_line";
const HEADER_PHONE_KEY = "documents.header_phone";
const HEADER_PHONE_SECONDARY_KEY = "documents.header_phone_secondary";
const HEADER_RC_KEY = "documents.header_rc";
const HEADER_TAX_ID_KEY = "documents.header_tax_id";
const HEADER_CAPITAL_KEY = "documents.header_capital";
const HEADER_ARABIC_COMPANY_NAME_KEY = "documents.header_arabic_company_name";
const HEADER_ARABIC_ADDRESS_LINE_KEY = "documents.header_arabic_address_line";
const BANK_IBAN_KEY = "documents.bank_iban";
const BANK_BIC_KEY = "documents.bank_bic";
const BANK_ACCOUNT_HOLDER_KEY = "documents.bank_account_holder";

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureWorkspace(): Promise<WorkspaceContext> {
    const slug = process.env.DEFAULT_TENANT_SLUG ?? "sotec";
    const ownerEmail = (process.env.DEFAULT_OWNER_EMAIL ?? "admin@sotec.local").trim().toLowerCase();
    const ownerPassword = process.env.DEFAULT_OWNER_PASSWORD ?? "ChangeMe123!";

    const tenant =
      (await this.prisma.tenant.findUnique({
        where: { slug },
      })) ??
      (await this.prisma.tenant.create({
        data: {
          name: "SO.TE.CO",
          slug,
          currency: "TND",
          timezone: "Africa/Tunis",
        },
      }));

    await seedTenantRbac(this.prisma, tenant.id);

    const branch =
      (await this.prisma.branch.findFirst({
        where: {
          tenantId: tenant.id,
          deletedAt: null,
        },
        orderBy: {
          createdAt: "asc",
        },
      })) ??
      (await this.prisma.branch.create({
        data: {
          tenantId: tenant.id,
          code: "HQ",
          name: "Owner Workspace",
          city: "Tunis",
          isActive: true,
        },
      }));

    let ownerUser =
      (await this.prisma.user.findUnique({
        where: {
          tenantId_email: {
            tenantId: tenant.id,
            email: ownerEmail,
          },
        },
      })) ??
      (await this.prisma.user.findFirst({
        where: {
          tenantId: tenant.id,
          deletedAt: null,
        },
        orderBy: {
          createdAt: "asc",
        },
      }));

    if (!ownerUser) {
      ownerUser = await this.prisma.user.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          firstName: "Owner",
          lastName: "Account",
          email: ownerEmail,
          passwordHash: hashPassword(ownerPassword),
          status: "ACTIVE",
        },
      });
    } else if (!ownerUser.passwordHash) {
      ownerUser = await this.prisma.user.update({
        where: { id: ownerUser.id },
        data: {
          branchId: ownerUser.branchId ?? branch.id,
          passwordHash: hashPassword(ownerPassword),
          status: "ACTIVE",
        },
      });
    }

    const superAdminRole = await this.prisma.role.findUniqueOrThrow({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: "super_admin",
        },
      },
    });

    await this.prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: ownerUser.id,
          roleId: superAdminRole.id,
        },
      },
      update: {},
      create: {
        userId: ownerUser.id,
        roleId: superAdminRole.id,
      },
    });

    await this.ensureBooleanSetting(tenant.id, SETUP_COMPLETED_KEY, false);
    await this.ensureBooleanSetting(tenant.id, FORCE_PASSWORD_CHANGE_KEY, true);

    return {
      tenantId: tenant.id,
      branchId: branch.id,
      adminUserId: ownerUser.id,
    };
  }

  async getWorkspaceFlags(tenantId: string): Promise<WorkspaceFlags> {
    const [setupCompleted, requiresPasswordChange] = await Promise.all([
      this.getBooleanSetting(tenantId, SETUP_COMPLETED_KEY, false),
      this.getBooleanSetting(tenantId, FORCE_PASSWORD_CHANGE_KEY, true),
    ]);

    return {
      workspaceSetupCompleted: setupCompleted,
      requiresPasswordChange,
    };
  }

  async completeWorkspaceSetup(userId: string, payload: BootstrapWorkspacePayload) {
    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true, branch: true },
    });

    if (!owner) {
      throw new NotFoundException("Owner account not found");
    }

    const branch =
      owner.branch ??
      (await this.prisma.branch.findFirst({
        where: {
          tenantId: owner.tenantId,
          deletedAt: null,
        },
        orderBy: {
          createdAt: "asc",
        },
      }));

    if (!branch) {
      throw new NotFoundException("Workspace branch not found");
    }

    await this.prisma.$transaction([
      this.prisma.tenant.update({
        where: { id: owner.tenantId },
        data: {
          name: payload.companyName.trim(),
        },
      }),
      this.prisma.branch.update({
        where: { id: branch.id },
        data: {
          name: payload.branchName.trim(),
          city: payload.city?.trim() || null,
          addressLine1: payload.addressLine1?.trim() || null,
          postalCode: payload.postalCode?.trim() || null,
          phone: payload.phone?.trim() || null,
          email: payload.email?.trim().toLowerCase() || null,
        },
      }),
      this.prisma.user.update({
        where: { id: owner.id },
        data: {
          firstName: payload.ownerFirstName.trim(),
          lastName: payload.ownerLastName.trim(),
          phone: payload.phone?.trim() || null,
        },
      }),
      this.upsertSettingMutation(owner.tenantId, SETUP_COMPLETED_KEY, true),
    ]);
  }

  async changeOwnerPassword(userId: string, currentPassword: string, newPassword: string) {
    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!owner || !owner.passwordHash) {
      throw new UnauthorizedException("Unable to update password");
    }

    if (!verifyPassword(currentPassword, owner.passwordHash)) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: owner.id },
        data: {
          passwordHash: hashPassword(newPassword),
        },
      }),
      this.upsertSettingMutation(owner.tenantId, FORCE_PASSWORD_CHANGE_KEY, false),
    ]);
  }

  async getDocumentSettings(tenantId: string): Promise<DocumentSettings> {
    const [
      headerCompanyName,
      headerCompanySubtitle,
      headerAddressLine,
      headerPhone,
      headerPhoneSecondary,
      headerRc,
      headerTaxId,
      headerCapital,
      headerArabicCompanyName,
      headerArabicAddressLine,
      invoiceFooterConditions,
      bankIban,
      bankBic,
      bankAccountHolder,
    ] = await Promise.all([
      this.getStringSetting(tenantId, HEADER_COMPANY_NAME_KEY, "SO.TE.CO"),
      this.getStringSetting(tenantId, HEADER_COMPANY_SUBTITLE_KEY, "Société Tunisienne des Etudes et Constructions"),
      this.getStringSetting(tenantId, HEADER_ADDRESS_LINE_KEY, "Cité Bouhsina, Sousse"),
      this.getStringSetting(tenantId, HEADER_PHONE_KEY, "+216 73 230 179"),
      this.getStringSetting(tenantId, HEADER_PHONE_SECONDARY_KEY, ""),
      this.getStringSetting(tenantId, HEADER_RC_KEY, "B09242852018"),
      this.getStringSetting(tenantId, HEADER_TAX_ID_KEY, "1588490B/A/M/000"),
      this.getStringSetting(tenantId, HEADER_CAPITAL_KEY, "Capital 100 mille dinars"),
      this.getStringSetting(tenantId, HEADER_ARABIC_COMPANY_NAME_KEY, "الشركة التونسية للدراسات و البناء"),
      this.getStringSetting(tenantId, HEADER_ARABIC_ADDRESS_LINE_KEY, "سوسة"),
      this.getStringSetting(tenantId, INVOICE_FOOTER_CONDITIONS_KEY, ""),
      this.getStringSetting(tenantId, BANK_IBAN_KEY, ""),
      this.getStringSetting(tenantId, BANK_BIC_KEY, ""),
      this.getStringSetting(tenantId, BANK_ACCOUNT_HOLDER_KEY, ""),
    ]);

    return {
      headerCompanyName,
      headerCompanySubtitle,
      headerAddressLine,
      headerPhone,
      headerPhoneSecondary,
      headerRc,
      headerTaxId,
      headerCapital,
      headerArabicCompanyName,
      headerArabicAddressLine,
      invoiceFooterConditions,
      bankIban,
      bankBic,
      bankAccountHolder,
    };
  }

  async updateDocumentSettings(
    tenantId: string,
    payload: Partial<DocumentSettings>,
  ): Promise<DocumentSettings> {
    const mutations = [];

    if (Object.prototype.hasOwnProperty.call(payload, "headerCompanyName")) {
      mutations.push(this.upsertStringSettingMutation(tenantId, HEADER_COMPANY_NAME_KEY, payload.headerCompanyName ?? ""));
    }
    if (Object.prototype.hasOwnProperty.call(payload, "headerCompanySubtitle")) {
      mutations.push(this.upsertStringSettingMutation(tenantId, HEADER_COMPANY_SUBTITLE_KEY, payload.headerCompanySubtitle ?? ""));
    }
    if (Object.prototype.hasOwnProperty.call(payload, "headerAddressLine")) {
      mutations.push(this.upsertStringSettingMutation(tenantId, HEADER_ADDRESS_LINE_KEY, payload.headerAddressLine ?? ""));
    }
    if (Object.prototype.hasOwnProperty.call(payload, "headerPhone")) {
      mutations.push(this.upsertStringSettingMutation(tenantId, HEADER_PHONE_KEY, payload.headerPhone ?? ""));
    }
    if (Object.prototype.hasOwnProperty.call(payload, "headerPhoneSecondary")) {
      mutations.push(this.upsertStringSettingMutation(tenantId, HEADER_PHONE_SECONDARY_KEY, payload.headerPhoneSecondary ?? ""));
    }
    if (Object.prototype.hasOwnProperty.call(payload, "headerRc")) {
      mutations.push(this.upsertStringSettingMutation(tenantId, HEADER_RC_KEY, payload.headerRc ?? ""));
    }
    if (Object.prototype.hasOwnProperty.call(payload, "headerTaxId")) {
      mutations.push(this.upsertStringSettingMutation(tenantId, HEADER_TAX_ID_KEY, payload.headerTaxId ?? ""));
    }
    if (Object.prototype.hasOwnProperty.call(payload, "headerCapital")) {
      mutations.push(this.upsertStringSettingMutation(tenantId, HEADER_CAPITAL_KEY, payload.headerCapital ?? ""));
    }
    if (Object.prototype.hasOwnProperty.call(payload, "headerArabicCompanyName")) {
      mutations.push(
        this.upsertStringSettingMutation(
          tenantId,
          HEADER_ARABIC_COMPANY_NAME_KEY,
          payload.headerArabicCompanyName ?? "",
        ),
      );
    }
    if (Object.prototype.hasOwnProperty.call(payload, "headerArabicAddressLine")) {
      mutations.push(
        this.upsertStringSettingMutation(
          tenantId,
          HEADER_ARABIC_ADDRESS_LINE_KEY,
          payload.headerArabicAddressLine ?? "",
        ),
      );
    }
    if (Object.prototype.hasOwnProperty.call(payload, "invoiceFooterConditions")) {
      mutations.push(
        this.upsertStringSettingMutation(
          tenantId,
          INVOICE_FOOTER_CONDITIONS_KEY,
          payload.invoiceFooterConditions ?? "",
        ),
      );
    }
    if (Object.prototype.hasOwnProperty.call(payload, "bankIban")) {
      mutations.push(this.upsertStringSettingMutation(tenantId, BANK_IBAN_KEY, payload.bankIban ?? ""));
    }
    if (Object.prototype.hasOwnProperty.call(payload, "bankBic")) {
      mutations.push(this.upsertStringSettingMutation(tenantId, BANK_BIC_KEY, payload.bankBic ?? ""));
    }
    if (Object.prototype.hasOwnProperty.call(payload, "bankAccountHolder")) {
      mutations.push(
        this.upsertStringSettingMutation(tenantId, BANK_ACCOUNT_HOLDER_KEY, payload.bankAccountHolder ?? ""),
      );
    }

    if (mutations.length) {
      await this.prisma.$transaction(mutations);
    }

    return this.getDocumentSettings(tenantId);
  }

  private async ensureBooleanSetting(tenantId: string, key: string, fallback: boolean) {
    await this.prisma.setting.upsert({
      where: {
        tenantId_scopeKey_key: {
          tenantId,
          scopeKey: GLOBAL_SCOPE,
          key,
        },
      },
      update: {},
      create: {
        tenantId,
        scopeKey: GLOBAL_SCOPE,
        key,
        value: fallback,
      },
    });
  }

  private async getBooleanSetting(tenantId: string, key: string, fallback: boolean) {
    const setting = await this.prisma.setting.findUnique({
      where: {
        tenantId_scopeKey_key: {
          tenantId,
          scopeKey: GLOBAL_SCOPE,
          key,
        },
      },
      select: {
        value: true,
      },
    });

    if (typeof setting?.value === "boolean") {
      return setting.value;
    }

    return fallback;
  }

  private async getStringSetting(tenantId: string, key: string, fallback: string) {
    const setting = await this.prisma.setting.findUnique({
      where: {
        tenantId_scopeKey_key: {
          tenantId,
          scopeKey: GLOBAL_SCOPE,
          key,
        },
      },
      select: {
        value: true,
      },
    });

    return typeof setting?.value === "string" ? setting.value : fallback;
  }

  private upsertSettingMutation(tenantId: string, key: string, value: boolean) {
    return this.prisma.setting.upsert({
      where: {
        tenantId_scopeKey_key: {
          tenantId,
          scopeKey: GLOBAL_SCOPE,
          key,
        },
      },
      update: {
        value,
      },
      create: {
        tenantId,
        scopeKey: GLOBAL_SCOPE,
        key,
        value,
      },
    });
  }

  private upsertStringSettingMutation(tenantId: string, key: string, value: string) {
    return this.prisma.setting.upsert({
      where: {
        tenantId_scopeKey_key: {
          tenantId,
          scopeKey: GLOBAL_SCOPE,
          key,
        },
      },
      update: {
        value,
      },
      create: {
        tenantId,
        scopeKey: GLOBAL_SCOPE,
        key,
        value,
      },
    });
  }
}
