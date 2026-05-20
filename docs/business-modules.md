# Business Modules

This document defines the first production-grade behavior for the ERP/CRM modules. Each module includes:

- pages and screens
- forms
- filters
- actions
- validations
- workflow rules

The design assumes:

- tenant-scoped access
- branch-aware filtering where relevant
- role-based permissions
- soft deletes for important records
- document numbering from `numbering_sequences`
- append-only status history for important business documents

## A. Dashboard

### Pages / Screens

- `Dashboard / Overview`
- `Revenue Summary`
- `Unpaid Invoices`
- `Quotation Funnel`
- `Project Pipeline`
- `Recent Activities`
- `Monthly Performance`
- `Alerts / Reminders Center`

### Forms

- Date range selector
- Branch selector
- KPI comparison period selector
- Reminder dismiss / snooze form

### Filters

- Date range
- Branch
- Sales owner
- Project manager
- Status
- Overdue only
- High priority only

### Actions

- Open linked client / invoice / quotation / project
- Mark reminder as done
- Snooze reminder
- Export dashboard snapshot
- Switch period: month / quarter / year

### Validations

- Date range end must be after start
- Comparison period must be compatible with main period
- Branch filter must respect user branch scope

### Workflow Rules

- KPIs should be computed from live transactions, not cached manual values
- Revenue summary should separate issued revenue, paid revenue, and outstanding revenue
- Unpaid invoices should prioritize overdue then soon-due records
- Quotation funnel should count and value documents by status
- Project pipeline should group projects by status and stage progress
- Recent activities should aggregate meaningful operational and commercial actions, not low-value system noise
- Alerts should include overdue invoices, stale leads, delayed projects, pending approvals, and missing follow-ups

## B. Clients

### Pages / Screens

- `Clients / List`
- `Client / Create`
- `Client / Edit`
- `Client / Profile`
- `Client / Contacts`
- `Client / Notes`
- `Client / Documents`
- `Client / Linked Records`

### Forms

- Client identity form
  - `type`
  - `displayName`
  - `legalName`
  - `taxId`
  - `registrationNo`
  - `email`
  - `phone`
  - `mobile`
  - `address`
  - `city`
  - `postalCode`
- Contact form
  - `firstName`
  - `lastName`
  - `jobTitle`
  - `email`
  - `phone`
  - `isPrimary`
- Client note form
- Archive confirmation form

### Filters

- Search by name / code / tax ID / phone
- Branch
- Active vs archived
- Client type
- Has overdue invoices
- Has active projects

### Actions

- Create client
- Edit client
- Archive / restore client
- Add contact
- Set primary contact
- Add note
- Upload attachment
- Open linked quotations
- Open linked invoices
- Open linked projects

### Validations

- `displayName` required
- `type` required
- email format if provided
- unique `code` per tenant
- one primary contact per client
- archived client cannot be selected for new commercial documents unless explicitly restored

### Workflow Rules

- Client can be created directly or from lead conversion
- Client profile is the primary commercial and financial hub
- Linked records should include quotations, invoices, payments, delivery notes, and projects
- Archiving should soft delete only and must not break historical transactional references
- Primary contact should be used by default when generating outbound PDFs or communication actions later

## C. Leads / CRM

### Pages / Screens

- `Leads / List`
- `Lead / Create`
- `Lead / Edit`
- `Lead / Detail`
- `Lead / Activity Timeline`
- `Lead / Reminder Panel`
- `Lead / Convert to Client`

### Forms

- Lead capture form
  - `fullName`
  - `companyName`
  - `email`
  - `phone`
  - `source`
  - `requestedWork`
  - `estimatedBudget`
  - `city`
  - `address`
  - `assignedUser`
  - `nextFollowUpAt`
- Lead activity form
  - `type`
  - `subject`
  - `description`
  - `scheduledAt`
  - `completedAt`
- Lead status update form
- Conversion form
  - map lead fields to client fields
  - optional create first contact

### Filters

- Search by prospect / company / phone
- Lead status
- Lead source
- Assigned salesperson
- Branch
- Follow-up overdue
- Follow-up today / this week

### Actions

- Create lead
- Edit lead
- Change status
- Log call / visit / WhatsApp / note
- Schedule reminder
- Create quotation from lead
- Convert to client
- Mark as won / lost
- Archive

### Validations

