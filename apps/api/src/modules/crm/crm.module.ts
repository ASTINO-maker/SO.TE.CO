import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { WorkspaceModule } from "../../common/workspace/workspace.module";
import { ClientsController } from "./clients.controller";
import { LeadsController } from "./leads.controller";
import { CrmService } from "./crm.service";

@Module({
  imports: [PrismaModule, WorkspaceModule],
  controllers: [ClientsController, LeadsController],
  providers: [CrmService],
})
export class CrmModule {}
