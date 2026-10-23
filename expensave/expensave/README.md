# Expensave

A local expense tracker for a little more breathing room. A single Google-inspired dashboard with large Roboto typography, pill buttons, a neutral/sage/emerald palette, layered wallet pockets, and manual BPI, BDO, MariBank, cash, and credit-card accounts.

**Version 0.1.0 — local single-user MVP.** Runs on localhost in one Linux Docker container. No account, API key, subscription, or internet connection is required after installing the image. Docker must remain running.

## Start on your Mac

1. Install and open [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/).
2. Extract this project and open Terminal in the `expensave` folder.
3. Build and start:

```bash
docker compose up -d --build
```

4. Open **http://localhost:3000**.
5. Complete the two-step quick setup for your name, timezone, income, payday, and safety buffer, then add your first wallet and opening balance. You can also select **Explore a demo** during setup. To leave the demo, use **Settings → Clear all financial data** and confirm.

The first build downloads dependencies. Subsequent use works offline, including fonts, icons, budgeting, projections, quick entry, and your meal collection.

```bash
# View status and logs
docker compose ps
docker compose logs --tail=100

# Stop the app; data remains
docker compose stop

# Start it again
docker compose start
```

The named `expensave-data` volume stores `/app/data/expensave.sqlite` and SQLite's WAL files. Container replacement preserves the volume. **Do not use `docker compose down -v` unless you intend to erase its data.** Download a JSON backup in Settings before updates, resets, or restores.

If port 3000 is busy, change the compose mapping to `127.0.0.1:3001:3000`, then use http://localhost:3001.

## Publish your image to Docker Hub

This source package has not been uploaded to Docker Hub. Replace `YOUR_DOCKERHUB` below with your namespace. Log in locally; never place your token in a Dockerfile or source file.

```bash
docker login

# Create once; on subsequent runs select the existing builder.
docker buildx create --name expensave-builder --driver docker-container --use
docker buildx inspect --bootstrap

docker buildx build \
  --platform linux/arm64,linux/amd64 \
  -t YOUR_DOCKERHUB/expensave:0.1.0 \
  --push .
```

Apple Silicon uses `linux/arm64`; Intel Macs use `linux/amd64`. The image also targets Linux hosts with those architectures. Test both platforms before publishing a general release. Node's built-in SQLite avoids a separate database container and third-party native SQLite compilation.

After publication, users only need:

```bash
docker pull YOUR_DOCKERHUB/expensave:0.1.0

docker run -d \
  --name expensave \
  --init \
  --restart unless-stopped \
  --security-opt no-new-privileges:true \
  --cap-drop ALL \
  -p 127.0.0.1:3000:3000 \
  -v expensave-data:/app/data \
  YOUR_DOCKERHUB/expensave:0.1.0
```

For image upgrades, download a backup, pull the new version, stop/remove the old container, and run the new version with the **same volume name**. The Compose-managed volume typically has a project-name prefix; do not accidentally switch to a different empty volume when changing from Compose to `docker run`. Use `docker volume ls` to identify it. Never run two app versions against the same database simultaneously. Future schema changes require versioned migrations and a backup-first upgrade path; this release creates schema version 1 and rejects newer schemas.

## Dashboard design

The dashboard is the home for every feature. There is no sidebar or page-navigation menu. A minimal top bar holds the brand, primary action, and Settings. Large balance and daily-allowance cards lead into a row of feature pills and a horizontal rail of enlarged wallets. Activity and weekly spending sit below, followed by budget, goal, and meal cards.

Select **Activity**, **Budgets & bills**, **Goals**, **Meal ideas**, **Insights**, or **Manage wallets** to open its panel over the dashboard. Select the **X** or press Escape to return. On small screens, feature panels fill the display and wallets scroll horizontally. The palette follows a 60:30:10 visual hierarchy: warm neutral canvas and supporting surfaces, sage feature surfaces, and emerald actions and wallet pockets. Google Labs informs the larger type and generous spacing. Cards use soft elevation; bank cards sit in layered pockets with decorative stitching. Account and goal accent choices stay within the emerald family.

Quick setup appears before the dashboard until completed. Existing workspaces and older backups prefill their saved details on the first visit after this update. Completion persists in SQLite and financial backups. Expected income is for planning and creates no transactions. The onboarding flow is only for first-time setup. Edit these details directly in **Settings → Your everyday plan** and select **Save preferences**. Closing Settings discards unsaved changes. Clearing financial data preserves the completed setup and preferences.

Roboto is a Google font, bundled locally to preserve offline operation. No Google Fonts network request is made.

## Included features

- Dashboard with net spending, income, daily allowance, weekly expense chart, upcoming bills, and recent transactions.
- Manual bank, cash, and credit-card wallets with customizable colors and optional last four digits.
- Create, edit, delete, search, filter, and page through transactions.
- Income, expenses, refunds, and atomic two-wallet transfers.
- Offline quick entry for phrases such as **30 pesos for food**, **20 pesos for transpo**, and **transferred 500 from BPI to BDO**, with category detection, wallet selection, and a live preview.
- Monthly category budgets and overspending indicators.
- Bills and subscriptions; marking a bill paid records an expense and advances monthly due dates.
- Savings goals that reserve existing money.
- Explainable daily allowance and before-payday balance scenarios.
- An empty-by-default meal collection: add, edit, and delete your own meals, costs, ingredients, and instructions; search or filter by budget and servings. No recipes are preloaded, including in demo mode.
- Full JSON financial backup/restore and CSV transaction export.
- Explicit sample-data loading and confirmed workspace reset.
- All fonts and icons served locally. No trackers or external runtime services.

## Quick entry

