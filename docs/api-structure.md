# API Structure

Detailed contract guidance now lives in [api-design.md](./api-design.md).

## Base Convention

- Base path: `/api/v1`
- OpenAPI docs: `/api/docs`
- Auth style: bearer token with future refresh token rotation
- Resource style: REST-first
- Tenant scope: resolved from authenticated context
- Branch scope: passed by filters or derived from user context
- Standard list query shape: `page`, `pageSize`, `search`, `sortBy`, `sortOrder`

## Module Endpoints

### Health

- `GET /health`

### Auth

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### Users and Roles

- `GET /users`
- `POST /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `GET /roles`
- `POST /roles`
- `GET /permissions`

### CRM

- `GET /crm/leads`
- `POST /crm/leads`
- `GET /crm/leads/:id`
- `PATCH /crm/leads/:id`
- `POST /crm/leads/:id/convert`
- `GET /crm/clients`
- `POST /crm/clients`
- `GET /crm/clients/:id`
- `PATCH /crm/clients/:id`
- `GET /crm/clients/:id/contacts`
- `POST /crm/clients/:id/contacts`

### Catalog

- `GET /catalog/items`
- `POST /catalog/items`
- `GET /catalog/items/:id`
- `PATCH /catalog/items/:id`

### Sales

- `GET /sales/quotations`
- `POST /sales/quotations`
- `GET /sales/quotations/:id`
- `PATCH /sales/quotations/:id`
- `POST /sales/quotations/:id/send`
- `POST /sales/quotations/:id/approve`
- `POST /sales/quotations/:id/reject`
- `POST /sales/quotations/:id/projects`
- `GET /sales/invoices`
- `POST /sales/invoices`
- `GET /sales/invoices/:id`
- `PATCH /sales/invoices/:id`
- `POST /sales/invoices/:id/issue`
- `GET /sales/delivery-notes`
- `POST /sales/delivery-notes`
- `GET /sales/delivery-notes/:id`
- `PATCH /sales/delivery-notes/:id`
- `POST /sales/payments`
- `GET /sales/payments`
- `GET /sales/payments/:id`

### Projects

- `GET /projects`
- `POST /projects`
- `GET /projects/:id`
- `PATCH /projects/:id`
- `GET /projects/:id/status-events`
- `POST /projects/:id/status-events`
- `GET /projects/:id/documents`
- `GET /projects/:id/expenses`

### Finance

- `GET /finance/expenses`
- `POST /finance/expenses`
- `GET /finance/expenses/:id`
- `PATCH /finance/expenses/:id`
- `GET /finance/receivables`

### Documents

- `GET /documents`
- `POST /documents/presign-upload`
- `POST /documents`
- `GET /documents/:id`
- `DELETE /documents/:id`

### Dashboard and Reports

- `GET /dashboard/overview`
- `GET /dashboard/sales-pipeline`
- `GET /dashboard/receivables`
- `GET /dashboard/project-health`
- `GET /reports/revenue`
- `GET /reports/expenses`

## Versioning Guidance

- Keep `/api/v1` stable for the MVP and Phase 2
- Add endpoint deprecation headers before introducing breaking changes
- Move complex reporting and automation use cases into dedicated endpoints instead of overloading CRUD responses
