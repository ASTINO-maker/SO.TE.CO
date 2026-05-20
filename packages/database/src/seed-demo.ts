import type { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "crypto";
import { seedTenantRbac } from "./seed-rbac";

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export async function seedDemoTenant(
  prisma: PrismaClient,
  options?: {
    tenantName?: string;
    tenantSlug?: string;
    branchName?: string;
    branchCode?: string;
    adminFirstName?: string;
    adminLastName?: string;
    adminEmail?: string;
    adminPassword?: string;
  },
) {
  const tenant = await prisma.tenant.upsert({
    where: {
      slug: options?.tenantSlug ?? "sotec",
    },
    update: {
      name: options?.tenantName ?? "SO.TE.CO",
    },
    create: {
      name: options?.tenantName ?? "SO.TE.CO",
      slug: options?.tenantSlug ?? "sotec",
    },
  });

  const branch = await prisma.branch.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: options?.branchCode ?? "HQ",
      },
    },
    update: {
      name: options?.branchName ?? "Tunis HQ",
    },
    create: {
      tenantId: tenant.id,
      name: options?.branchName ?? "Tunis HQ",
      code: options?.branchCode ?? "HQ",
      city: "Tunis",
      isActive: true,
    },
  });

  await seedTenantRbac(prisma, tenant.id);

  const superAdminRole = await prisma.role.findUniqueOrThrow({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: "super_admin",
      },
    },
  });

  const adminEmail = (options?.adminEmail ?? "admin@sotec.local").trim().toLowerCase();
  const adminPassword = options?.adminPassword ?? "ChangeMe123!";

  const adminUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: adminEmail,
      },
    },
    update: {
      firstName: options?.adminFirstName ?? "Super",
      lastName: options?.adminLastName ?? "Admin",
      branchId: branch.id,
      passwordHash: hashPassword(adminPassword),
      status: "ACTIVE",
    },
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      firstName: options?.adminFirstName ?? "Super",
      lastName: options?.adminLastName ?? "Admin",
      email: adminEmail,
      passwordHash: hashPassword(adminPassword),
      status: "ACTIVE",
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: superAdminRole.id,
    },
  });

  return {
    tenantId: tenant.id,
    branchId: branch.id,
    adminUserId: adminUser.id,
    adminEmail,
    adminPassword,
  };
}