- `fullName` required
- `source` required
- `status` required
- follow-up date must be in valid datetime format
- cannot convert an already converted lead
- lost reason required when setting status to `LOST`

### Workflow Rules

- Lead should move through a visible pipeline
- Follow-up ownership must always be clear
- Conversion creates a client while preserving lead history
- Lead activity timeline must remain append-only
- When a quotation is created from a lead, the lead should be linked and status may move to `QUOTATION_IN_PROGRESS`
- Won lead conversion should usually create a client if one does not already exist

## D. Quotations

### Pages / Screens

- `Quotations / List`
- `Quotation / Create`
- `Quotation / Edit Draft`
- `Quotation / Detail`
- `Quotation / PDF Preview`
- `Quotation / Status History`
- `Quotation / Duplicate`
- `Quotation / Convert`

### Forms

- Quotation header form
  - `client`
  - `lead` optional
  - `title`
  - `reference`
  - `issueDate`
  - `validUntil`
  - `currency`
  - `termsConditions`
  - `internalNotes`
  - `clientNotes`
- Quotation item form
  - add product / service / custom line
  - `itemName`
  - `description`
  - `quantity`
  - `unit`
  - `unitPrice`
  - `discountRate`
  - `taxRate`
- Totals form
  - discount amount or per-line discount
  - tax totals

### Filters

- Search by number / client / reference
- Status
- Date range
- Validity expiring soon
- Accepted only
- Draft only
- Branch
- Created by

### Actions

- Create quotation
- Edit draft
- Add custom line item
- Reorder line items
- Calculate totals
- Send / mark as sent
- Accept / reject / cancel
- Duplicate quotation
- Export PDF
- Generate project from accepted quotation
- Generate invoice from accepted quotation
- Attach files

### Validations

- `clientId` required
- at least one item required
- each item must have positive quantity
- each item must have non-negative price
- tax and discount rates cannot be negative
- `validUntil` cannot be before `issueDate`
- only `DRAFT` or allowed editable statuses may be modified
- only accepted quotations can be converted to project or invoice

### Workflow Rules

- Number must be generated transactionally from numbering sequence
- Status changes must append to `quotation_status_history`
- Accepted quotation becomes commercial baseline for a project
- Duplicate action should create a new draft with copied items and no status history
- PDF output must use current item snapshots, not live catalog prices
- Once a quotation is accepted, material price lines should remain historically frozen

## E. Invoices

### Pages / Screens

- `Invoices / List`
- `Invoice / Create Manual`
- `Invoice / Generate from Quotation`
- `Invoice / Generate from Project`
- `Invoice / Detail`
- `Invoice / Payment Tracking`
- `Invoice / PDF Preview`

### Forms

- Invoice header form
  - `client`
  - `quotation` optional
  - `project` optional
  - `issueDate`
  - `dueDate`
  - `currency`
  - `customerNotes`
  - `internalNotes`
- Invoice items form
  - select from quotation items or add manual lines
  - `itemName`
  - `quantity`
  - `unit`
  - `unitPrice`
  - `discountRate`
  - `taxRate`
- Status adjustment form

### Filters

- Search by invoice number / client
- Status
- Overdue only
- Due soon
- Partially paid
- Linked project
- Date range
- Branch

### Actions

- Create invoice manually
- Generate from quotation
- Generate from project
- Edit draft
- Issue invoice
- Record payment
- View allocation history
- Export PDF
- Send reminder later
- Cancel / void invoice

### Validations

- `clientId` required
- `issueDate` required
- at least one invoice item required
- `dueDate` should not be before `issueDate`
- paid amount cannot exceed total amount at allocation level
- issued or paid invoices should not allow unrestricted line editing
- voided invoices cannot receive new allocations

### Workflow Rules

- One invoice may reference a quotation or a project or both
- Partial payments must update `paidAmount` and `balanceDue`
- Overdue logic is driven by due date and unpaid balance
- Invoice status should be derived from payment state plus explicit lifecycle rules
- PDF output should reflect frozen invoice line snapshots
- Automatic overdue alerts should surface on dashboard and invoice list

## F. Delivery Notes / Bon de Transport

### Pages / Screens

- `Delivery Notes / List`
- `Delivery Note / Create`
- `Delivery Note / Detail`
- `Delivery Note / Print Preview`
- `Delivery Note / Status History`

