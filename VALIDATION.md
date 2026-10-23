# Validation — Expensave 0.1.0

## Quick entry, personal meals, and Settings — October 16, 2026

- Production build, TypeScript checks including tests, 21 backend tests, and 6 interface tests pass.
- Quick-entry coverage includes food/transpo categories, decimal amounts, rejected ambiguous amounts and wallets, category overrides, refunds, expense deductions, and transfers that preserve total cash. Interface tests cover Enter/Log submission and automatic category display.
- Meals start empty even in demo mode. Tests cover creating, editing, deleting, reopening the collection, backup/restore, older backups without meals, and invalid costs.
- Onboarding stays complete after reload; profile edits use the Settings form, and closing it discards unsaved changes. Panel headers omit the wordmark. Wallet cards work with pointer and keyboard activation.
- Headless Chrome checked 1440, 768, 390, and 320 CSS pixel layouts, native wallet body/menu clicks, Settings, and the empty meal collection. The read-only browser preview used temporary wallets when the saved workspace was empty and did not write any user data.

## Quick setup and close controls — October 16, 2026

- Production build and local Docker startup passed; health endpoint returns HTTP 200.
- All 17 backend tests and 4 interface integration tests passed. Coverage includes setup completion without recording income, back navigation, persistence after reload/restart, retrying failed saves, editing/cancelling setup, and compatibility with older settings and backups.
- Headless Chrome checked both setup steps at 1440, 768, 390, and 320 CSS pixels. Inputs fit and the document has no horizontal overflow. Desktop and mobile screenshots were inspected.
- All six feature panels have working icon-only X close buttons with accessible labels. Browser verification used temporary browser state and did not save changes to the user's workspace.

## Design update — October 16, 2026

- Production TypeScript/client/server build and Docker rebuild passed.
- Both existing interface integration tests passed after the wallet markup and palette changes.
- Headless Chrome checks passed at 1440, 768, 390, and 320 CSS pixels: no document overflow, account details remain above the wallet pocket, and the wallet edit dialog opens.
- Desktop and mobile screenshots were inspected. The rebuilt local container serves the updated client and returns HTTP 200 from its health endpoint.
- The earlier release-validation notes below describe the original development environment.

Completed in the development workspace:

- `npm run build`: passed TypeScript checks and production builds for the React client and Fastify server.
- `npm test`: **16 passing** ledger, persistence, and HTTP API tests.
- `npm run test:ui`: **2 passing** DOM component integration tests using the real Fastify handlers and an in-memory SQLite database.

The ledger/API tests cover transfer conservation, credit-card debt and repayments, edits/deletes, refunds, rejected transfers, integer amounts, invalid/future dates, wallet deletion protection, atomic and duplicate bill payments, month-end dates, daily allowance reservations, backup rollback and restored balances, budget uniqueness, persistence across database reopen, opt-in demo data, Host/origin checks, compiled HTML serving, CSV export, and confirmed reset.

The component tests were rerun for the single-dashboard redesign. They exercise wallet creation, expense creation/edit/delete inside the Activity panel, demo loading, opening and closing budget/goal/insight/meal panels, removal of the sidebar, and saving preferences. They run in a simulated DOM, not Safari or Chrome, and do not verify visual layout or browser-specific behavior.

Final client output: approximately 555 kB JavaScript (173 kB gzip) split into application and UI chunks; approximately 35 kB CSS (8 kB gzip), plus bundled local fonts. This is a build measurement, not a responsiveness benchmark.

Not executed here:

- Docker image build or container startup: Docker is unavailable in the workspace.
- Apple Silicon or Intel Mac runtime tests.
- Actual Safari/Chrome browser interaction, visual layout, or offline network-disconnection tests.
- Docker Hub publication.

Before distributing a Mac release, build and run the image on the target architectures, verify the health check, add/edit/delete transactions, restart/recreate the container with the same volume, restore a downloaded backup, and check operation with the internet disconnected.
