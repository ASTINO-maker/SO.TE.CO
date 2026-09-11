# SO.TE.CO production audit

Audit date: 2026-09-11

This document records the high-impact issues found during a source review and the changes applied in the professionalization pass.

## Fixed in this pass

### Money and numeric consistency

- Added one shared Tunisian amount parser instead of maintaining incompatible comma/dot parsers across screens.
- Operational UI now uses compact TND values: `0 TND`, `1 234,5 TND`, `1 234,567 TND`.
- Formal accounting documents intentionally retain three millimes: `0,000 TND`, `1 234,500 TND`.
- Payment, expense, worker-payment, lead, client, devis, facture, delivery quantity and document-setting parsing now handles French/Tunisian localized numbers consistently.
- Removed hard-coded dashboard monetary examples that could look like live business data.

### Devis and facture creation

- Invoice-specific payment terms are now persisted through a Prisma migration and reused by API responses/PDF generation instead of being lost after reload.
- Removed fictional default prices, clients and old fixed dates from new-document forms.
- New documents use today's date and a sensible +30-day validity/due-date default.
- Devis validity and invoice due dates are validated against their issue dates; invalid backward date ranges are rejected.
- Empty draft lines display neutral placeholders instead of fake monetary totals.

### Payments and invoice balances

- Implemented payment-to-invoice allocation endpoints and UI.
- Allocation endpoints use the dedicated `payments.allocate` permission instead of the broader payment-update permission.
- Allocation validates tenant, client, payment remainder and invoice remainder.
- Invoice `paidAmount`, `balanceDue`, status and `paidAt` are synchronized when allocations are added or removed.
- Payment `CONFIRMED / PARTIALLY_ALLOCATED / ALLOCATED` state is synchronized with allocations.
- Allocated payments cannot be deleted or reassigned to another client without removing allocations first.
- Paid invoices cannot be reduced below the amount already settled, moved to another client, or deleted while allocations exist. Invoice payment status is recalculated when paid invoice totals change.
- Managed allocation statuses cannot be manually overridden while allocations exist.
- Fixed the UI's old `Pending allocation` sentinel mismatch.

### Dashboard correctness

- Removed a revenue chart calculation that effectively normalized every non-zero value to 100%.
- Corrected unpaid-invoice counts that were accidentally capped by the display-list size.
- A true 0% collection rate now renders as 0%, not as a visually fabricated minimum bar.
- Standardized French labels and status text in management summaries.

### Authentication and production security

- Production startup validates the JWT access secret and initial owner credentials.
- Production CORS rejects `*` when credentials are enabled.
- Swagger is off in production unless explicitly enabled.
- Removed default credentials from the login screen and setup form; first-login password replacement now requires at least 12 characters.
- Added a client-side refresh mutex so simultaneous 401 responses do not rotate the same refresh token multiple times and randomly sign the user out.

### Role-aware web shell

- Sidebar/navigation modules are filtered by the authenticated user's read permissions.
- Command-palette create shortcuts are filtered by the matching create permissions, reducing confusing 403 flows for read-only roles.
- Direct navigation to a module without its read permission now redirects to the first accessible module instead of rendering a broken/forbidden workspace.

### Settings and tenant isolation

- Restricted workspace/document mutations to `settings.update` and workspace reads to `settings.read`.
- Document header/bank settings remain available to users who need to render business documents, but are denied to unrelated authenticated roles.
- Worker-payment batches now use the authenticated user's `tenantId` instead of the default workspace fallback, closing a cross-tenant data path.
- Worker-payment reads require `payments.read`; create/update/delete require `payments.update`.

### PDF routes

- Fixed the Docker web-to-API internal URL so authenticated PDF routes validate sessions against the `api` service instead of container-local `127.0.0.1`.
- Invoice/devis PDF routes now authenticate against the API, enforce the corresponding read permission, and scope database reads by `tenantId`.
- Generic HTML-to-PDF rendering requires authentication plus a business-document read permission.
- PDF filenames are normalized and constrained to the temporary render directory.
- Active tags/schemes such as script, iframe, object, embed, `javascript:` and `file:` are rejected from generic PDF markup.
- Removed Chrome's explicit file-access-from-files flag.

### Documents

- Fixed backend `Unlinked` vs frontend `Non lie` mismatch, which broke the unlinked-document filter/count.
- Added a 20 MB upload limit.
- Upload linkage is validated before writing to disk, and failed database writes now clean up the temporary local file instead of leaving orphaned binaries.
- Storage reporting now matches the implemented local-filesystem upload/download path; S3 is documented as future work rather than reported as active.
- User-facing document entity labels were normalized to French.

## Still recommended before a production sign-off

### High priority

1. **Expand automated tests.** TND parser/formatter regression tests are now included, but API and web `test` scripts are still placeholders. Add tests for authorization, invoice totals and payment allocations; add end-to-end tests for login -> client -> devis -> facture -> payment.
2. **Move refresh tokens out of localStorage.** Prefer Secure, HttpOnly, SameSite cookies with CSRF protection where applicable.
3. **Make payment allocation concurrency-safe.** The current transaction keeps related updates together, but high-concurrency production should use serializable transactions/retries or explicit locking so two simultaneous allocations cannot oversubscribe the same payment/invoice.
4. **Finalize object storage.** The repository exposes an `s3` configuration shape, but document upload/download logic is currently local-filesystem based. Keep a persistent volume for single-instance deployments or implement the S3 adapter before horizontal scaling.

### Medium priority

5. Replace the per-process login-throttle map with Redis/shared throttling when running multiple API instances, and configure trusted proxy handling rather than trusting arbitrary forwarding headers.
6. Run headless Chrome PDF rendering in a separately sandboxed worker/container if untrusted users will ever supply document markup. The current container command still uses Chrome `--no-sandbox` for deployment compatibility.
7. Replace sequential number lookups with the existing numbering-sequence model or another atomic sequence strategy. Retry-on-unique-conflict is functional but less clean under heavy write concurrency.
8. Complete French localization for remaining technical API error strings and enum-like labels.
9. Review permissions for every future write endpoint as modules expand; current primary controllers use permission decorators, but regression tests should enforce this.
10. Make create/edit/delete controls inside each module permission-aware, not only the shell and command palette. The API remains the security boundary, but read-only users should not be offered actions that will return 403.
11. Move worker-payment batches from a JSON setting into dedicated relational tables if this becomes a core payroll/cashbook feature; that will provide cleaner audit history and safer concurrent edits.

## Verification performed in this audit environment

- Parsed all 182 application `.ts` / `.tsx` source files (excluding declaration files) with the TypeScript parser: **0 syntax errors**.
- Built the dependency-light `@sotec/config` package with TypeScript successfully.
- Executed the new TND parser/formatter regression suite for zero, negative zero, comma decimal, dot decimal, mixed grouping and negative amounts.
- Full monorepo dependency install/build could not be executed in this sandbox because the archive contains no `node_modules`, pnpm 10 was not cached, and npm registry DNS access was unavailable (`EAI_AGAIN registry.npmjs.org`).

Run this on a connected development machine before deployment:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm db:generate
pnpm typecheck
pnpm build
```

Then smoke-test at minimum: login, dashboard, client CRUD, devis create/edit/PDF, facture create/edit/PDF, payment create/edit/allocation/removal, expense CRUD, document upload/download and role-limited access.
