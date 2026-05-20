import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { RolesService } from "./roles.service";

@ApiTags("Roles")
@Controller("roles")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @ApiOperation({ summary: "List role templates and permission families" })
  @RequirePermissions("roles.read")
  @Get()
  list() {
    return this.rolesService.list();
  }
}
