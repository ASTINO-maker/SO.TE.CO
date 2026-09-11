# SO.TE.CO ERP/CRM

SO.TE.CO ERP/CRM is a multi-module business application for metal construction and project-based operations. It centralizes CRM, quotations, invoices, delivery notes, customer payments, expenses, projects, documents, users, roles and management dashboards in one workspace.

## Architecture

- `apps/web` — Next.js 15 / React 19 web application
- `apps/api` — NestJS API
- `apps/desktop` — Electron Windows launcher and local-runtime packaging
- `packages/database` — Prisma schema, migrations and database client
- `packages/config` — shared configuration and Tunisian number/currency formatting
- `packages/contracts` — shared domain contracts
- `packages/ui` — shared UI building blocks
- PostgreSQL — primary database
- Local persistent storage or a future S3-compatible adapter — uploaded documents

Core flow:

```text
Prospect -> Client -> Devis -> Validation -> Chantier -> Bon de livraison -> Facture -> Paiement -> Cloture
```

## Requirements

- Node.js 22
- pnpm 10
- PostgreSQL 16+ (or Docker)
- Chrome/Chromium for server-side PDF rendering

## Local development

```bash
cp .env.example .env
corepack enable
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Default development ports:

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api/v1`
- API health: `http://localhost:4000/api/v1/health`

Set your own local `DEFAULT_OWNER_EMAIL`, `DEFAULT_OWNER_PASSWORD` and `JWT_ACCESS_SECRET` before first login. Production startup rejects placeholder/weak authentication values.

## Quality checks

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Automated business tests are still a project gap and should be added before treating payment/invoice workflows as fully regression-protected. See `docs/PRODUCTION_AUDIT.md` for the latest audit and verification notes.

## Deployment

Railway deployment instructions are in [`docs/railway-deployment.md`](docs/railway-deployment.md). VPS/Docker deployment instructions are in [`docs/web-deployment.md`](docs/web-deployment.md).

For Railway document uploads, mount a persistent volume at `/app/storage`. Without persistent storage, uploaded files can disappear during redeploys.

## Desktop packaging

The Electron app under `apps/desktop` packages the built web/API runtime for Windows. Build the complete installer from a machine with dependencies installed:

```bash
pnpm build:installer
```

Desktop-specific notes are in [`apps/desktop/README.md`](apps/desktop/README.md).

## Security notes

- Production requires a strong `JWT_ACCESS_SECRET` and owner password.
- Swagger is disabled in production unless `ENABLE_SWAGGER=true`.
- Browser/API CORS must use explicit origins in production; wildcard credentials are rejected.
- Direct invoice/devis PDF routes verify the current API session, permission and tenant before reading data.
- The generic PDF renderer requires an appropriate business-document permission and rejects active/unsafe markup schemes.
- Refresh tokens are currently browser-managed tokens. Moving them to HttpOnly, Secure, SameSite cookies is recommended for further hardening.
