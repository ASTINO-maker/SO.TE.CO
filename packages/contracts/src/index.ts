export type AppModuleKey =
  | "dashboard"
  | "crm"
  | "sales"
  | "projects"
  | "finance"
  | "catalog"
  | "documents"
  | "users"
  | "roles";

export type RoleCode =
  | "super_admin"
  | "manager"
  | "accountant"
  | "sales"
  | "workshop_manager"
  | "logistics_delivery"
  | "employee_viewer";

export type PermissionResource =
  | "dashboard"
  | "reports"
  | "activity_logs"
  | "audit_logs"
  | "clients"
  | "client_contacts"
  | "leads"
  | "lead_activities"
  | "notes"
  | "quotations"
  | "invoices"
  | "payments"
  | "expenses"
  | "delivery_notes"
  | "vehicles"
  | "projects"
  | "project_stages"
  | "project_tasks"
  | "project_measurements"
  | "project_files"
  | "files"
  | "catalog"
  | "users"
  | "roles"
  | "permissions"
  | "settings"
  | "numbering_sequences"
  | "sessions";

export type PermissionAction =
  | "read"
  | "create"
  | "update"
  | "archive"
  | "delete"
  | "convert"
  | "send"
  | "approve"
  | "reject"
  | "duplicate"
  | "export"
  | "export_pdf"
  | "issue"
  | "void"
  | "record"
  | "allocate"
  | "pay"
  | "change_status"
  | "assign"
  | "manage"
  | "upload"
  | "link"
  | "suspend"
  | "revoke";

export type PermissionCode = `${PermissionResource}.${PermissionAction}`;

export type ProjectLifecycleStatus =
  | "DRAFT"
  | "PLANNED"
  | "IN_MEASUREMENT"
  | "IN_DESIGN"
  | "IN_FABRICATION"
  | "READY_FOR_DELIVERY"
  | "IN_INSTALLATION"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";

export interface DashboardKpi {
  label: string;
  value: string;
  trend?: string;
}

export interface NavigationItem {
  title: string;
  href: string;
  module: AppModuleKey;
  description: string;
}
