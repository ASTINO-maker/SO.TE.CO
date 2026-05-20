import type { ScopePolicy } from "@sotec/config";
import type { UserStatus } from "@sotec/database";

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  branchId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: UserStatus;
  roleCodes: string[];
  roleNames: string[];
  permissions: string[];
  scopes: ScopePolicy[];
  workspaceSetupCompleted: boolean;
  workspaceSetupRequired: boolean;
  requiresPasswordChange: boolean;
}

export interface AccessTokenPayload extends AuthenticatedUser {
  sub: string;
}

export interface RequestMetadata {
  ipAddress?: string | null;
  userAgent?: string | null;
}
