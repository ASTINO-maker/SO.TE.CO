import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { WorkspaceModule } from "../../common/workspace/workspace.module";
import { ExpensesController } from "./expenses.controller";
import { FinanceService } from "./finance.service";

@Module({
  imports: [PrismaModule, WorkspaceModule],
  controllers: [ExpensesController],
  providers: [FinanceService],
})
export class FinanceModule {}
