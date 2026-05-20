import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { CrmService } from "./crm.service";
import { CreateLeadDto } from "./dto/create-lead.dto";
import { ListLeadsDto } from "./dto/list-leads.dto";
import { UpdateLeadDto } from "./dto/update-lead.dto";

@ApiTags("CRM")
@ApiBearerAuth()
@Controller("crm/leads")
export class LeadsController {
  constructor(private readonly crmService: CrmService) {}

  @ApiOperation({ summary: "List leads with pagination and search filters" })
  @RequirePermissions("leads.read")
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListLeadsDto) {
    return this.crmService.listLeads(user, query);
  }

  @ApiOperation({ summary: "Create a lead" })
  @RequirePermissions("leads.create")
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() payload: CreateLeadDto) {
    return this.crmService.createLead(user, payload);
  }

  @ApiOperation({ summary: "Update a lead" })
  @RequirePermissions("leads.update")
  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() payload: UpdateLeadDto,
  ) {
    return this.crmService.updateLead(user, id, payload);
  }

  @ApiOperation({ summary: "Delete a lead" })
  @RequirePermissions("leads.update")
  @Delete(":id")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.crmService.deleteLead(user, id);
  }
}
