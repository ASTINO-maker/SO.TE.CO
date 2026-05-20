# REST API Design

## API Conventions

### Base

- Base URL: `/api/v1`
- OpenAPI: `/api/docs`
- Content type: `application/json`
- Authentication: `Authorization: Bearer <access_token>`
- Versioning: URI versioning for major API versions

### Resource Naming

- Use plural nouns for top-level resources
- Use kebab-case for multi-word endpoints
- Use nested endpoints only for tightly owned subresources

Examples:

- `/clients`
- `/leads`
- `/quotations`
- `/delivery-notes`
- `/projects/:id/tasks`

### List Query Convention

All list endpoints should accept:

- `page`
- `pageSize`
- `search`
- `sortBy`
- `sortOrder`

Optional resource-specific filters are added as query parameters.

Example:

`GET /api/v1/invoices?page=1&pageSize=20&search=INV-2026&status=OVERDUE&sortBy=dueDate&sortOrder=asc`

### Success Response Shape

#### List responses

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 125,
    "totalPages": 7
  }
}
```

#### Single resource responses

```json
{
  "data": {
    "id": "..."
  }
}
```

#### Action responses

```json
{
  "data": {
    "id": "...",
    "status": "ACCEPTED"
  },
  "meta": {
    "message": "Quotation accepted successfully"
  }
}
```

## Error Response Format

All errors should return a stable envelope:

```json
{
  "statusCode": 422,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "dueDate",
        "message": "dueDate must be after issueDate"
      }
    ]
  },
  "path": "/api/v1/invoices",
  "method": "POST",
  "timestamp": "2026-04-01T12:00:00.000Z",
  "requestId": "req_123"
}
```

Recommended application error codes:

- `UNAUTHORIZED`
- `FORBIDDEN`
- `VALIDATION_ERROR`
- `NOT_FOUND`
- `CONFLICT`
- `BUSINESS_RULE_VIOLATION`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

## Validation Layer

### Transport Validation

Use Nest DTOs with:

- `class-validator`
- `class-transformer`
- global `ValidationPipe`

Responsibilities:

- type conversion
- required field enforcement
- enum validation
- numeric bounds
- date validation

### Business Validation

Keep business rules in services, not only DTOs.

Examples:

- quotation client must match project client during conversion
- allocation total cannot exceed payment amount
- only accepted quotations can create projects
- archived records cannot be linked into new transactions

## Authentication Middleware / Guards

### Auth Flow

- `POST /auth/login` returns access + refresh token pair
- `POST /auth/refresh` rotates refresh token and returns new pair
- `POST /auth/logout` revokes current refresh token
- `POST /auth/logout-all` revokes all refresh tokens for the user
- `GET /auth/me` returns current identity, roles, and scope

### Middleware / Guard Layers

1. JWT auth guard
2. tenant resolution from token
3. branch/scope resolution from user profile
4. permission guard
5. optional record-scope policy check

### Token Strategy

- short-lived access token
- rotating refresh token persisted in `refresh_tokens`
- revoke on logout, password reset, user suspension, or forced admin action

## Audit Logging Strategy

Audit logs should be written for:

- login / logout
- create / update / archive / restore
- status transitions
- approvals and rejections
- permission-sensitive actions
- session revocation

Audit payload should include:

- `tenantId`
- `branchId`
- `userId`
- `action`
- `entityType`
- `entityId`
- `oldValues`
- `newValues`
- `metadata`
- `ipAddress`
- `userAgent`

Write audit entries in service layer transaction boundaries where possible.

## File Upload Strategy

### Recommended Flow

1. Client requests upload target:
   - `POST /files/upload-requests`
2. API validates permission, mime type, size, and target context
3. API returns either:
   - local upload endpoint for development
   - pre-signed S3-compatible upload data for production
4. Client uploads binary
5. Client confirms link creation:
   - `POST /files`
   - `POST /document-links`

### Why this pattern

- keeps API stateless for large file payloads
- supports local and S3-compatible storage with the same contract
- preserves metadata and attachment logic separately from physical storage

## Resource Endpoints

### Auth

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `GET /auth/me`

### Users

- `GET /users`
- `POST /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `POST /users/:id/suspend`
- `POST /users/:id/reactivate`
- `GET /users/:id/sessions`
- `POST /users/:id/sessions/revoke`

