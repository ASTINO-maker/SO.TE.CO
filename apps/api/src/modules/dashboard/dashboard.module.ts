import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { WorkspaceModule } from "../../common/workspace/workspace.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [PrismaModule, WorkspaceModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
