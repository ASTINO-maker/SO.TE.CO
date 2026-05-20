import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./common/prisma/prisma.module";
import { AuditModule } from "./modules/audit/audit.module";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { RolesModule } from "./modules/roles/roles.module";
import { CrmModule } from "./modules/crm/crm.module";
import { SalesModule } from "./modules/sales/sales.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { StorageModule } from "./modules/storage/storage.module";
import { PdfModule } from "./modules/pdf/pdf.module";
import { SettingsModule } from "./modules/settings/settings.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env"],
    }),
    PrismaModule,
    AuditModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    CrmModule,
    SalesModule,
    ProjectsModule,
    CatalogModule,
    FinanceModule,
    DocumentsModule,
    DashboardModule,
    StorageModule,
    PdfModule,
    SettingsModule,
  ],
})
export class AppModule {}