Filters:

- `search`
- `status`
- `branchId`
- `roleCode`
- `includeArchived`

### Roles

- `GET /roles`
- `POST /roles`
- `GET /roles/:id`
- `PATCH /roles/:id`
- `GET /permissions`

Filters:

- `search`
- `includeSystemRoles`

### Clients

- `GET /clients`
- `POST /clients`
- `GET /clients/:id`
- `PATCH /clients/:id`
- `DELETE /clients/:id`
- `POST /clients/:id/restore`
- `GET /clients/:id/contacts`
- `POST /clients/:id/contacts`
- `PATCH /client-contacts/:id`
- `DELETE /client-contacts/:id`
- `GET /clients/:id/notes`
- `POST /clients/:id/notes`
- `GET /clients/:id/files`

Filters:

- `search`
- `type`
- `branchId`
- `hasOverdueInvoices`
- `hasActiveProjects`
- `includeArchived`

### Leads

- `GET /leads`
- `POST /leads`
- `GET /leads/:id`
- `PATCH /leads/:id`
- `DELETE /leads/:id`
- `POST /leads/:id/restore`
- `POST /leads/:id/convert`
- `GET /leads/:id/activities`
- `POST /leads/:id/activities`
- `PATCH /lead-activities/:id`
- `GET /leads/:id/notes`
- `POST /leads/:id/notes`

Filters:

- `search`
- `status`
- `source`
- `assignedUserId`
- `branchId`
- `followUpState=overdue|today|week`
- `includeArchived`

### Quotations

- `GET /quotations`
- `POST /quotations`
- `GET /quotations/:id`
- `PATCH /quotations/:id`
- `DELETE /quotations/:id`
- `POST /quotations/:id/restore`
- `POST /quotations/:id/send`
- `POST /quotations/:id/approve`
- `POST /quotations/:id/reject`
- `POST /quotations/:id/duplicate`
- `POST /quotations/:id/convert-to-project`
- `POST /quotations/:id/convert-to-invoice`
- `GET /quotations/:id/status-history`
- `GET /quotations/:id/pdf`

Filters:

- `search`
- `status`
- `clientId`
- `leadId`
- `branchId`
- `createdByUserId`
- `validityState=active|expiring|expired`
- `dateFrom`
- `dateTo`
- `includeArchived`

### Invoices

- `GET /invoices`
- `POST /invoices`
- `GET /invoices/:id`
- `PATCH /invoices/:id`
- `DELETE /invoices/:id`
- `POST /invoices/:id/restore`
- `POST /invoices/:id/issue`
- `POST /invoices/:id/void`
- `GET /invoices/:id/payments`
- `GET /invoices/:id/pdf`

Filters:

- `search`
- `status`
- `clientId`
- `projectId`
- `quotationId`
- `branchId`
- `overdue=true`
- `dateFrom`
- `dateTo`
- `dueDateFrom`
- `dueDateTo`
- `includeArchived`

### Payments

- `GET /payments`
- `POST /payments`
- `GET /payments/:id`
- `PATCH /payments/:id`
- `DELETE /payments/:id`
- `POST /payments/:id/restore`
- `GET /payments/:id/allocations`
- `POST /payments/:id/allocations`
- `PATCH /payment-allocations/:id`
- `DELETE /payment-allocations/:id`

Filters:

- `search`
- `status`
- `method`
- `clientId`
- `projectId`
- `branchId`
- `allocationState=unallocated|partial|allocated`
- `dateFrom`
- `dateTo`
- `includeArchived`

### Expenses

- `GET /expenses`
- `POST /expenses`
- `GET /expenses/:id`
- `PATCH /expenses/:id`
- `DELETE /expenses/:id`
- `POST /expenses/:id/restore`
- `POST /expenses/:id/approve`
- `POST /expenses/:id/reject`
- `POST /expenses/:id/pay`
- `GET /expense-categories`
- `POST /expense-categories`
- `PATCH /expense-categories/:id`
- `DELETE /expense-categories/:id`

Filters:

- `search`
- `status`
- `expenseCategoryId`
- `projectId`
- `supplierId`
- `branchId`
- `dateFrom`
- `dateTo`
- `includeArchived`

### Delivery Notes

