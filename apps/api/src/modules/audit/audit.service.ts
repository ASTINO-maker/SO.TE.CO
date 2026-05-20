import { Injectable } from "@nestjs/common";
import type { AuditAction, Prisma } from "@sotec/database";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  describeStrategy() {
    return {
      mode: "database_audit_log",
      captures: ["create", "update", "soft_delete", "status_change", "auth_events"],
    };
  }

  async record(input: {
    tenantId: string;
    branchId?: string | null;
    userId?: string | null;
    action: AuditAction;
    entityType: string;
    entityId: string;
    oldValues?: Prisma.InputJsonValue | null;
    newValues?: Prisma.InputJsonValue | null;
    metadata?: Prisma.InputJsonValue | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        branchId: input.branchId ?? undefined,
        userId: input.userId ?? undefined,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        oldValues: input.oldValues ?? undefined,
        newValues: input.newValues ?? undefined,
        metadata: input.metadata ?? undefined,
        ipAddress: input.ipAddress ?? undefined,
        userAgent: input.userAgent ?? undefined,
      },
    });
  }
}
