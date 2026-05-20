# Frontend Structure

## Routing Strategy

The admin app uses an App Router route group aligned to business domains:

- `/dashboard`
- `/crm/clients`
- `/crm/clients/[clientId]`
- `/crm/leads`
- `/crm/leads/[leadId]`
- `/sales/quotations`
- `/sales/quotations/[quotationId]`
- `/sales/invoices`
- `/sales/invoices/[invoiceId]`
- `/sales/delivery-notes`
- `/sales/delivery-notes/[deliveryNoteId]`
- `/operations/projects`
- `/operations/projects/[projectId]`
- `/finance/payments`
- `/finance/payments/[paymentId]`
- `/finance/expenses`
- `/finance/expenses/[expenseId]`
- `/documents`
- `/documents/[fileId]`
- `/settings/users`
- `/settings/roles`
- `/settings`

## UI Composition

- Tailwind CSS for design tokens, spacing, layout, and responsive behavior
- shadcn-style primitives for buttons, cards, badges, forms, and future tables/dialogs
- Global shell for sidebar, user context, branch switcher, and quick actions
- Dashboard pages for KPIs, charts, and alerts
- Resource list pages with filters, tables, bulk actions, and exports
- Resource detail pages with tabs for summary, documents, history, and linked records
- Reusable form patterns for document lines, totals, and status transitions

## Component Structure

- `src/components/app-shell.tsx`: responsive sidebar and top bar shell
- `src/components/admin/page-header.tsx`: page heading with action area
- `src/components/admin/filter-bar.tsx`: shared filter row wrapper
- `src/components/admin/data-table.tsx`: reusable table primitive
- `src/components/admin/status-badge.tsx`: consistent status rendering
- `src/components/admin/form-field.tsx`: shared labeled field wrapper
- `src/components/ui/*`: button, card, badge, input, dialog, drawer primitives

## Feature Structure

- `src/features/dashboard`: KPI cards, chart wrappers, reminders, recent activity
- `src/features/crm`: clients, leads, contacts, notes, reminders
- `src/features/sales`: quotations, invoices, delivery notes, line-item editors
- `src/features/projects`: chantier overview, stages, tasks, measurements, assignments
- `src/features/finance`: payments, allocations, expenses, receivable views
- `src/features/documents`: upload, preview, attachment links, metadata
- `src/features/admin`: users, roles, permissions, settings, audit views
- `src/lib/api`: typed request helpers, query keys, DTO mappers
- `src/lib/auth`: session storage, token refresh, permission helpers

## State Management Approach

- Use server components for initial data-heavy screens where SEO is irrelevant but fast first paint matters.
- Use a thin client-side query layer for mutation-driven admin screens and cache invalidation.
- Persist list filters in URL search params so tables remain shareable and restorable.
- Keep authenticated session state in a dedicated auth store with silent refresh support.
- Load permission context once at shell level and expose simple `can()` helpers to pages and action components.

## Form Handling Strategy

- Use schema-driven forms with DTO-aligned validation rules.
- Keep complex business forms split into sections: header, commercial lines, totals, attachments, and workflow actions.
- Extract reusable field primitives for money, quantity, percentage, date, select, and attachment inputs.
- Support drawer-based quick create flows and full-page edit flows for larger records.

## API Client Structure

- `src/lib/api/client.ts`: fetch wrapper, base URL resolution, JSON handling, auth header injection, error normalization
- `src/lib/api/types.ts`: paginated response and API error contracts
- `src/lib/api/query-keys.ts`: stable cache keys by module
- `src/lib/api/modules/*`: resource-specific clients for `clients`, `leads`, `quotations`, `invoices`, `payments`, and `projects`
- `src/lib/api/auth.ts`: login, refresh, logout, current-user bootstrap

## Mobile Readiness

- Responsive list-to-card degradation for field usage
- Action-first layouts for quick status changes
- Future split between office admin screens and lightweight chantier views
