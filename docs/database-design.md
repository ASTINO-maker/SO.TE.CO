# Database Design

## Overview

This schema is designed for:

- PostgreSQL
- Prisma-managed migrations
- tenant-scoped data isolation
- branch-aware operations
- soft deletes on important master and transactional records
- immutable history tables for auditability
- partial payment allocation
- document numbering through dedicated numbering sequences

All major transactional records include `createdAt`, `updatedAt`, and `deletedAt` where soft deletion matters.

## Enum Strategy

- `UserStatus`: `ACTIVE`, `INVITED`, `SUSPENDED`, `DISABLED`
- `LeadStatus`: `NEW`, `CONTACTED`, `QUALIFIED`, `SITE_VISIT_SCHEDULED`, `QUOTATION_IN_PROGRESS`, `QUOTED`, `WON`, `LOST`, `ARCHIVED`
- `QuotationStatus`: `DRAFT`, `SENT`, `UNDER_REVIEW`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `CANCELLED`
- `InvoiceStatus`: `DRAFT`, `ISSUED`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `VOID`, `CANCELLED`
- `PaymentStatus`: `PENDING`, `CONFIRMED`, `PARTIALLY_ALLOCATED`, `ALLOCATED`, `FAILED`, `REFUNDED`, `CANCELLED`
- `DeliveryStatus`: `DRAFT`, `PREPARED`, `IN_TRANSIT`, `DELIVERED`, `PARTIALLY_DELIVERED`, `RETURNED`, `CANCELLED`
- `ProjectStatus`: `DRAFT`, `PLANNED`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`, `CANCELLED`
- `ProjectStageStatus`: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `DONE`, `CANCELLED`

Supporting enums also cover payment method, task status, task priority, supplier status, purchase order status, inventory movement type, file kind, file visibility, and activity/audit typing.

## Table Design

### Auth / Users

#### `users`

- PK: `id`
- Important columns: `tenantId`, `branchId`, `email`, `passwordHash`, `status`, `lastLoginAt`
- FKs: `tenantId -> tenants.id`, `branchId -> branches.id`
- Indexes: unique `(tenantId, email)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

#### `roles`

- PK: `id`
- Important columns: `tenantId`, `code`, `name`, `isSystemRole`
- FKs: `tenantId -> tenants.id`
- Indexes: unique `(tenantId, code)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

#### `permissions`

- PK: `id`
- Important columns: `tenantId`, `code`, `label`
- FKs: `tenantId -> tenants.id`
- Indexes: unique `(tenantId, code)`
- Timestamps: `createdAt`
- Soft delete: none

#### `role_permissions`

- PK: composite `(roleId, permissionId)`
- Important columns: `roleId`, `permissionId`, `grantedAt`
- FKs: `roleId -> roles.id`, `permissionId -> permissions.id`
- Indexes: composite PK
- Timestamps: `grantedAt`
- Soft delete: none

#### `user_roles`

- PK: composite `(userId, roleId)`
- Important columns: `userId`, `roleId`, `assignedAt`
- FKs: `userId -> users.id`, `roleId -> roles.id`
- Indexes: composite PK
- Timestamps: `assignedAt`
- Soft delete: none

#### `refresh_tokens`

- PK: `id`
- Important columns: `tenantId`, `userId`, `tokenHash`, `expiresAt`, `revokedAt`, `lastUsedAt`
- FKs: `tenantId -> tenants.id`, `userId -> users.id`
- Indexes: unique `tokenHash`, `(userId, revokedAt)`
- Timestamps: `issuedAt`, `createdAt`, `updatedAt`
- Soft delete: none

#### `audit_logs`

- PK: `id`
- Important columns: `tenantId`, `branchId`, `userId`, `action`, `entityType`, `entityId`, `oldValues`, `newValues`
- FKs: `tenantId -> tenants.id`, `branchId -> branches.id`, `userId -> users.id`
- Indexes: `(tenantId, entityType, entityId)`, `(tenantId, action, createdAt)`
- Timestamps: `createdAt`
- Soft delete: none

### CRM

#### `clients`

- PK: `id`
- Important columns: `tenantId`, `branchId`, `code`, `displayName`, `type`, `taxId`, `registrationNo`, `convertedFromLeadId`
- FKs: `tenantId -> tenants.id`, `branchId -> branches.id`, `convertedFromLeadId -> leads.id`
- Indexes: unique `(tenantId, code)`, `(tenantId, displayName)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

