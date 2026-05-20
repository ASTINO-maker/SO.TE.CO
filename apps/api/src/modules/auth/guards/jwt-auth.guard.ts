import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { AccessTokenPayload, AuthenticatedUser } from "../interfaces/authenticated-user.interface";

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.configService.get<string>("JWT_ACCESS_SECRET") ?? "change-me",
      });

      request.user = {
        userId: payload.sub,
        tenantId: payload.tenantId,
        branchId: payload.branchId,
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        fullName: payload.fullName,
        status: payload.status,
        roleCodes: payload.roleCodes,
        roleNames: payload.roleNames,
        permissions: payload.permissions,
        scopes: payload.scopes,
        workspaceSetupCompleted: payload.workspaceSetupCompleted,
        workspaceSetupRequired: payload.workspaceSetupRequired,
        requiresPasswordChange: payload.requiresPasswordChange,
      };

      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }

  private extractToken(request: Request) {
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    return scheme === "Bearer" ? token : null;
  }
}
