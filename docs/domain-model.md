# Domain Model

## Core Entities

### Organizational

- `Tenant`: logical company workspace for SaaS isolation
- `Branch`: physical or operational branch of the tenant
- `User`: internal authenticated actor
- `Role`: named role template
- `Permission`: fine-grained access grant
- `UserRole`: assignment table between users and roles
- `RolePermission`: assignment table between roles and permissions

### CRM

- `Lead`: unconverted prospect with origin, status, budget, and notes
- `Client`: customer organization or individual
- `ContactPerson`: client-side contacts for commercial and project communication

### Catalog

- `CatalogItem`: product or service template used in quotations and invoices

### Sales

- `Quotation`: commercial proposal with dates, totals, status, and client linkage
- `QuotationLine`: line-level pricing snapshot
- `Invoice`: billable financial document
- `InvoiceLine`: invoice pricing snapshot
- `DeliveryNote`: transport and installation handoff document
- `DeliveryNoteLine`: delivered items or service milestones
- `Payment`: received amount, method, and allocation

### Operations

- `Project`: chantier or fabrication project created from sales approval
- `ProjectStatusEvent`: status history for execution follow-up

### Finance

- `Expense`: cash outflow linked optionally to a project

### Documents

- `Document`: metadata record for files and photos stored in object storage

## Relationship Summary

- A tenant owns branches, users, roles, leads, clients, catalog items, documents, and all transactional records.
- A branch scopes operational ownership for clients, projects, invoices, expenses, and users where needed.
- A lead can be converted into a client.
- A client can have multiple contact persons, quotations, invoices, payments, projects, delivery notes, and documents.
- A quotation belongs to one client and can generate one or more projects and invoices.
- A project may be linked to an approved quotation and groups expenses, delivery notes, payments, and documents.
- Payments can be allocated to invoices and optionally linked back to projects.
- Documents can attach to leads, clients, quotations, projects, invoices, delivery notes, or expenses.

## Role Model

### Recommended Roles

- `Super Admin`: full tenant setup and platform-level control
- `Director`: management visibility across all modules
- `Sales Manager`: leads, clients, quotations, revenue follow-up
- `Project Manager`: project execution, documents, delivery notes, planning
- `Accountant`: invoices, payments, expenses, receivables
- `Operator`: limited operational data entry
- `Viewer`: read-only oversight

### Permission Families

- `crm.*`
- `sales.quotations.*`
- `sales.invoices.*`
- `sales.delivery_notes.*`
- `finance.payments.*`
- `finance.expenses.*`
- `projects.*`
- `documents.*`
- `catalog.*`
- `users.*`
- `roles.*`
- `reports.*`
- `settings.*`

## Data Design Notes

- All transactional documents carry denormalized line snapshots so historical pricing remains intact even if catalog values change later.
- Status history is stored explicitly for auditability and reporting.
- Currency is modeled at document level to support future multi-currency scenarios.
- Branch references are optional on some tables to allow single-branch operation without friction.
- Generic document ownership is resolved through multiple optional foreign keys to retain referential integrity at the SQL layer.

