import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { ProjectsService } from "./projects.service";

@ApiTags("Projects")
@ApiBearerAuth()
@Controller("projects/status-events")
export class ProjectStatusController {
  constructor(private readonly projectsService: ProjectsService) {}

  @ApiOperation({ summary: "List project status events" })
  @RequirePermissions("projects.read")
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.statusTimeline(user);
  }
}