#### `client_contacts`

- PK: `id`
- Important columns: `tenantId`, `clientId`, `firstName`, `lastName`, `jobTitle`, `isPrimary`
- FKs: `tenantId -> tenants.id`, `clientId -> clients.id`
- Indexes: `(clientId, isPrimary)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

#### `leads`

- PK: `id`
- Important columns: `tenantId`, `branchId`, `assignedUserId`, `fullName`, `companyName`, `source`, `status`, `estimatedBudget`, `nextFollowUpAt`
- FKs: `tenantId -> tenants.id`, `branchId -> branches.id`, `assignedUserId -> users.id`
- Indexes: `(tenantId, status)`, `(assignedUserId, nextFollowUpAt)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

#### `lead_activities`

- PK: `id`
- Important columns: `tenantId`, `leadId`, `userId`, `type`, `subject`, `scheduledAt`, `completedAt`
- FKs: `tenantId -> tenants.id`, `leadId -> leads.id`, `userId -> users.id`
- Indexes: `(leadId, createdAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: none

#### `notes`

- PK: `id`
- Important columns: `tenantId`, `userId`, `body`, `visibility`
- FKs: optional links to `clients`, `leads`, `quotations`, `invoices`, `delivery_notes`, `projects`, `payments`, `expenses`
- Indexes: `(tenantId, deletedAt)`, `(projectId, createdAt)`, `(clientId, createdAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

### Commercial

#### `quotations`

- PK: `id`
- Important columns: `tenantId`, `branchId`, `clientId`, `leadId`, `numberingSequenceId`, `number`, `status`, `issueDate`, `validUntil`, monetary totals
- FKs: `tenantId -> tenants.id`, `branchId -> branches.id`, `clientId -> clients.id`, `leadId -> leads.id`, `numberingSequenceId -> numbering_sequences.id`, `createdByUserId -> users.id`
- Indexes: unique `(tenantId, number)`, `(tenantId, status)`, `(clientId, issueDate)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

#### `quotation_items`

- PK: `id`
- Important columns: `tenantId`, `quotationId`, `sortOrder`, `productId`, `serviceId`, `unitId`, `itemName`, `quantity`, `unitPrice`, `taxRate`, `lineTotal`
- FKs: `tenantId -> tenants.id`, `quotationId -> quotations.id`, optional `categoryId -> categories.id`, `unitId -> units.id`, `productId -> products.id`, `serviceId -> services.id`
- Indexes: `(quotationId, sortOrder)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: none

#### `quotation_status_history`

- PK: `id`
- Important columns: `tenantId`, `quotationId`, `fromStatus`, `toStatus`, `changedByUserId`
- FKs: `tenantId -> tenants.id`, `quotationId -> quotations.id`, `changedByUserId -> users.id`
- Indexes: `(quotationId, changedAt)`
- Timestamps: `changedAt`
- Soft delete: none

### Billing

#### `invoices`

- PK: `id`
- Important columns: `tenantId`, `branchId`, `clientId`, `quotationId`, `projectId`, `number`, `status`, `issueDate`, `dueDate`, `paidAmount`, `balanceDue`
- FKs: `tenantId -> tenants.id`, `branchId -> branches.id`, `clientId -> clients.id`, `quotationId -> quotations.id`, `projectId -> projects.id`, `numberingSequenceId -> numbering_sequences.id`, `createdByUserId -> users.id`
- Indexes: unique `(tenantId, number)`, `(tenantId, status)`, `(clientId, dueDate)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

#### `invoice_items`

- PK: `id`
- Important columns: `tenantId`, `invoiceId`, `sortOrder`, `productId`, `serviceId`, `unitId`, `itemName`, `quantity`, `unitPrice`, `lineTotal`
- FKs: `tenantId -> tenants.id`, `invoiceId -> invoices.id`, optional links to `categories`, `units`, `products`, `services`
- Indexes: `(invoiceId, sortOrder)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: none

#### `payments`

- PK: `id`
- Important columns: `tenantId`, `branchId`, `clientId`, `projectId`, `number`, `status`, `method`, `paymentDate`, `amount`
- FKs: `tenantId -> tenants.id`, `branchId -> branches.id`, `clientId -> clients.id`, `projectId -> projects.id`, `receivedByUserId -> users.id`
- Indexes: unique `(tenantId, number)`, `(tenantId, paymentDate)`, `(clientId, paymentDate)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

#### `payment_allocations`

- PK: `id`
- Important columns: `tenantId`, `paymentId`, `invoiceId`, `amount`, `allocatedByUserId`
- FKs: `tenantId -> tenants.id`, `paymentId -> payments.id`, `invoiceId -> invoices.id`, `allocatedByUserId -> users.id`
- Indexes: unique `(paymentId, invoiceId)`, `(invoiceId, createdAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: none

This table is what makes partial payments production-safe: one payment can be split across many invoices, and one invoice can receive many partial allocations over time.

#### `expense_categories`

- PK: `id`
- Important columns: `tenantId`, `code`, `name`, `isActive`
- FKs: `tenantId -> tenants.id`
- Indexes: unique `(tenantId, code)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

#### `expenses`

- PK: `id`
- Important columns: `tenantId`, `branchId`, `projectId`, `expenseCategoryId`, `supplierId`, `title`, `amount`, `expenseDate`, `status`
- FKs: `tenantId -> tenants.id`, `branchId -> branches.id`, `projectId -> projects.id`, `expenseCategoryId -> expense_categories.id`, `supplierId -> suppliers.id`, `createdByUserId -> users.id`, `approvedByUserId -> users.id`
- Indexes: `(tenantId, expenseDate)`, `(projectId, expenseDate)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

### Logistics

#### `delivery_notes`

- PK: `id`
- Important columns: `tenantId`, `branchId`, `clientId`, `projectId`, `quotationId`, `vehicleId`, `number`, `status`, `deliveryDate`
- FKs: `tenantId -> tenants.id`, `branchId -> branches.id`, `clientId -> clients.id`, `projectId -> projects.id`, `quotationId -> quotations.id`, `vehicleId -> vehicles.id`, `numberingSequenceId -> numbering_sequences.id`, `createdByUserId -> users.id`
- Indexes: unique `(tenantId, number)`, `(tenantId, status)`, `(projectId, deliveryDate)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

#### `delivery_note_items`

- PK: `id`
- Important columns: `tenantId`, `deliveryNoteId`, `sortOrder`, `quotationItemId`, `productId`, `serviceId`, `quantity`
- FKs: `tenantId -> tenants.id`, `deliveryNoteId -> delivery_notes.id`, optional links to `quotation_items`, `categories`, `units`, `products`, `services`
- Indexes: `(deliveryNoteId, sortOrder)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: none

#### `vehicles`

- PK: `id`
- Important columns: `tenantId`, `branchId`, `code`, `licensePlate`, `make`, `model`
- FKs: `tenantId -> tenants.id`, `branchId -> branches.id`
- Indexes: unique `(tenantId, code)`, unique `(tenantId, licensePlate)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

#### `delivery_status_history`

- PK: `id`
- Important columns: `tenantId`, `deliveryNoteId`, `fromStatus`, `toStatus`, `changedByUserId`
- FKs: `tenantId -> tenants.id`, `deliveryNoteId -> delivery_notes.id`, `changedByUserId -> users.id`
- Indexes: `(deliveryNoteId, changedAt)`
- Timestamps: `changedAt`
- Soft delete: none

### Projects

#### `projects`

- PK: `id`
- Important columns: `tenantId`, `branchId`, `clientId`, `quotationId`, `code`, `name`, `status`, planned and actual milestone dates, `budgetAmount`, `billedAmount`, `paidAmount`, `progressPercent`
- FKs: `tenantId -> tenants.id`, `branchId -> branches.id`, `clientId -> clients.id`, `quotationId -> quotations.id`, `numberingSequenceId -> numbering_sequences.id`, `projectManagerId -> users.id`, `createdByUserId -> users.id`
- Indexes: unique `(tenantId, code)`, `(tenantId, status)`, `(clientId, status)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

This enforces the core rule that one project belongs to one client, while still allowing an optional accepted quotation link.

#### `project_stages`

- PK: `id`
- Important columns: `tenantId`, `projectId`, `code`, `name`, `sortOrder`, `status`, progress and milestone dates
- FKs: `tenantId -> tenants.id`, `projectId -> projects.id`
- Indexes: unique `(projectId, code)`, `(projectId, sortOrder)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

#### `project_status_history`

- PK: `id`
- Important columns: `tenantId`, `projectId`, `fromStatus`, `toStatus`, `changedByUserId`
- FKs: `tenantId -> tenants.id`, `projectId -> projects.id`, `changedByUserId -> users.id`
- Indexes: `(projectId, changedAt)`
- Timestamps: `changedAt`
- Soft delete: none

#### `project_tasks`

- PK: `id`
- Important columns: `tenantId`, `projectId`, `stageId`, `assignedToUserId`, `title`, `status`, `priority`, `dueDate`
- FKs: `tenantId -> tenants.id`, `projectId -> projects.id`, `stageId -> project_stages.id`, `assignedToUserId -> users.id`, `createdByUserId -> users.id`
- Indexes: `(projectId, status)`, `(assignedToUserId, dueDate)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

#### `project_assignments`

- PK: `id`
- Important columns: `tenantId`, `projectId`, `userId`, `role`, `assignedAt`, `removedAt`
- FKs: `tenantId -> tenants.id`, `projectId -> projects.id`, `userId -> users.id`
- Indexes: unique `(projectId, userId, role)`, `(tenantId, projectId)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: logical via `removedAt`

#### `project_files`

- PK: `id`
- Important columns: `tenantId`, `projectId`, `fileId`, `uploadedByUserId`, `category`
- FKs: `tenantId -> tenants.id`, `projectId -> projects.id`, `fileId -> files.id`, `uploadedByUserId -> users.id`
- Indexes: unique `(projectId, fileId)`, `(tenantId, projectId)`
- Timestamps: `createdAt`
- Soft delete: none

#### `project_measurements`

- PK: `id`
- Important columns: `tenantId`, `projectId`, `measurementType`, `label`, dimensional columns, `measuredAt`
- FKs: `tenantId -> tenants.id`, `projectId -> projects.id`, `unitId -> units.id`, `capturedByUserId -> users.id`
- Indexes: `(projectId, measuredAt)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

### Catalog

#### `categories`

- PK: `id`
- Important columns: `tenantId`, `parentId`, `code`, `name`, `kind`
- FKs: `tenantId -> tenants.id`, `parentId -> categories.id`
- Indexes: unique `(tenantId, code)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

#### `units`

- PK: `id`
- Important columns: `tenantId`, `code`, `name`, `symbol`, `unitType`, `precision`
- FKs: `tenantId -> tenants.id`
- Indexes: unique `(tenantId, code)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

#### `products`

- PK: `id`
- Important columns: `tenantId`, `categoryId`, `unitId`, `code`, `sku`, `name`, `basePrice`, `costPrice`, `vatRate`
- FKs: `tenantId -> tenants.id`, `categoryId -> categories.id`, `unitId -> units.id`
- Indexes: unique `(tenantId, code)`, `(tenantId, name)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

#### `services`

- PK: `id`
- Important columns: `tenantId`, `categoryId`, `unitId`, `code`, `name`, `basePrice`, `costRate`, `vatRate`
- FKs: `tenantId -> tenants.id`, `categoryId -> categories.id`, `unitId -> units.id`
- Indexes: unique `(tenantId, code)`, `(tenantId, name)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

### Documents

#### `files`

- PK: `id`
- Important columns: `tenantId`, `uploadedByUserId`, `objectKey`, `storageDriver`, `mimeType`, `byteSize`, `fileKind`, `visibility`
- FKs: `tenantId -> tenants.id`, `uploadedByUserId -> users.id`
- Indexes: `(tenantId, fileKind)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

#### `document_links`

- PK: `id`
- Important columns: `tenantId`, `fileId`, `label`, `isPrimary`
- FKs: `tenantId -> tenants.id`, `fileId -> files.id`, `createdByUserId -> users.id`, optional links to `clients`, `leads`, `quotations`, `invoices`, `delivery_notes`, `projects`, `payments`, `expenses`, `notes`
- Indexes: `(tenantId, deletedAt)`, plus entity-oriented indexes on `clientId`, `projectId`, `quotationId`, `invoiceId`, `deliveryNoteId`
- Timestamps: `createdAt`
- Soft delete: `deletedAt`

This is the generic attachment table that lets the same file model be reused across clients, quotations, invoices, delivery notes, and projects.

### System

#### `settings`

- PK: `id`
- Important columns: `tenantId`, `branchId`, `scopeKey`, `key`, `value`, `isSecret`
- FKs: `tenantId -> tenants.id`, `branchId -> branches.id`
- Indexes: unique `(tenantId, scopeKey, key)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

#### `numbering_sequences`

- PK: `id`
- Important columns: `tenantId`, `branchId`, `scopeKey`, `documentType`, `prefix`, `suffix`, `separator`, `currentValue`, `padding`, `fiscalYear`
- FKs: `tenantId -> tenants.id`, `branchId -> branches.id`
- Indexes: unique `(tenantId, scopeKey, documentType, fiscalYear)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

This table is the numbering backbone for quotations, invoices, delivery notes, and future purchase orders.

#### `activity_logs`

- PK: `id`
- Important columns: `tenantId`, `branchId`, `userId`, `type`, `message`, `entityType`, `entityId`
- FKs: `tenantId -> tenants.id`, `branchId -> branches.id`, `userId -> users.id`
- Indexes: `(tenantId, type, createdAt)`, `(tenantId, entityType, entityId)`
- Timestamps: `createdAt`
- Soft delete: none

### Future-Ready Tables

#### `suppliers`

- PK: `id`
- Important columns: `tenantId`, `branchId`, `code`, `name`, `taxId`, `status`
- FKs: `tenantId -> tenants.id`, `branchId -> branches.id`
- Indexes: unique `(tenantId, code)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

#### `purchase_orders`

- PK: `id`
- Important columns: `tenantId`, `branchId`, `warehouseId`, `supplierId`, `number`, `status`, `orderDate`, totals
- FKs: `tenantId -> tenants.id`, `branchId -> branches.id`, `warehouseId -> warehouses.id`, `supplierId -> suppliers.id`, `numberingSequenceId -> numbering_sequences.id`, `createdByUserId -> users.id`
- Indexes: unique `(tenantId, number)`, `(tenantId, status)`, `(supplierId, orderDate)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

#### `purchase_order_items`

- PK: `id`
- Important columns: `tenantId`, `purchaseOrderId`, `sortOrder`, `productId`, `serviceId`, `inventoryItemId`, `quantity`, `receivedQuantity`, `unitPrice`
- FKs: `tenantId -> tenants.id`, `purchaseOrderId -> purchase_orders.id`, optional links to `products`, `services`, `units`, `inventory_items`
- Indexes: `(purchaseOrderId, sortOrder)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: none

#### `inventory_items`

- PK: `id`
- Important columns: `tenantId`, `warehouseId`, `productId`, `code`, `quantityOnHand`, `reservedQuantity`, `reorderPoint`, `status`
- FKs: `tenantId -> tenants.id`, `warehouseId -> warehouses.id`, `productId -> products.id`
- Indexes: unique `(tenantId, code)`, `(tenantId, deletedAt)`
- Timestamps: `createdAt`, `updatedAt`
- Soft delete: `deletedAt`

#### `stock_movements`

- PK: `id`
- Important columns: `tenantId`, `inventoryItemId`, `fromWarehouseId`, `toWarehouseId`, `movementType`, `quantity`, `referenceType`, `referenceId`
- FKs: `tenantId -> tenants.id`, `inventoryItemId -> inventory_items.id`, `fromWarehouseId -> warehouses.id`, `toWarehouseId -> warehouses.id`, `createdByUserId -> users.id`
- Indexes: `(inventoryItemId, occurredAt)`, `(tenantId, movementType, occurredAt)`
- Timestamps: `occurredAt`, `createdAt`
- Soft delete: none

#### `branches`

- Already included as a first-class operational scoping table.

#### `warehouses`

- Already included as the stock location layer tied optionally to branches.

## Numbering Rules

- `quotations.number` is unique per tenant
- `invoices.number` is unique per tenant
- `delivery_notes.number` is unique per tenant
- `purchase_orders.number` is unique per tenant for future procurement
- `numbering_sequences` stores the next value per tenant, scope, document type, and optional fiscal year

In application logic, each document creation flow should:

1. lock the matching `numbering_sequences` row,
2. increment `currentValue`,
3. generate the document number,
4. save the document with the generated number inside the same transaction.

## Core Relationship Rules

- One `project` belongs to exactly one `client`
- One `project` may reference one accepted `quotation`
- One `invoice` may originate from a `quotation`, a `project`, or both
- One `delivery_note` may link to a `project`
- One `payment` can allocate to many invoices through `payment_allocations`
- One `invoice` can receive many partial allocations from many payments
- Files are stored once in `files` and attached through `document_links`

## ERD Description

### Commercial Flow

`lead -> client -> quotation -> project -> delivery_note -> invoice -> payment_allocation -> payment`

### Operational Flow

`project -> project_stages -> project_tasks`

`project -> project_assignments -> users`

`project -> project_measurements`

`project -> project_files -> files`

### Document Flow

`files -> document_links -> clients / leads / quotations / projects / invoices / delivery_notes / payments / expenses / notes`

### Catalog and Procurement Flow

`categories -> products / services`

`units -> products / services / quotation_items / invoice_items / delivery_note_items / project_measurements / purchase_order_items`

`suppliers -> purchase_orders -> purchase_order_items`

`products -> inventory_items -> stock_movements`

## Migration Plan

### Phase 1: System Foundation

- Create `tenants`, `branches`, `users`, `roles`, `permissions`, `user_roles`, `role_permissions`
- Create `refresh_tokens`, `audit_logs`, `activity_logs`, `settings`, `numbering_sequences`

### Phase 2: CRM and Catalog

- Create `clients`, `client_contacts`, `leads`, `lead_activities`, `notes`
- Create `categories`, `units`, `products`, `services`

### Phase 3: Commercial and Billing

- Create `quotations`, `quotation_items`, `quotation_status_history`
- Create `projects`
- Create `invoices`, `invoice_items`
- Create `payments`, `payment_allocations`
- Create `expense_categories`, `expenses`

### Phase 4: Logistics and Documents

- Create `vehicles`, `delivery_notes`, `delivery_note_items`, `delivery_status_history`
- Create `files`, `document_links`, `project_files`

### Phase 5: Operational Depth

- Create `project_stages`, `project_status_history`, `project_tasks`, `project_assignments`, `project_measurements`

### Phase 6: Future Extensions

- Create `suppliers`, `warehouses`, `purchase_orders`, `purchase_order_items`
- Create `inventory_items`, `stock_movements`

### Rollout Guidance

- Apply master/reference tables before transactional tables
- Backfill numbering sequences before enabling document creation in production
- Introduce partial payment allocation logic before marking invoices as paid automatically
- Keep history tables append-only
- Use soft delete filters consistently in repository and API query layers
