import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ListQueryDto } from "../../common/dto/list-query.dto";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { ProjectsService } from "./projects.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

@ApiTags("Projects")
@ApiBearerAuth()
@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @ApiOperation({ summary: "List projects and chantier records" })
  @RequirePermissions("projects.read")
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() pagination: ListQueryDto) {
    return this.projectsService.list(user, pagination);
  }

  @ApiOperation({ summary: "Create a project" })
  @RequirePermissions("projects.create")
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() payload: CreateProjectDto) {
    return this.projectsService.create(user, payload);
  }

  @ApiOperation({ summary: "Update a project" })
  @RequirePermissions("projects.update")
  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() payload: UpdateProjectDto,
  ) {
    return this.projectsService.update(user, id, payload);
  }

  @ApiOperation({ summary: "Delete a project" })
  @RequirePermissions("projects.update")
  @Delete(":id")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.projectsService.remove(user, id);
  }
}
