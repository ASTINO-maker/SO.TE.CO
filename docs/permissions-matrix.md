# RBAC Model

## Roles

- `Super Admin`
- `Manager`
- `Accountant`
- `Sales`
- `Workshop Manager`
- `Logistics / Delivery`
- `Employee / Viewer`

## Scope Strategy

Permissions alone are not enough. Each authenticated user should also carry a data scope:

- `tenant`: full tenant-wide access within granted permissions
- `branch`: access limited to one or more allowed branches
- `assigned`: access limited to records assigned to the user or where the user is part of project assignments
- `self`: access limited to the user’s own profile/session data

Recommended default scope by role:

- `Super Admin`: `tenant`
- `Manager`: `tenant`
- `Accountant`: `tenant`
- `Sales`: `branch`
- `Workshop Manager`: `branch`
- `Logistics / Delivery`: `branch`
- `Employee / Viewer`: `assigned` or `branch` read-only

## Permission Catalog

### Dashboard / Reporting

- `dashboard.read`
- `reports.read`
- `reports.export`
- `activity_logs.read`
- `audit_logs.read`

### Clients / CRM

- `clients.read`
- `clients.create`
- `clients.update`
- `clients.archive`
- `client_contacts.read`
- `client_contacts.create`
- `client_contacts.update`
- `client_contacts.delete`
- `leads.read`
- `leads.create`
- `leads.update`
- `leads.archive`
- `leads.convert`
- `lead_activities.read`
- `lead_activities.create`
- `lead_activities.update`
- `notes.read`
- `notes.create`
- `notes.update`
- `notes.delete`

### Quotations

- `quotations.read`
- `quotations.create`
- `quotations.update`
- `quotations.send`
- `quotations.approve`
- `quotations.reject`
- `quotations.duplicate`
- `quotations.export_pdf`
- `quotations.convert`

### Invoices / Billing

- `invoices.read`
- `invoices.create`
- `invoices.update`
- `invoices.issue`
- `invoices.void`
- `invoices.export_pdf`
- `payments.read`
- `payments.record`
- `payments.allocate`
- `payments.update`
- `expenses.read`
- `expenses.create`
- `expenses.update`
- `expenses.approve`
- `expenses.pay`

### Logistics

- `delivery_notes.read`
- `delivery_notes.create`
- `delivery_notes.update`
- `delivery_notes.change_status`
- `delivery_notes.export_pdf`
- `vehicles.read`
- `vehicles.create`
- `vehicles.update`

### Projects / Operations

- `projects.read`
- `projects.create`
- `projects.update`
- `projects.change_status`
- `projects.assign`
- `project_stages.manage`
- `project_tasks.manage`
- `project_measurements.manage`
- `project_files.manage`

### Documents / Files

- `files.read`
- `files.upload`
- `files.link`
- `files.delete`

### Catalog / Master Data

- `catalog.read`
- `catalog.create`
- `catalog.update`
- `catalog.archive`

### Administration / Security

- `users.read`
- `users.create`
- `users.update`
- `users.suspend`
- `roles.read`
- `roles.create`
- `roles.update`
- `permissions.read`
- `settings.read`
- `settings.update`
- `numbering_sequences.read`
- `numbering_sequences.update`
- `sessions.read`
- `sessions.revoke`

## Permission Matrix

Legend:

- `Y`: allowed
- `R`: read-only or limited to read/list access
- `L`: limited by branch or assignment scope
- `-`: not granted by default

