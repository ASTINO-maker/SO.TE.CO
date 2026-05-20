import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { BootstrapWorkspaceDto } from "./dto/bootstrap-workspace.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Public } from "./decorators/public.decorator";
import { LoginDto } from "./dto/login.dto";
import { LogoutDto } from "./dto/logout.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import type { AuthenticatedUser } from "./interfaces/authenticated-user.interface";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @ApiOperation({ summary: "Authenticate with email and password" })
  @Post("login")
  login(@Body() payload: LoginDto, @Req() request: Request) {
    return this.authService.login(payload, this.buildRequestMetadata(request));
  }

  @Public()
  @ApiOperation({ summary: "Refresh access token using a rotating refresh token" })
  @Post("refresh")
  refresh(@Body() payload: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refresh(payload, this.buildRequestMetadata(request));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the current authenticated user context" })
  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: "Revoke a refresh token and close the session" })
  @Post("logout")
  logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: LogoutDto,
    @Req() request: Request,
  ) {
    return this.authService.logout(user, payload, this.buildRequestMetadata(request));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: "Change the owner password" })
  @Post("change-password")
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: ChangePasswordDto,
    @Req() request: Request,
  ) {
    return this.authService.changePassword(user, payload, this.buildRequestMetadata(request));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: "Complete the first-run workspace bootstrap" })
  @Post("bootstrap")
  bootstrap(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: BootstrapWorkspaceDto,
    @Req() request: Request,
  ) {
    return this.authService.bootstrapWorkspace(user, payload, this.buildRequestMetadata(request));
  }

  private buildRequestMetadata(request: Request) {
    const forwardedFor = request.headers["x-forwarded-for"];

    return {
      ipAddress:
        typeof forwardedFor === "string"
          ? forwardedFor.split(",")[0]?.trim()
          : request.ip,
      userAgent: request.headers["user-agent"] ?? null,
    };
  }
}
