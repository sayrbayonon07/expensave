import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/server/store.js";
import { parseQuickEntry } from "../src/server/quick-entry.js";
import { createApp } from "../src/server/index.js";

function workspace() {
  const store = new Store(":memory:");
  const source = store.account({
    name: "Everyday",
    bank: "BPI",
    type: "bank",
    opening: 100000,
    color: "#087f5b",
  });
  const destination = store.account({
    name: "Savings",
    bank: "BDO",
    type: "bank",
    opening: 0,
    color: "#087f5b",
  });
  return { store, source, destination };
}
test("quick entry reads peso amounts, everyday categories, refunds and transfers", () => {
  const { store, source, destination } = workspace();
  const accounts = store.state().accounts;
  assert.deepEqual(
    parseQuickEntry({ text: "30 pesos for food", accountId: source }, accounts),
    {
      kind: "expense",
      amount: 3000,
      category: "Food",
      accountId: source,
      toAccountId: null,
      note: "30 pesos for food",
    },
  );
  assert.equal(
    parseQuickEntry({ text: "20 pesos for transpo from BPI" }, accounts)
      .category,
    "Transport",
  );
  assert.equal(
    parseQuickEntry(
      { text: "₱1,250.50 for groceries", accountId: source },
      accounts,
    ).amount,
    125050,
  );
  assert.equal(
    parseQuickEntry(
      { text: "refund 50 for lunch", accountId: source },
      accounts,
    ).kind,
    "refund",
  );
  const transfer = parseQuickEntry(
    { text: "transfered 200 pesos from BPI to Savings" },
    accounts,
  );
  assert.equal(transfer.kind, "transfer");
  assert.equal(transfer.accountId, source);
  assert.equal(transfer.toAccountId, destination);
  assert.equal(
    parseQuickEntry(
      { text: "30 for something", accountId: source, category: "Health" },
      accounts,
    ).category,
    "Health",
  );
  store.close();
});
test("quick entry rejects unclear money and ambiguous or unknown wallets", () => {
  const { store, source } = workspace();
  const accounts = store.state().accounts;
  for (const text of [
    "food",
    "30 food and 20 transpo",
    "-30 food",
    "- 30 food",
    ".50 food",
    "30.000 food",
    "1,00 food",
    "$30 food",
    "30 cents food",
    "30 food yesterday",
    "0 food",
    "100000001 food",
  ]) {
    assert.throws(
      () => parseQuickEntry({ text, accountId: source }, accounts),
      Error,
      text,
    );
  }
  assert.throws(
    () => parseQuickEntry({ text: "30 food" }, accounts),
    /source wallet/,
  );
  assert.throws(
    () =>
      parseQuickEntry({ text: "transfer 30 from BPI to unknown" }, accounts),
    /not recognized/,
  );
  assert.throws(
    () => parseQuickEntry({ text: "transfer 30 from BPI to BPI" }, accounts),
    /different wallets/,
  );
  store.account({
    name: "Second BPI",
    bank: "BPI",
    type: "bank",
    opening: 0,
    color: "#087f5b",
  });
  assert.throws(
    () => parseQuickEntry({ text: "30 food from BPI" }, store.state().accounts),
    /More than one wallet/,
  );
  assert.equal(store.state().transactions.length, 0);
  store.close();
});
test("quick-entry API updates the ledger once and transfers conserve total cash", async () => {
  const { store, source, destination } = workspace();
  const app = createApp(store);
  const post = (payload: Record<string, unknown>) =>
    app.inject({
      method: "POST",
      url: "/api/transactions/quick",
      headers: { "x-expensave-client": "1" },
      payload,
    });
  assert.equal(
    (await post({ text: "30 pesos for food from Everyday" })).statusCode,
    200,
  );
  assert.equal(
    (await post({ text: "20 pesos for transpo", accountId: source }))
      .statusCode,
    200,
  );
  const transfer = await post({ text: "transferred 200 from BPI to BDO" });
  assert.equal(transfer.statusCode, 200, transfer.body);
  const state = store.state();
  assert.equal(state.accounts.find((a) => a.id === source)!.balance, 75000);
  assert.equal(
    state.accounts.find((a) => a.id === destination)!.balance,
    20000,
  );
  assert.equal(state.transactions.length, 3);
  assert.ok(state.transactions.every((t) => t.date === state.today));
  assert.deepEqual(
    state.transactions
      .filter((t) => t.kind === "expense")
      .map((t) => t.category)
      .sort(),
    ["Food", "Transport"],
  );
  assert.equal(
    (await post({ text: "transfer 50 from BPI to missing" })).statusCode,
    400,
  );
  assert.equal(store.state().transactions.length, 3);
  assert.equal(
    store.state().accounts.find((a) => a.id === source)!.balance,
    75000,
  );
  await app.close();
  store.close();
});
test("meals start empty and user recipes support CRUD, backups, legacy restore and validation", async () => {
  const store = new Store(":memory:");
  const app = createApp(store);
  assert.deepEqual(store.state().meals, []);
  store.demo();
  assert.deepEqual(store.state().meals, []);
  const meal = {
    name: "My lunch",
    cost: 3550,
    time: 15,
    tag: "Any",
    ingredients: "My ingredients",
    steps: "My instructions",
  };
  const result = await app.inject({
    method: "POST",
    url: "/api/meals",
    headers: { "x-expensave-client": "1" },
    payload: meal,
  });
  assert.equal(result.statusCode, 200);
  const id = result.json().id;
  const update = await app.inject({
    method: "PUT",
    url: "/api/meals/" + id,
    headers: { "x-expensave-client": "1" },
    payload: { ...meal, cost: 4000 },
  });
  assert.equal(update.statusCode, 200);
  assert.equal(store.state().meals[0].cost, 4000);
  const backup = store.backup();
  store.restore(backup);
  assert.equal(store.state().meals[0].steps, meal.steps);
  const invalid = await app.inject({
    method: "POST",
    url: "/api/meals",
    headers: { "x-expensave-client": "1" },
    payload: { ...meal, cost: -1 },
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(store.state().meals.length, 1);
  const removed = await app.inject({
    method: "DELETE",
    url: "/api/meals/" + id,
    headers: { "x-expensave-client": "1" },
  });
  assert.equal(removed.statusCode, 200);
  assert.deepEqual(store.state().meals, []);
  const legacy: Partial<typeof backup> = { ...backup };
  delete legacy.meals;
  store.restore(legacy);
  assert.deepEqual(store.state().meals, []);
  await app.close();
  store.close();
});