| Permission | Super Admin | Manager | Accountant | Sales | Workshop Manager | Logistics / Delivery | Employee / Viewer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `dashboard.read` | Y | Y | Y | Y | Y | Y | Y |
| `reports.read` | Y | Y | Y | L | L | L | R |
| `reports.export` | Y | Y | Y | - | - | - | - |
| `activity_logs.read` | Y | Y | L | - | - | - | - |
| `audit_logs.read` | Y | Y | - | - | - | - | - |
| `clients.read` | Y | Y | Y | Y | L | L | R |
| `clients.create` | Y | Y | - | Y | - | - | - |
| `clients.update` | Y | Y | - | Y | - | - | - |
| `clients.archive` | Y | Y | - | - | - | - | - |
| `client_contacts.read` | Y | Y | Y | Y | L | L | R |
| `client_contacts.create` | Y | Y | - | Y | - | - | - |
| `client_contacts.update` | Y | Y | - | Y | - | - | - |
| `client_contacts.delete` | Y | Y | - | - | - | - | - |
| `leads.read` | Y | Y | L | Y | - | - | R |
| `leads.create` | Y | Y | - | Y | - | - | - |
| `leads.update` | Y | Y | - | Y | - | - | - |
| `leads.archive` | Y | Y | - | Y | - | - | - |
| `leads.convert` | Y | Y | - | Y | - | - | - |
| `lead_activities.read` | Y | Y | L | Y | - | - | R |
| `lead_activities.create` | Y | Y | - | Y | - | - | - |
| `lead_activities.update` | Y | Y | - | Y | - | - | - |
| `notes.read` | Y | Y | Y | Y | L | L | R |
| `notes.create` | Y | Y | Y | Y | L | L | - |
| `notes.update` | Y | Y | Y | Y | L | L | - |
| `notes.delete` | Y | Y | - | - | - | - | - |
| `quotations.read` | Y | Y | Y | Y | L | L | R |
| `quotations.create` | Y | Y | - | Y | - | - | - |
| `quotations.update` | Y | Y | - | Y | - | - | - |
| `quotations.send` | Y | Y | - | Y | - | - | - |
| `quotations.approve` | Y | Y | - | - | - | - | - |
| `quotations.reject` | Y | Y | - | Y | - | - | - |
| `quotations.duplicate` | Y | Y | - | Y | - | - | - |
| `quotations.export_pdf` | Y | Y | Y | Y | L | L | R |
| `quotations.convert` | Y | Y | - | Y | - | - | - |
| `invoices.read` | Y | Y | Y | L | L | L | R |
| `invoices.create` | Y | Y | Y | L | - | - | - |
| `invoices.update` | Y | Y | Y | - | - | - | - |
| `invoices.issue` | Y | Y | Y | - | - | - | - |
| `invoices.void` | Y | Y | Y | - | - | - | - |
| `invoices.export_pdf` | Y | Y | Y | L | L | L | R |
| `payments.read` | Y | Y | Y | L | - | - | R |
| `payments.record` | Y | Y | Y | - | - | - | - |
| `payments.allocate` | Y | Y | Y | - | - | - | - |
| `payments.update` | Y | Y | Y | - | - | - | - |
| `expenses.read` | Y | Y | Y | - | L | - | R |
| `expenses.create` | Y | Y | Y | - | L | - | - |
| `expenses.update` | Y | Y | Y | - | L | - | - |
| `expenses.approve` | Y | Y | Y | - | - | - | - |
| `expenses.pay` | Y | Y | Y | - | - | - | - |
| `delivery_notes.read` | Y | Y | L | L | Y | Y | R |
| `delivery_notes.create` | Y | Y | - | - | Y | Y | - |
| `delivery_notes.update` | Y | Y | - | - | Y | Y | - |
| `delivery_notes.change_status` | Y | Y | - | - | Y | Y | - |
| `delivery_notes.export_pdf` | Y | Y | - | - | Y | Y | R |
| `vehicles.read` | Y | Y | - | - | L | Y | R |
| `vehicles.create` | Y | Y | - | - | - | Y | - |
| `vehicles.update` | Y | Y | - | - | - | Y | - |
| `projects.read` | Y | Y | Y | L | Y | Y | R |
| `projects.create` | Y | Y | - | L | Y | - | - |
| `projects.update` | Y | Y | - | - | Y | L | - |
| `projects.change_status` | Y | Y | - | - | Y | Y | - |
| `projects.assign` | Y | Y | - | - | Y | - | - |
| `project_stages.manage` | Y | Y | - | - | Y | - | - |
| `project_tasks.manage` | Y | Y | - | - | Y | L | - |
| `project_measurements.manage` | Y | Y | - | - | Y | L | - |
| `project_files.manage` | Y | Y | - | - | Y | Y | - |
| `files.read` | Y | Y | Y | Y | Y | Y | R |
| `files.upload` | Y | Y | Y | Y | Y | Y | - |
| `files.link` | Y | Y | Y | Y | Y | Y | - |
| `files.delete` | Y | Y | - | - | - | - | - |
| `catalog.read` | Y | Y | Y | Y | Y | L | R |
| `catalog.create` | Y | Y | - | Y | Y | - | - |
| `catalog.update` | Y | Y | - | Y | Y | - | - |
| `catalog.archive` | Y | Y | - | - | Y | - | - |
| `users.read` | Y | Y | - | - | - | - | - |
| `users.create` | Y | Y | - | - | - | - | - |
| `users.update` | Y | Y | - | - | - | - | - |
| `users.suspend` | Y | Y | - | - | - | - | - |
| `roles.read` | Y | Y | - | - | - | - | - |
| `roles.create` | Y | - | - | - | - | - | - |
| `roles.update` | Y | - | - | - | - | - | - |
| `permissions.read` | Y | Y | - | - | - | - | - |
| `settings.read` | Y | Y | - | - | - | - | - |
| `settings.update` | Y | - | - | - | - | - | - |
| `numbering_sequences.read` | Y | Y | Y | - | - | - | - |
| `numbering_sequences.update` | Y | - | Y | - | - | - | - |
| `sessions.read` | Y | Y | - | - | - | - | - |
| `sessions.revoke` | Y | Y | - | - | - | - | - |

