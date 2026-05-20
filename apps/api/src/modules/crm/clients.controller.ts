import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { CrmService } from "./crm.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { ListClientsDto } from "./dto/list-clients.dto";
import { UpdateClientDto } from "./dto/update-client.dto";

@ApiTags("CRM")
@ApiBearerAuth()
@Controller("crm/clients")
export class ClientsController {
  constructor(private readonly crmService: CrmService) {}

  @ApiOperation({ summary: "List clients with pagination and search filters" })
  @RequirePermissions("clients.read")
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListClientsDto) {
    return this.crmService.listClients(user, query);
  }

  @ApiOperation({ summary: "Get one client by id" })
  @RequirePermissions("clients.read")
  @Get(":id")
  get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.crmService.getClient(user, id);
  }

  @ApiOperation({ summary: "Create a client" })
  @RequirePermissions("clients.create")
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() payload: CreateClientDto) {
    return this.crmService.createClient(user, payload);
  }

  @ApiOperation({ summary: "Update a client" })
  @RequirePermissions("clients.update")
  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() payload: UpdateClientDto,
  ) {
    return this.crmService.updateClient(user, id, payload);
  }
}
