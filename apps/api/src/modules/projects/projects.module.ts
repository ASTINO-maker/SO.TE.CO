import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { WorkspaceModule } from "../../common/workspace/workspace.module";
import { ProjectsController } from "./projects.controller";
import { ProjectStatusController } from "./project-status.controller";
import { ProjectsService } from "./projects.service";

@Module({
  imports: [PrismaModule, WorkspaceModule],
  controllers: [ProjectsController, ProjectStatusController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
