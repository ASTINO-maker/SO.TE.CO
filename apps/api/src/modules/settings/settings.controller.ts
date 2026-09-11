import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SettingsService } from "./settings.service";
import { UpdateDocumentSettingsDto } from "./dto/update-document-settings.dto";
import { CreateWorkerPaymentDto } from "./dto/create-worker-payment.dto";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { UpdateOwnerProfileDto } from "./dto/update-owner-profile.dto";
import { UpdateWorkspaceSettingsDto } from "./dto/update-workspace-settings.dto";

@ApiTags("Settings")
@ApiBearerAuth()
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("documents")
  @ApiOperation({ summary: "Get document footer and banking settings" })
  getDocumentSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getDocumentSettings(user);
  }

  @Get("account")
  @ApiOperation({ summary: "Get owner account settings" })
  getOwnerAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getOwnerAccount(user.userId);
  }

  @Patch("account")
  @ApiOperation({ summary: "Update owner account settings" })
  updateOwnerAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateOwnerProfileDto,
  ) {
    return this.settingsService.updateOwnerAccount(user.userId, body);
  }

  @RequirePermissions("settings.read")
  @Get("workspace")
  @ApiOperation({ summary: "Get workspace company settings" })
  getWorkspaceSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getWorkspaceSettings(user.tenantId, user.branchId);
  }

  @RequirePermissions("settings.update")
  @Patch("workspace")
  @ApiOperation({ summary: "Update workspace company settings" })
  updateWorkspaceSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateWorkspaceSettingsDto,
  ) {
    return this.settingsService.updateWorkspaceSettings(user.tenantId, user.branchId, body);
  }

  @RequirePermissions("settings.update")
  @Patch("documents")
  @ApiOperation({ summary: "Update document footer and banking settings" })
  updateDocumentSettings(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateDocumentSettingsDto) {
    return this.settingsService.updateDocumentSettings(user, body);
  }

  @RequirePermissions("payments.read")
  @Get("worker-payments")
  @ApiOperation({ summary: "List worker payment batches" })
  getWorkerPayments(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getWorkerPayments(user.tenantId);
  }

  @RequirePermissions("payments.update")
  @Post("worker-payments")
  @ApiOperation({ summary: "Create a worker payment batch" })
  createWorkerPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateWorkerPaymentDto,
  ) {
    return this.settingsService.createWorkerPayment(user.tenantId, body);
  }

  @RequirePermissions("payments.update")
  @Patch("worker-payments/:id")
  @ApiOperation({ summary: "Update a worker payment batch" })
  updateWorkerPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: CreateWorkerPaymentDto,
  ) {
    return this.settingsService.updateWorkerPayment(user.tenantId, id, body);
  }

  @RequirePermissions("payments.update")
  @Delete("worker-payments/:id")
  @ApiOperation({ summary: "Delete a worker payment batch" })
  deleteWorkerPayment(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.settingsService.deleteWorkerPayment(user.tenantId, id);
  }
}
