import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SettingsService } from "./settings.service";
import { UpdateDocumentSettingsDto } from "./dto/update-document-settings.dto";
import { CreateWorkerPaymentDto } from "./dto/create-worker-payment.dto";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
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
  getDocumentSettings() {
    return this.settingsService.getDocumentSettings();
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

  @Get("workspace")
  @ApiOperation({ summary: "Get workspace company settings" })
  getWorkspaceSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getWorkspaceSettings(user.tenantId, user.branchId);
  }

  @Patch("workspace")
  @ApiOperation({ summary: "Update workspace company settings" })
  updateWorkspaceSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateWorkspaceSettingsDto,
  ) {
    return this.settingsService.updateWorkspaceSettings(user.tenantId, user.branchId, body);
  }

  @Patch("documents")
  @ApiOperation({ summary: "Update document footer and banking settings" })
  updateDocumentSettings(@Body() body: UpdateDocumentSettingsDto) {
    return this.settingsService.updateDocumentSettings(body);
  }

  @Get("worker-payments")
  @ApiOperation({ summary: "List worker payment batches" })
  getWorkerPayments() {
    return this.settingsService.getWorkerPayments();
  }

  @Post("worker-payments")
  @ApiOperation({ summary: "Create a worker payment batch" })
  createWorkerPayment(@Body() body: CreateWorkerPaymentDto) {
    return this.settingsService.createWorkerPayment(body);
  }

  @Patch("worker-payments/:id")
  @ApiOperation({ summary: "Update a worker payment batch" })
  updateWorkerPayment(@Param("id") id: string, @Body() body: CreateWorkerPaymentDto) {
    return this.settingsService.updateWorkerPayment(id, body);
  }

  @Delete("worker-payments/:id")
  @ApiOperation({ summary: "Delete a worker payment batch" })
  deleteWorkerPayment(@Param("id") id: string) {
    return this.settingsService.deleteWorkerPayment(id);
  }
}