### Forms

- Delivery note header form
  - `client`
  - `project`
  - `quotation`
  - `vehicle`
  - `deliveryDate`
  - `receiverName`
  - `receiverPhone`
  - `siteAddress`
  - `internalNotes`
- Delivery note items form
  - select quotation items or add manual delivery lines
  - `itemName`
  - `description`
  - `quantity`
  - `unit`

### Filters

- Search by number / client / project
- Delivery status
- Date range
- Vehicle
- Branch
- Linked project only

### Actions

- Create delivery note
- Add item list
- Assign vehicle
- Print / export PDF
- Mark prepared / in transit / delivered / returned / cancelled
- Attach proof documents or signed receipt

### Validations

- `clientId` required
- `deliveryDate` required
- at least one item required
- delivered quantity must be positive
- linked project must belong to same client
- cancelled delivery note cannot move to delivered

### Workflow Rules

- Delivery note can be linked to project and quotation
- Status changes must append to `delivery_status_history`
- Delivery note numbering must be unique and sequence-driven
- Printable output should show destination, responsible person, line items, and signature area
- Proof files should attach through document links

## G. Projects / Chantiers

### Pages / Screens

- `Projects / List`
- `Project / Create`
- `Project / Overview`
- `Project / Stages`
- `Project / Tasks`
- `Project / Measurements`
- `Project / Team`
- `Project / Timeline`
- `Project / Files`
- `Project / Financial Summary`

### Forms

- Project header form
  - `client`
  - `quotation`
  - `code`
  - `name`
  - `description`
  - `siteAddress`
  - `city`
  - `projectManager`
  - `plannedStartAt`
  - `targetDeliveryDate`
  - `targetInstallDate`
  - `budgetAmount`
- Project stage form
  - `code`
  - `name`
  - `sortOrder`
  - `status`
  - dates
  - progress
- Project task form
  - `title`
  - `description`
  - `stage`
  - `assignedTo`
  - `priority`
  - `dueDate`
- Project assignment form
  - `user`
  - `role`
- Measurement form
  - `measurementType`
  - `label`
  - dimensions
  - `unit`
  - `measuredAt`
- File attach form

### Filters

- Search by project code / title / client
- Project status
- Stage status
- Project manager
- Assigned team member
- Delayed projects
- Delivery/install date range
- Branch

### Actions

- Create project manually
- Create project from accepted quotation
- Change project status
- Manage stages
- Manage tasks
- Assign team members
- Record measurements
- Upload plans/images/documents
- View related invoices, payments, delivery notes, expenses
- Mark project completed / on hold

### Validations

- `clientId` required
- `name` required
- if quotation is linked, quotation client must match project client
- stage sort order must be unique within project
- task due date should not be before project planned start unless intentionally allowed
- progress percent must be between 0 and 100
- completed project must have completion date

### Workflow Rules

- Project may be created from an accepted quotation or manually
- One project belongs to one client
- Project status history must be append-only
- Project progress should aggregate from stages or be explicitly controlled by managers
- Files and measurements are operational records and must remain linked to the project
- Team assignment should be role-based, not just a free-text list
- Installation and fabrication tracking should be visible separately through stages/tasks

## H. Payments

### Pages / Screens

- `Payments / List`
- `Payment / Record`
- `Payment / Detail`
- `Payment / Allocation`
- `Payment / History`

### Forms

- Payment form
  - `client`
  - `project` optional
  - `method`
  - `paymentDate`
  - `amount`
  - `reference`
  - `status`
  - `internalNotes`
- Allocation form
  - choose one or many invoices
  - allocation amount per invoice

### Filters

- Search by payment reference / client
- Payment method
- Payment status
- Date range
- Unallocated / partially allocated / allocated
- Branch

### Actions

- Record payment
- Allocate payment to invoices
- Reallocate before reconciliation lock
- View allocation history
- Attach receipt document
- Print receipt later if implemented

### Validations

- `clientId` required
- `amount` must be positive
- `paymentDate` required
- total allocated amount cannot exceed payment amount
- allocation invoice must belong to same client unless cross-client allocations are explicitly forbidden, which they should be in V1
- cancelled or failed payment cannot receive allocations

### Workflow Rules

- Payment allocation is independent from payment recording
- One payment can settle one or several invoices
- One invoice can be paid through several payments
- Allocation updates invoice paid and balance figures
- Payment status should reflect allocation completeness and payment confirmation

