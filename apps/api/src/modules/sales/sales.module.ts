import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { WorkspaceModule } from "../../common/workspace/workspace.module";
import { SalesService } from "./sales.service";
import { QuotationsController } from "./quotations.controller";
import { InvoicesController } from "./invoices.controller";
import { DeliveryNotesController } from "./delivery-notes.controller";
import { PaymentsController } from "./payments.controller";

@Module({
  imports: [PrismaModule, WorkspaceModule],
  controllers: [
    QuotationsController,
    InvoicesController,
    DeliveryNotesController,
    PaymentsController,
  ],
  providers: [SalesService],
})
export class SalesModule {}
