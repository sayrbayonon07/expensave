import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store, insights, nextMonth } from "../src/server/store.js";
import { createApp } from "../src/server/index.js";
function setup() {
  const s = new Store(":memory:");
  const a = s.account({
    name: "Everyday",
    bank: "BPI",
    type: "bank",
    opening: 100000,
    color: "#008b65",
  });
  const b = s.account({
    name: "Savings",
    bank: "MariBank",
    type: "bank",
    opening: 0,
    color: "#ea713d",
  });
  return { s, a, b };
}
function tx(
  s: Store,
  accountId: string,
  amount: number,
  kind = "expense",
  extra = {},
) {
  return {
    kind,
    accountId,
    amount,
    date: s.state().today,
    category: "Food",
    note: "Test",
    ...extra,
  };
}
test("transfers preserve total money and do not count as spending or income", () => {
  const { s, a, b } = setup();
  s.transaction(tx(s, a, 12345, "transfer", { toAccountId: b }));
  const state = s.state();
  assert.equal(state.accounts.find((x) => x.id === a)!.balance, 87655);
  assert.equal(state.accounts.find((x) => x.id === b)!.balance, 12345);
  assert.equal(insights(state).netWorth, 100000);
  assert.equal(insights(state).spent, 0);
  assert.equal(insights(state).income, 0);
  s.close();
});
test("credit purchases create debt; card repayments are transfers", () => {
  const { s, a } = setup();
  const card = s.account({
    name: "Card",
    bank: "BPI",
    type: "credit",
    opening: 0,
    color: "#8c2434",
  });
  s.transaction(tx(s, card, 25000));
  assert.equal(insights(s.state()).debt, 25000);
  s.transaction(tx(s, a, 25000, "transfer", { toAccountId: card }));
  assert.equal(insights(s.state()).debt, 0);
  assert.equal(insights(s.state()).spent, 25000);
  s.close();
});
test("editing and deleting transactions updates balances exactly once", () => {
  const { s, a } = setup();
  const id = s.transaction(tx(s, a, 10001));
  s.transaction(tx(s, a, 20002), id);
  assert.equal(s.state().accounts[0].balance, 79998);
  s.remove("transactions", id);
  assert.equal(s.state().accounts[0].balance, 100000);
  s.close();
});
test("refunds restore cash and reduce spending, not income", () => {
  const { s, a } = setup();
  s.transaction(tx(s, a, 12500));
  s.transaction(tx(s, a, 2500, "refund"));
  assert.equal(insights(s.state()).spent, 10000);
  assert.equal(insights(s.state()).income, 0);
  assert.equal(s.state().accounts[0].balance, 90000);
  s.close();
});
test("invalid transfers leave both balances unchanged", () => {
  const { s, a } = setup();
  assert.throws(() =>
    s.transaction(tx(s, a, 1000, "transfer", { toAccountId: a })),
  );
  assert.throws(() =>
    s.transaction(tx(s, a, 1000, "transfer", { toAccountId: "missing" })),
  );
  assert.equal(s.state().transactions.length, 0);
  assert.equal(s.state().accounts[0].balance, 100000);
  s.close();
});
test("rejects fractional cents, negative amounts, invalid dates, future dates", () => {
  const { s, a } = setup();
  for (const amount of [-1, 0, 1.5])
    assert.throws(() => s.transaction(tx(s, a, amount)));
  assert.throws(() =>
    s.transaction(tx(s, a, 100, "expense", { date: "2026-02-30" })),
  );
  assert.throws(() =>
    s.transaction(tx(s, a, 100, "expense", { date: "2099-01-01" })),
  );
  s.close();
});
test("wallets with financial history cannot be removed", () => {
  const { s, a } = setup();
  s.transaction(tx(s, a, 100));
  assert.throws(() => s.remove("accounts", a));
  s.close();
});
test("bill payment is atomic and duplicate submissions are rejected", () => {
  const { s, a } = setup();
  const due = s.state().today;
  const id = s.resource("bills", {
    name: "Internet",
    amount: 10000,
    due,
    category: "Utilities",
    monthly: true,
  });
  assert.throws(() => s.payBill(id, "missing", due));
  assert.equal(s.state().bills[0].due, due);
  s.payBill(id, a, due);
  assert.equal(s.state().bills[0].due, nextMonth(due));
  assert.equal(s.state().transactions.length, 1);
  assert.throws(() => s.payBill(id, a, due));
  assert.equal(s.state().transactions.length, 1);
  s.close();
});
test("month-end schedules clamp to a valid next month date", () => {
  assert.equal(nextMonth("2026-01-31"), "2026-02-28");
  assert.equal(nextMonth("2028-01-31"), "2028-02-29");
  assert.equal(nextMonth("2026-12-31"), "2027-01-31");
});
test("daily allowance reserves goals, buffer, card debt and unpaid bills", () => {
  const { s, a } = setup();
  const state = s.state();
  const payday = new Date(state.today + "T12:00:00Z");
  payday.setUTCDate(payday.getUTCDate() + 10);
  s.put("settings", "profile", {
    ...state.settings,
    payday: payday.toISOString().slice(0, 10),
    buffer: 10000,
  });
  s.resource("goals", {
    name: "Trip",
    target: 50000,
    saved: 20000,
    color: "#008b65",
  });
  s.resource("bills", {
    name: "Phone",
    amount: 10000,
    due: state.today,
    category: "Utilities",
    monthly: false,
  });
  s.account({
    name: "Card",
    bank: "BPI",
    type: "credit",
    opening: -10000,
    color: "#8c2434",
  });
  const i = insights(s.state());
  assert.equal(i.available, 50000);
  assert.equal(i.daily, 5000);
  s.payBill(s.state().bills[0].id, a, state.today);
  assert.equal(insights(s.state()).available, 50000);
  s.close();
});
test("backup restore reconstructs entries and rolls back a corrupt backup", () => {
  const { s, a, b } = setup();
  s.transaction(tx(s, a, 1234, "transfer", { toAccountId: b }));
  const backup = s.backup();
  const copy = new Store(":memory:");
  copy.restore(backup);
  assert.deepEqual(copy.state().accounts, s.state().accounts);
  assert.deepEqual(copy.state().transactions, s.state().transactions);
  const broken = structuredClone(backup);
  broken.transactions[0].accountId = "missing";
  assert.throws(() => copy.restore(broken));
  assert.deepEqual(copy.state().accounts, s.state().accounts);
  const duplicate = structuredClone(backup);
  duplicate.accounts.push(duplicate.accounts[0]);
  assert.throws(() => copy.restore(duplicate));
  copy.close();
  s.close();
});
test("monthly category budgets are unique ignoring letter case", () => {
  const { s } = setup();
  const month = s.state().today.slice(0, 7);
  s.resource("budgets", { category: "Food", amount: 10000, month });
  assert.throws(() =>
    s.resource("budgets", { category: "food", amount: 20000, month }),
  );
  s.close();
});
test("data survives closing and reopening the database", () => {
  const dir = mkdtempSync(join(tmpdir(), "expensave-"));
  const path = join(dir, "data.sqlite");
  const s = new Store(path);
  const id = s.account({
    name: "Cash",
    bank: "Cash",
    type: "cash",
    opening: 5000,
    color: "#008b65",
  });
  s.transaction(tx(s, id, 125));
  s.put("settings", "profile", {
    ...s.state().settings,
    onboardingCompleted: true,
  });
  s.close();
  const reopened = new Store(path);
  assert.equal(reopened.state().accounts[0].balance, 4875);
  assert.equal(reopened.state().settings.onboardingCompleted, true);
  reopened.close();
  rmSync(dir, { recursive: true });
});
test("onboarding status round-trips in backups and defaults safely for older workspaces", () => {
  const s = new Store(":memory:");
  assert.equal(s.state().settings.onboardingCompleted, false);
  const legacy = { ...s.state().settings } as Partial<
    ReturnType<Store["state"]>["settings"]
  >;
  delete legacy.onboardingCompleted;
  s.put("settings", "profile", {
    ...legacy,
    name: "Existing user",
    expectedIncome: 3000000,
  });
  assert.equal(s.state().settings.onboardingCompleted, false);
  assert.equal(s.state().settings.name, "Existing user");
  const backup = s.backup();
  const oldBackup = structuredClone(backup) as {
    settings: Partial<typeof backup.settings>;
  };
  delete oldBackup.settings.onboardingCompleted;
  s.restore(oldBackup);
  assert.equal(s.state().settings.expectedIncome, 3000000);
  assert.equal(s.state().settings.onboardingCompleted, false);
  s.put("settings", "profile", {
    ...s.state().settings,
    onboardingCompleted: true,
  });
  s.restore(s.backup());
  assert.equal(s.state().settings.onboardingCompleted, true);
  s.close();
});
test("demo is opt-in and cannot overwrite an existing workspace", () => {
  const s = new Store(":memory:");
  assert.equal(s.state().accounts.length, 0);
  s.demo();
  assert.equal(s.state().accounts.length, 3);
  assert.ok(s.state().transactions.length);
  assert.throws(() => s.demo());
  s.close();
});
test("HTTP API validates writes, rejects foreign origins and serves the compiled app", async () => {
  const { s, a } = setup();
  const app = createApp(s);
  const health = await app.inject("/api/health");
  assert.equal(health.statusCode, 200);
  const rejected = await app.inject({
    method: "POST",
    url: "/api/transactions",
    payload: tx(s, a, 100),
  });
  assert.equal(rejected.statusCode, 403);
  const foreign = await app.inject({
    method: "POST",
    url: "/api/transactions",
    headers: { "x-expensave-client": "1", origin: "https://example.com" },
    payload: tx(s, a, 100),
  });
  assert.equal(foreign.statusCode, 403);
  const hostileHost = await app.inject({
    url: "/api/state",
    headers: { host: "example.com" },
  });
  assert.equal(hostileHost.statusCode, 403);
  const ok = await app.inject({
    method: "POST",
    url: "/api/transactions",
    headers: { "x-expensave-client": "1" },
    payload: tx(s, a, 100),
  });
  assert.equal(ok.statusCode, 200);
  const csv = await app.inject("/api/export.csv");
  assert.equal(csv.statusCode, 200);
  assert.match(csv.body, /Date/);
  const html = await app.inject("/");
  assert.equal(html.statusCode, 200);
  assert.match(html.body, /Expensave/);
  const state = await app.inject("/api/state");
  assert.equal(state.json().insights.spent, 100);
  await app.close();
  s.close();
});

test("workspace reset requires explicit confirmation and preserves preferences", async () => {
  const { s, a } = setup();
  s.transaction(tx(s, a, 100));
  const preferences = s.state().settings;
  const app = createApp(s);
  const headers = { "x-expensave-client": "1" };
  const rejected = await app.inject({
    method: "POST",
    url: "/api/reset",
    headers,
    payload: {},
  });
  assert.equal(rejected.statusCode, 400);
  assert.equal(s.state().transactions.length, 1);
  const ok = await app.inject({
    method: "POST",
    url: "/api/reset",
    headers,
    payload: { confirmation: "DELETE ALL DATA" },
  });
  assert.equal(ok.statusCode, 200);
  assert.equal(s.state().accounts.length, 0);
  assert.equal(s.state().transactions.length, 0);
  assert.deepEqual(s.state().settings, preferences);
  await app.close();
  s.close();
});
