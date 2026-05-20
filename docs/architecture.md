# Architecture Blueprint

## Product Scope

This platform is a web-based ERP/CRM admin system for a metal construction company that sells custom fabricated products and project-based services:

- Portails
- Pergolas
- Escaliers metalliques
- Garde-corps
- Structures metalliques
- Welding and fabrication work
- Delivery and installation

The product centralizes the commercial, operational, financial, and documentary lifecycle from first prospect contact to final payment.

## Architectural Principles

- Modular monorepo with independent deployable apps
- Bounded contexts aligned to business domains
- PostgreSQL as source of truth for transactional data
- Object storage for plans, contracts, photos, and signed documents
- Role-based access control with permission granularity
- Multi-tenant ready from day one, multi-branch ready through branch scoping
- API-first contracts to support web, mobile, and future partner channels
- Event-friendly design for future notifications, automation, and analytics

## System Overview

### Frontend

- Next.js admin portal
- Tailwind CSS and shadcn-style component primitives
- Route groups by domain: CRM, Sales, Operations, Finance, Settings
- Shared UI package for layout, cards, tables, filters, and forms
- Future additions: offline-friendly field views, mobile web, e-sign workflow

### Backend

- NestJS modular API
- Swagger/OpenAPI published at `/api/docs`
- Domain modules:
  - `auth`
  - `audit`
  - `users`
  - `roles`
  - `crm`
  - `sales`
  - `projects`
  - `catalog`
  - `finance`
  - `documents`
  - `dashboard`
  - `storage`
  - `pdf`
- Application services own workflows
- Controllers expose REST resources
- Background jobs reserved for notifications, reminders, and document processing

### Data and Infrastructure

- PostgreSQL for relational ERP/CRM data
- Redis for caching, queues, sessions, rate limiting, and background jobs
- MinIO or S3 for document and image storage
- Prisma ORM for schema management and typed database access
- Soft delete strategy for important business entities
- Audit log table for create/update/delete/status events
- Docker Compose for local infrastructure

## Cross-Cutting Standards

- DTO validation with `class-validator`
- global error formatting through Nest exception filters
- reusable pagination, search, and sorting DTOs
- explicit service abstractions for file storage and PDF generation
- tenant-aware data access patterns
- migration-driven schema evolution with Prisma

## Business Modules

### CRM

- Lead capture
- Prospect qualification
- Client profiles
- Contact persons
- Conversion from lead to client
- Commercial activity tracking

### Sales

- Quotations with line items, versioning, and approval status
- Invoices with due dates, payment status, and balance tracking
- Delivery notes for transport and installation handoff
- Payment registration and reconciliation

### Operations

- Project creation from approved quotations
- Project status progression
- Site and installation tracking
- Photo, drawing, and signed document management
- Planned future worker tasks and field execution

### Finance

- Payments received
- Operating and project-linked expenses
- Revenue and collection metrics
- Planned future profitability reporting per project

### Administration

- Internal users
- Roles and permissions
- Branch scoping
- Auditability

## Workflow Map

1. Lead enters the system from manual entry, phone call, referral, or website.
2. Sales qualifies the lead, logs site visit details, and optionally converts it into a client.
3. A quotation is prepared using catalog items and custom fabrication lines.
4. When the quotation is approved, a project is opened with target dates and operational status.
5. Delivery notes record shipped or installed items and execution milestones.
6. One or more invoices are emitted based on project billing rules.
7. Payments are recorded against invoices and client balances.
8. Expenses and documents are attached to the project for operational and financial visibility.
9. Dashboard metrics expose pipeline, revenue, receivables, project progress, and overdue actions.

## Extension Readiness

The foundation explicitly leaves room for:

- Inventory and stock movements
- Supplier management
- Purchase orders
- Worker task tracking
- WhatsApp and email notifications
- Project profitability
- Mobile field usage
- E-signature
- Multi-branch support

Those extensions fit naturally because the system is organized around stable domains, shared contracts, and relational references instead of tightly coupled screens.