## Role Intent

### Super Admin

- Full tenant administration
- Can manage security, settings, numbering, and all business modules

### Manager

- Cross-module operational control
- Can approve quotations, supervise projects, and monitor financial flow
- Cannot alter core security role design by default

### Accountant

- Owns invoices, payments, allocations, expenses, and financial exports
- Reads projects and clients for financial context

### Sales

- Owns leads, clients, contacts, notes, quotations, and lead conversion
- Limited invoice/payment visibility for collection follow-up

### Workshop Manager

- Owns projects, stages, tasks, measurements, and operational files
- Can create and manage delivery documents related to execution

### Logistics / Delivery

- Focused on delivery notes, delivery status, transport assets, and related files
- Reads project and client context necessary for dispatch and proof of delivery

### Employee / Viewer

- Read-only or assigned-only operational visibility
- No financial, security, or master-data administration permissions

## Seed Strategy

### 1. Seed Permissions Per Tenant

Because the current schema stores `permissions` and `roles` with `tenantId`, seed the full permission catalog for each tenant during tenant bootstrap.

Approach:

- Upsert every permission by `(tenantId, code)`
- Never delete permission rows in seeds
- New releases may add permissions, but should not rename codes casually

### 2. Seed Default Roles Per Tenant

Create default roles for each tenant:

- `super_admin`
- `manager`
- `accountant`
- `sales`
- `workshop_manager`
- `logistics_delivery`
- `employee_viewer`

Upsert roles by `(tenantId, code)`.

### 3. Seed Role-Permission Mappings

After permissions and roles exist:

- resolve role IDs
- resolve permission IDs
- upsert rows in `role_permissions`
- remove obsolete mappings only if you explicitly want strict sync behavior

Recommended default:

- additive sync for permissions
- explicit cleanup only during controlled migration scripts

### 4. Assign First User

During tenant creation:

- create the first internal user
- assign the `super_admin` role
- optionally assign branch access defaults

### 5. Enforce Scope Separately

Role seeds should not encode branch assignment directly in permission codes.

Instead:

- permissions answer “what can this role do?”
- user profile and assignment data answer “on which records can they do it?”

Examples:

- Sales user with `clients.read` still only sees allowed branches
- Employee with `project_tasks.manage` may still be limited to assigned projects

### 6. Version the Seed Manifest

Keep the permission catalog in code and treat it as a versioned manifest:

- add new permissions in new releases
- avoid destructive renames
- if a rename is unavoidable, ship a migration that copies old mappings to the new code

### 7. Recommended Boot Sequence

1. Create tenant
2. Seed permissions
3. Seed roles
4. Seed role-permission mappings
5. Create first branch if needed
6. Create first super admin user
7. Assign `super_admin`

## Implementation Notes

- API guards should check both permission code and scope
- UI navigation should be filtered by permission, but server-side enforcement remains authoritative
- Approval permissions such as `quotations.approve` should be isolated from create/update permissions
- Financial permissions should be kept separate from operational ones to reduce accidental privilege creep
