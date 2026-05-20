# Implementation Roadmap

## Phase 1: Foundation

### Objectives

- Establish the monorepo, PostgreSQL schema, NestJS module boundaries, and Next.js admin shell.
- Implement authentication, refresh-token sessions, RBAC, audit logging, and shared UI primitives.

### Deliverables

- Prisma schema, initial migration, and seed-ready RBAC catalog
- JWT access-token flow with refresh rotation and permission guards
- Shared list-query DTOs, exception filter, Swagger bootstrap, storage and PDF abstractions
- Responsive dashboard shell with sidebar, top bar, reusable table, status badge, and filter components

### Dependencies

- PostgreSQL instance
- environment secrets for JWT
- initial tenant, branch, and super-admin seed

## Phase 2: Core Business

### Objectives

- Support the first full commercial and billing workflows from client management through payment collection.

### Deliverables

- Clients, contacts, notes, leads, and activity timeline
- Quotations with line items, numbering, PDF generation, duplication, and conversion
- Invoices, partial payments, payment allocations, and dashboard basics

### Dependencies

- Phase 1 auth/RBAC and tenant scoping
- numbering sequence service
- file/document upload baseline

## Phase 3: Operations

### Objectives

- Extend the platform into chantier execution and supporting cost control.

### Deliverables

- Projects, stages, assignments, measurements, files, and status history
- Delivery notes with transport workflow and printable output
- Expenses with project linkage and attachment handling

### Dependencies

- Phase 2 client, quotation, and invoice data
- document service and file-linking infrastructure

## Phase 4: Advanced

### Objectives

- Improve follow-up automation, decision support, and operational intelligence.

### Deliverables

- Lead pipeline views and reminder engine
- richer dashboard analytics and monthly charts
- notifications for overdue invoices, pending follow-ups, and blocked projects
- better reports for revenue, receivables, and project delivery performance

### Dependencies

- stable operational data from phases 2 and 3
- background jobs or scheduled task support

## Phase 5: Future Extensions

### Objectives

- Turn the ERP foundation into a broader multi-branch operations platform.

### Deliverables

- Inventory and stock movements
- suppliers and purchase orders
- worker task tracking and mobile-friendly field workflows
- WhatsApp or email notifications, e-signature, and multi-branch reporting

### Dependencies

- mature document and auth layers
- operational adoption of projects and logistics modules
- branch and warehouse master data