- `GET /delivery-notes`
- `POST /delivery-notes`
- `GET /delivery-notes/:id`
- `PATCH /delivery-notes/:id`
- `DELETE /delivery-notes/:id`
- `POST /delivery-notes/:id/restore`
- `POST /delivery-notes/:id/prepare`
- `POST /delivery-notes/:id/dispatch`
- `POST /delivery-notes/:id/deliver`
- `POST /delivery-notes/:id/return`
- `POST /delivery-notes/:id/cancel`
- `GET /delivery-notes/:id/status-history`
- `GET /delivery-notes/:id/pdf`

Filters:

- `search`
- `status`
- `clientId`
- `projectId`
- `vehicleId`
- `branchId`
- `dateFrom`
- `dateTo`
- `includeArchived`

### Projects

- `GET /projects`
- `POST /projects`
- `GET /projects/:id`
- `PATCH /projects/:id`
- `DELETE /projects/:id`
- `POST /projects/:id/restore`
- `POST /projects/:id/change-status`
- `GET /projects/:id/status-history`
- `GET /projects/:id/stages`
- `POST /projects/:id/stages`
- `PATCH /project-stages/:id`
- `DELETE /project-stages/:id`
- `GET /projects/:id/tasks`
- `POST /projects/:id/tasks`
- `PATCH /project-tasks/:id`
- `DELETE /project-tasks/:id`
- `GET /projects/:id/assignments`
- `POST /projects/:id/assignments`
- `DELETE /project-assignments/:id`
- `GET /projects/:id/measurements`
- `POST /projects/:id/measurements`
- `PATCH /project-measurements/:id`
- `DELETE /project-measurements/:id`
- `GET /projects/:id/files`

Filters:

- `search`
- `status`
- `clientId`
- `quotationId`
- `projectManagerId`
- `assignedUserId`
- `branchId`
- `delayed=true`
- `dateFrom`
- `dateTo`
- `includeArchived`

### Files

- `GET /files`
- `POST /files/upload-requests`
- `POST /files`
- `GET /files/:id`
- `PATCH /files/:id`
- `DELETE /files/:id`
- `POST /files/:id/restore`
- `GET /document-links`
- `POST /document-links`
- `PATCH /document-links/:id`
- `DELETE /document-links/:id`

Filters:

- `search`
- `fileKind`
- `visibility`
- `entityType`
- `uploadedByUserId`
- `dateFrom`
- `dateTo`
- `includeArchived`

### Dashboard

- `GET /dashboard/metrics`
- `GET /dashboard/revenue-summary`
- `GET /dashboard/unpaid-invoices`
- `GET /dashboard/quotation-status`
- `GET /dashboard/project-pipeline`
- `GET /dashboard/recent-activities`
- `GET /dashboard/monthly-charts`
- `GET /dashboard/reminders`

Filters:

- `branchId`
- `dateFrom`
- `dateTo`
- `salesUserId`
- `projectManagerId`

## Status Transition Endpoints

Use dedicated endpoints for transitions where history and permissions matter.

Examples:

- `POST /quotations/:id/approve`
- `POST /invoices/:id/issue`
- `POST /delivery-notes/:id/deliver`
- `POST /projects/:id/change-status`
- `POST /expenses/:id/approve`

Payload example:

```json
{
  "note": "Approved after client confirmation"
}
```

Why separate endpoints:

- preserves intent
- simplifies permissions
- allows business-rule validation
- guarantees history logging

## Archive / Delete Policy

Use soft delete for important business entities:

- clients
- leads
- quotations
- invoices
- payments
- expenses
- delivery notes
- projects
- files
- catalog resources
- users

Prefer:

- `DELETE /resource/:id` for archive
- `POST /resource/:id/restore` for restore

Use hard delete only for lightweight child records when safe, such as draft-only contacts or attachments if policy allows.

## Implementation Notes

### Nest Validation

- transport DTOs for query/body validation
- service-level business rule checks
- Swagger decorators on controllers and DTOs

### Guards

- `JwtAuthGuard`
- `PermissionsGuard`
- optional `ScopeGuard` for branch or assignment filtering

### Auditing

- attach audit logging to service methods around create/update/archive/status transition operations
- include actor, entity type, entity id, old/new values, IP, and user agent

### Uploads

- local disk adapter in development
- S3-compatible signed upload flow in production
- `files` stores metadata
- `document_links` stores attachments to business entities
