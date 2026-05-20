# Architecture Decision

## Chosen Backend: NestJS API

NestJS is the better fit for this product than Laravel.

### Why NestJS over Laravel

- The frontend is already `Next.js + TypeScript`, so NestJS keeps the platform in one language across frontend, backend, DTOs, validation rules, permission codes, and shared contracts.
- The system is domain-heavy, not just CRUD-heavy. NestJS gives stronger modular boundaries for `crm`, `sales`, `projects`, `finance`, `documents`, `auth`, and `admin`.
- Swagger/OpenAPI, guards, interceptors, exception filters, pipes, and background processing patterns are first-class and map cleanly to ERP/CRM needs.
- Multi-tenant SaaS evolution is easier when shared contracts, permission enums, and workflow DTOs stay type-safe across the monorepo.
- Prisma integrates well with PostgreSQL and gives maintainable schema evolution, typed access, and predictable migrations.

Laravel would also work, but it would create a split-language stack with less reuse between frontend and backend. For this product, that tradeoff is not worth it.

## Chosen Stack

- Frontend: `Next.js App Router + TypeScript + Tailwind CSS + shadcn-style components`
- Backend: `NestJS`
- Database: `PostgreSQL`
- ORM: `Prisma`
- Auth: `JWT access token + refresh token rotation + RBAC`
- Storage: `local adapter in development`, `S3-compatible adapter in production`
- API docs: `Swagger / OpenAPI`
- PDFs: server-side PDF service abstraction for quotations, invoices, and delivery notes

## Architectural Style

- Modular monorepo
- Domain-driven module boundaries
- Shared contracts package for stable cross-app types
- Clean separation between:
  - `controllers`: transport layer
  - `dto`: validation and request contracts
  - `services`: business logic
  - `infrastructure`: Prisma, storage, PDF, audit

## Multi-Tenant Readiness

V1 can run for one company, but the schema is tenant-scoped from the start:

- `tenantId` on all major records
- `branchId` where branch scoping matters
- role and permission ownership scoped per tenant
- query services designed to filter by tenant context

This avoids a costly rewrite when moving from single-company deployment to SaaS or multi-branch rollout.

