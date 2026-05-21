import {
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { permissionCatalog, roleTemplates } from "@sotec/config";
import {
  AuditAction,
  type Prisma,
  UserStatus,
} from "@sotec/database";
import { PrismaService } from "../../common/prisma/prisma.service";
import { WorkspaceService } from "../../common/workspace/workspace.service";
import { AuditService } from "../audit/audit.service";
import { BootstrapWorkspaceDto } from "./dto/bootstrap-workspace.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { LoginDto } from "./dto/login.dto";
import { LogoutDto } from "./dto/logout.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { generateRefreshToken, hashToken, verifyPassword } from "./auth.utils";
import type {
  AccessTokenPayload,
  AuthenticatedUser,
  RequestMetadata,
} from "./interfaces/authenticated-user.interface";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_DAYS = 30;

const roleScopeMap = new Map(roleTemplates.map((role) => [role.code, role.defaultScope]));
const rolePermissionCodesMap = new Map(roleTemplates.map((role) => [role.code, role.permissionCodes]));
const allPermissionCodes = permissionCatalog.map((permission) => permission.code);

type UserWithAccess = Prisma.UserGetPayload<{
  include: {
    branch: true;
    userRoles: {
      include: {
        role: true;
      };
    };
  };
}>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly workspaceService: WorkspaceService,
    private readonly auditService: AuditService,
  ) {}

  async login(payload: LoginDto, metadata: RequestMetadata) {
    await this.workspaceService.ensureWorkspace();
    const user = await this.findUserByEmail(payload.email);
    this.ensureLoginEligible(user, payload.password);

    const [principal, session] = await Promise.all([
      this.toPrincipal(user),
      this.createSession(user, metadata),
    ]);
    const accessToken = await this.signAccessToken(principal);

    this.recordLoginSideEffects(user, principal, metadata);

    return {
      accessToken,
      refreshToken: session.rawToken,
      tokenType: "Bearer",
      expiresIn: ACCESS_TOKEN_TTL,
      user: principal,
    };
  }

  async refresh(payload: RefreshTokenDto, metadata: RequestMetadata) {
    const tokenHash = hashToken(payload.refreshToken);
    const existingSession = await this.prisma.refreshToken.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: {
          include: {
            branch: true,
            userRoles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    if (!existingSession || existingSession.revokedAt || existingSession.expiresAt <= new Date()) {
      throw new UnauthorizedException("Refresh token is invalid or expired");
    }

    this.ensureUserStatus(existingSession.user.status);

    await this.prisma.refreshToken.update({
      where: {
        id: existingSession.id,
      },
      data: {
        revokedAt: new Date(),
        lastUsedAt: new Date(),
      },
    });

    const principal = await this.toPrincipal(existingSession.user);
    const newSession = await this.createSession(existingSession.user, metadata);
    const accessToken = await this.signAccessToken(principal);

    return {
      accessToken,
      refreshToken: newSession.rawToken,
      tokenType: "Bearer",
      expiresIn: ACCESS_TOKEN_TTL,
      user: principal,
    };
  }

  async me(user: AuthenticatedUser) {
    const freshUser = await this.findUserById(user.userId);
    return this.toPrincipal(freshUser);
  }

  async logout(user: AuthenticatedUser, payload: LogoutDto, metadata: RequestMetadata) {
    const tokenHash = hashToken(payload.refreshToken);

    const existingSession = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        userId: user.userId,
        revokedAt: null,
      },
    });

    if (existingSession) {
      await this.prisma.refreshToken.update({
        where: {
          id: existingSession.id,
        },
        data: {
          revokedAt: new Date(),
          lastUsedAt: new Date(),
        },
      });
    }

    await this.auditService.record({
      tenantId: user.tenantId,
      branchId: user.branchId,
      userId: user.userId,
      action: AuditAction.LOGOUT,
      entityType: "user",
      entityId: user.userId,
      metadata: {
        revokedToken: Boolean(existingSession),
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return {
      success: true,
    };
  }

  async changePassword(
    user: AuthenticatedUser,
    payload: ChangePasswordDto,
    metadata: RequestMetadata,
  ) {
    await this.workspaceService.changeOwnerPassword(
      user.userId,
      payload.currentPassword,
      payload.newPassword,
    );

    await this.auditService.record({
      tenantId: user.tenantId,
      branchId: user.branchId,
      userId: user.userId,
      action: AuditAction.UPDATE,
      entityType: "user",
      entityId: user.userId,
      metadata: {
        event: "password_change",
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    const freshUser = await this.findUserById(user.userId);
    return this.toPrincipal(freshUser);
  }

  async bootstrapWorkspace(
    user: AuthenticatedUser,
    payload: BootstrapWorkspaceDto,
    metadata: RequestMetadata,
  ) {
    await this.workspaceService.completeWorkspaceSetup(user.userId, payload);

    await this.auditService.record({
      tenantId: user.tenantId,
      branchId: user.branchId,
      userId: user.userId,
      action: AuditAction.UPDATE,
      entityType: "workspace",
      entityId: user.tenantId,
      metadata: {
        event: "first_run_bootstrap",
        companyName: payload.companyName,
        branchName: payload.branchName,
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    const freshUser = await this.findUserById(user.userId);
    return this.toPrincipal(freshUser);
  }

  private async findUserByEmail(email: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        deletedAt: null,
      },
      include: {
        branch: true,
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return user;
  }

  private async findUserById(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      include: {
        branch: true,
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException("Authenticated user no longer exists");
    }

    this.ensureUserStatus(user.status);
    return user;
  }

  private ensureLoginEligible(user: UserWithAccess, password: string) {
    this.ensureUserStatus(user.status);

    if (!user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid email or password");
    }
  }

  private ensureUserStatus(status: UserStatus) {
    if (status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("User account is not active");
    }
  }

  private async toPrincipal(user: UserWithAccess): Promise<AuthenticatedUser> {
    const roleCodes = user.userRoles.map(({ role }) => role.code);
    const roleNames = user.userRoles.map(({ role }) => role.name);
    const permissions = roleCodes.includes("super_admin")
      ? allPermissionCodes
      : Array.from(
          new Set(
            roleCodes.flatMap((roleCode) => rolePermissionCodesMap.get(roleCode) ?? []),
          ),
        );
    const scopes = Array.from(
      new Set(
        roleCodes
          .map((roleCode) => roleScopeMap.get(roleCode))
          .filter((scope): scope is NonNullable<typeof scope> => Boolean(scope)),
      ),
    );
    const flags = await this.workspaceService.getWorkspaceFlags(user.tenantId);

    return {
      userId: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      status: user.status,
      roleCodes,
      roleNames,
      permissions,
      scopes,
      workspaceSetupCompleted: flags.workspaceSetupCompleted,
      workspaceSetupRequired: !flags.workspaceSetupCompleted,
      requiresPasswordChange: flags.requiresPasswordChange,
    };
  }

  private async signAccessToken(principal: AuthenticatedUser) {
    const payload: AccessTokenPayload = {
      sub: principal.userId,
      ...principal,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>("JWT_ACCESS_SECRET") ?? "change-me",
      expiresIn: this.configService.get<string>("JWT_ACCESS_TTL") ?? ACCESS_TOKEN_TTL,
    });
  }

  private async createSession(user: UserWithAccess, metadata: RequestMetadata) {
    const rawToken = generateRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: this.resolveRefreshExpiry(),
        ipAddress: metadata.ipAddress ?? undefined,
        userAgent: metadata.userAgent ?? undefined,
      },
    });

    return {
      rawToken,
    };
  }

  private resolveRefreshExpiry() {
    const ttlInDays = Number(
      this.configService.get<string>("JWT_REFRESH_TTL_DAYS") ?? REFRESH_TOKEN_TTL_DAYS,
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlInDays);
    return expiresAt;
  }

  private recordLoginSideEffects(
    user: UserWithAccess,
    principal: AuthenticatedUser,
    metadata: RequestMetadata,
  ) {
    void Promise.all([
      this.prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          lastLoginAt: new Date(),
        },
      }),
      this.auditService.record({
        tenantId: principal.tenantId,
        branchId: principal.branchId,
        userId: principal.userId,
        action: AuditAction.LOGIN,
        entityType: "user",
        entityId: principal.userId,
        metadata: {
          roles: principal.roleCodes,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      }),
    ]).catch((error) => {
      this.logger.error(
        "Failed to record login side effects",
        error instanceof Error ? error.stack : String(error),
      );
    });
  }
}