On the dashboard, describe one transaction and press **Enter** or **Log**. For example: `30 pesos for food`, `20 pesos for transpo from Cash`, or `transfer 500 from BPI to BDO`. The preview shows the amount, category, and affected wallets. Override the wallet or category using the selectors before saving. One wallet can be selected automatically; with multiple wallets, choose one or name it in the entry. Ambiguous wallet names require selection.

Quick entry records today in your configured timezone and uses the same ledger as the detailed form. Expenses deduct from the source wallet; transfers move funds between both wallets without adding spending. It recognizes a fixed set of everyday English and Filipino terms locally. Use the detailed transaction form for other dates or descriptions it cannot recognize. Invalid amounts and unresolved transfers create no transaction.

## Accounting behavior

Amounts are integer centavos in SQLite. An account's balance is its opening balance plus posted entries. Transfers write both entries in one database transaction; they do not count as income or expenses. Editing/deleting a transaction updates/reverses its entries atomically. A refund adds money back and reduces spending for its recorded category and month.

For credit cards, purchases create a negative balance (debt). The wallet form shows opening **debt** as a positive input. Repay a credit card with a transfer from the paying bank account to the credit-card account. Do not enter the repayment as another expense or as a scheduled expense bill.

Bills represent future **expenses**, not transfers or income. A payment is recorded today. When monthly dates fall on nonexistent dates, the date is clamped to the last valid day of the next month; following months use that adjusted day (January 31 → February 28 → March 28). An overdue recurring bill advances only one month per recorded payment, preserving arrears. Deleting a payment transaction reverses its account entries but does not automatically reopen the associated bill; edit its due date if needed.

Transactions cannot be future-dated. A wallet containing transactions cannot be deleted until those transactions are removed or moved. Opening-balance edits intentionally change the current balance, so treat them as corrections.

## How the insights work

```
available = cash and bank balances
            - current credit-card debt
            - goals' reserved amounts
            - safety buffer
            - unpaid bills through next payday

daily allowance = max(0, floor(available / days until payday))
```

The next income is excluded until it is actually recorded. Savings goals represent reserved money already included in your wallet balances, not additional assets. Monthly category budgets are limits, not a second set of money reservations. A zero/negative payday horizon asks you to update the date instead of dividing by zero.

The forecast starts with liquid balances less card debt and unpaid bills, then subtracts recent variable spending per day through payday. It uses up to 30 days of history. Categories appearing in scheduled bills are excluded from the variable-spending average to reduce double counting; this can underestimate variable costs if you mix bills and everyday spending in one category. Sparse-history estimates are labelled. The ±25% range is a scenario range, not a confidence interval. Forecasts do not automatically reallocate budgets.

Meal collections start empty. Only meals you create are stored. Meals and their per-serving costs, ingredients, and instructions persist in SQLite and JSON backups. Restoring an older backup without meals produces an empty collection. Creating a meal does not record an expense; use Quick entry or Add transaction when you spend money.

## Apple Intelligence

Apple exposes its on-device language model through the native Foundation Models API and checks device/model availability. This Docker app runs Linux and does not directly use that native macOS model. A separately installed Swift macOS helper would be required for such an integration. As requested, this version skips it and makes no AI or cloud calls.

- [Apple Foundation Models](https://developer.apple.com/documentation/foundationmodels)
- [Apple model availability](https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel)

A future optional native helper could categorize transaction text or explain a budget, but all authoritative money calculations should remain deterministic.

## Development

Use **Node.js 24** (matching the Docker image) and npm.

```bash
npm ci
npm run build
npm start
```

For two-terminal hot-reload development:

```bash
# Terminal 1: API on localhost:3000
npm run dev

# Terminal 2: UI, visit http://localhost:5173
npm run dev:ui
```

Vite proxies `/api` with the original host preserved for same-origin checks. The development server's UI port is not intended for Docker distribution. Production Fastify serves both the built UI and the API.

```bash
npm test          # Ledger, persistence, security, HTTP API checks
npm run test:ui   # DOM-based component integration tests
npm run build    # Type-check and compile client/server
```

### Structure

```
src/client/App.tsx      UI screens, forms and local interaction
src/client/Onboarding.tsx First-time profile and financial-plan setup
src/client/QuickEntry.tsx Plain-language transaction entry
src/client/Meals.tsx     User-managed meal collection
src/server/quick-entry.ts Local amount, category and wallet parsing
src/client/main.tsx     React entry point and theme setup
src/client/style.css    Responsive visual system
src/server/index.ts    Fastify routes, validation boundaries and local access
src/server/store.ts    SQLite repository, ledger services and budget calculations
tests/                 Financial/API and component interaction tests
Dockerfile             Multi-stage build; non-root runtime
compose.yaml           Localhost-only publishing and persistent named volume
```

This is a small modular monolith: the interface calls API routes; routes delegate to validated application/ledger services; those services use prepared SQLite statements. SQLite uses WAL, foreign keys, a busy timeout, and indexes on date/account entries. Node's built-in SQLite is used directly instead of adding an ORM to this first release. Frontend and server share TypeScript data types.

### Local access and scope

The app binds to loopback through Docker, rejects unrecognized Host headers and cross-origin mutations, and requires an application header on writes. It is designed for a trusted single-user computer. It has no multi-user authentication, bank synchronization, cloud sync, currency conversion, receipt OCR, CSV import, automatic AI, or encryption layer. PHP is the single currency in v0.1.0. Protect downloaded backups and the host account as you would other financial records.

Transactions are paginated in the interface after fetching the local workspace; this MVP is intended for personal datasets. Server-side pagination and SQL aggregation are sensible next steps for substantially larger histories.

## Validation status

See `VALIDATION.md` for the checks actually run. Docker and real macOS browser testing must be completed on your Mac before calling this a tested Mac release.
