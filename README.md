# SO.TE.CO ERP/CRM

Production-oriented ERP/CRM foundation for a metal construction and custom fabrication company. The platform centralizes lead management, quotations, project execution, delivery, invoicing, payments, expenses, documents, and reporting in a SaaS-ready architecture.

## Target Stack

- `apps/web`: Next.js admin frontend
- `apps/api`: NestJS modular API
- `packages/database`: Prisma schema and database client
- `packages/contracts`: shared types and domain contracts
- `packages/config`: shared configuration helpers
- `packages/ui`: shared UI building blocks
- PostgreSQL, Redis, S3-compatible object storage

## Core Business Flow

`Lead -> Client -> Quotation -> Approval -> Project -> Delivery Note -> Invoice -> Payment -> Completion`

## Workspace Structure

```text
apps/
  api/              NestJS API modules
  web/              Next.js admin app
docs/               Architecture, domain model, roadmap
packages/
  config/           Shared configuration
  contracts/        Shared domain contracts
  database/         Prisma schema and database access
  tsconfig/         Shared TypeScript configuration
  ui/               Shared UI primitives
```

## Planned Modules

- CRM: leads, clients, contacts, activity history
- Sales: quotations, invoices, delivery notes, payments
- Operations: projects, status tracking, documents, execution visibility
- Finance: expenses, receivables, dashboard metrics
- Administration: users, roles, permissions, audit log

## Local Development

1. Copy `.env.example` to `.env`
2. Start infrastructure with `docker compose up -d`
3. Install dependencies with `pnpm install`
4. Generate Prisma client with `pnpm db:generate`
5. Run the workspace with `pnpm dev`

## Local Customer Delivery

For an owner-only local installation on one machine, use the dedicated guide:

- [docs/local-owner-setup.md](/Users/sadokamine/Desktop/Private/SO.TE.CO/docs/local-owner-setup.md)

Helper scripts:

- [scripts/local-start.sh](/Users/sadokamine/Desktop/Private/SO.TE.CO/scripts/local-start.sh)
- [scripts/local-stop.sh](/Users/sadokamine/Desktop/Private/SO.TE.CO/scripts/local-stop.sh)
- [scripts/local-status.sh](/Users/sadokamine/Desktop/Private/SO.TE.CO/scripts/local-status.sh)

## Hosted Web Deployment

For Railway hosting, use the dedicated deployment guide:

- [docs/railway-deployment.md](/Users/sadokamine/Desktop/Private/SO.TE.CO/docs/railway-deployment.md)

For VPS/Docker hosting, use:

- [docs/web-deployment.md](/Users/sadokamine/Desktop/Private/SO.TE.CO/docs/web-deployment.md)

## Current State

This repository includes the initial architecture, database model, API module skeletons, and admin frontend shell. Business logic, authentication hardening, persistence wiring, and automated tests are the next implementation steps.
