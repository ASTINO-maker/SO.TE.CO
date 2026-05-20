import { roleTemplates, permissionCatalog } from "@sotec/config";
import type { PrismaClient } from "@prisma/client";

export async function seedTenantRbac(prisma: PrismaClient, tenantId: string) {
  for (const permission of permissionCatalog) {
    await prisma.permission.upsert({
      where: {
        tenantId_code: {
          tenantId,
          code: permission.code,
        },
      },
      update: {
        label: permission.label,
        description: permission.description,
      },
      create: {
        tenantId,
        code: permission.code,
        label: permission.label,
        description: permission.description,
      },
    });
  }

  for (const roleTemplate of roleTemplates) {
    const role = await prisma.role.upsert({
      where: {
        tenantId_code: {
          tenantId,
          code: roleTemplate.code,
        },
      },
      update: {
        name: roleTemplate.name,
        description: roleTemplate.description,
      },
      create: {
        tenantId,
        code: roleTemplate.code,
        name: roleTemplate.name,
        description: roleTemplate.description,
        isSystemRole: true,
      },
    });

    const permissions = await prisma.permission.findMany({
      where: {
        tenantId,
        code: {
          in: roleTemplate.permissionCodes,
        },
      },
      select: {
        id: true,
      },
    });

    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }
}