## I. Expenses

### Pages / Screens

- `Expenses / List`
- `Expense / Create`
- `Expense / Detail`
- `Expense / Categories`
- `Expense / Attachments`

### Forms

- Expense form
  - `category`
  - `title`
  - `description`
  - `supplier`
  - `project` optional
  - `amount`
  - `currency`
  - `expenseDate`
  - `paymentMethod`
  - `status`
  - `reference`
- Expense category form
  - `code`
  - `name`
  - `description`

### Filters

- Search by title / supplier / reference
- Expense category
- Status
- Date range
- Linked project
- Branch

### Actions

- Create expense
- Edit draft/submitted expense
- Approve / reject expense
- Mark paid
- Attach receipt/invoice
- Open linked project

### Validations

- `expenseCategoryId` required
- `title` required
- `amount` positive
- `expenseDate` required
- linked project must belong to tenant and branch scope
- paid expense must have amount and date

### Workflow Rules

- Expenses may be linked to a project for profitability analysis later
- Approval may be role-restricted to manager/accountant/admin
- Expense documents should attach through generic document links
- Categories should be reusable master data, not free text in every record

## J. Documents

### Pages / Screens

- `Documents / Library`
- `Document / Detail`
- `Document / Attachment Panel`
- `Entity / Documents Tab`

### Forms

- Upload form
  - file
  - label
  - visibility
  - entity link target
- Metadata form
  - description
  - category / type
  - primary flag

### Filters

- Search by file name / label
- File type
- Visibility
- Linked entity type
- Uploaded by
- Date range

### Actions

- Upload file
- Preview metadata
- Attach file to entity
- Mark primary attachment
- Soft delete link
- Replace file through new version upload

### Validations

- file required on upload
- allowed mime types and max size enforced
- one entity should have at most one primary attachment per business purpose where needed
- link target must exist and belong to same tenant

### Workflow Rules

- File storage and attachment links are separate
- New version should generally create a new file row and preserve the old one for traceability
- `document_links` handle polymorphic attachment without duplicating files
- Sensitive files may later be access-restricted by visibility and permissions

## K. Users / Roles

### Suggested Roles

- `Admin`
- `Manager`
- `Accountant`
- `Sales`
- `Workshop Manager`
- `Delivery / Logistics`
- `Technician`
- `View Only`

### Pages / Screens

- `Users / List`
- `User / Create or Invite`
- `User / Detail`
- `Roles / List`
- `Role / Detail`
- `Permissions Matrix`
- `Sessions / Refresh Tokens`

### Forms

- User form
  - `firstName`
  - `lastName`
  - `email`
  - `phone`
  - `branch`
  - `status`
- Role assignment form
  - select one or more roles
- Role form
  - `name`
  - `code`
  - permission groups

### Filters

- Search by name / email
- Status
- Branch
- Role
- Active vs archived

### Actions

- Create / invite user
- Assign roles
- Suspend / reactivate user
- Revoke refresh tokens
- Create custom role
- Edit permission matrix

### Validations

- unique email per tenant
- valid role codes
- cannot remove last admin without explicit higher-level safeguard
- suspended users cannot authenticate
- branch restrictions must be compatible with selected role

### Workflow Rules

- Admin manages users, roles, permissions, numbering settings, and master configuration
- Manager has broad operational access
- Accountant owns invoicing, payments, and expenses
- Sales owns leads, clients, and quotations
- Workshop Manager owns fabrication/project execution views
- Delivery/Logistics owns delivery notes and transport status
- Technician operates in restricted project/task/measurement views
- View Only can access read-only dashboards and permitted records

## Cross-Module Rules

### Global Filters

- Every list screen should support:
  - search
  - status
  - branch
  - date range where relevant
  - archived toggle where soft delete applies

### Global Actions

- export list
- open linked records
- view activity trail
- attach notes/files from entity detail pages

### Global Validations

- all linked entities must belong to same tenant
- branch-scoped users cannot create records outside authorized branches
- document numbering must be generated server-side, never client-side

### Global Workflow Rules

- status history tables are append-only
- soft-deleted records remain queryable to admins with explicit archived filters
- document line items are stored as snapshots to preserve history
- reminders should surface both in dedicated CRM/project screens and in the dashboard alerts area
