import React from "react";
import { beforeEach, afterEach, test, expect, vi } from "vitest";
import {
  render,
  screen,
  within,
  cleanup,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material";
import { App, theme } from "../src/client/App";
import { Store } from "../src/server/store";
import { createApp } from "../src/server/index";
let store: Store;
let app: ReturnType<typeof createApp>;
beforeEach(() => {
  store = new Store(":memory:");
  app = createApp(store);
  vi.stubGlobal("fetch", async (url: string, options: RequestInit = {}) => {
    const response = await app.inject({
      method: (options.method || "GET") as "GET" | "POST" | "PUT" | "DELETE",
      url,
      headers: options.headers as Record<string, string>,
      payload: options.body as string | undefined,
    });
    return { ok: response.statusCode < 400, json: async () => response.json() };
  });
  window.scrollTo = () => {};
  render(
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>,
  );
});
afterEach(async () => {
  cleanup();
  await app.close();
  store.close();
  vi.unstubAllGlobals();
});
async function completeSetup(
  user: ReturnType<typeof userEvent.setup>,
  name = "Alex",
) {
  await user.type(
    await screen.findByLabelText("What should we call you? *"),
    name,
  );
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Open my dashboard" }));
  await screen.findByText("A fresh start for your finances.");
}
test("create a wallet, record an expense, then edit and delete it through the interface", async () => {
  const user = userEvent.setup();
  await completeSetup(user);
  await user.click(screen.getByRole("button", { name: "Add wallet" }));
  let dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByLabelText("Wallet name *"), "Everyday");
  const opening = within(dialog).getByLabelText("Opening balance (₱) *");
  await user.clear(opening);
  await user.type(opening, "1000");
  await user.click(
    within(dialog).getByRole("button", { name: "Create wallet" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(store.state().accounts[0].balance).toBe(100000);
  await user.click(screen.getByRole("button", { name: "Add transaction" }));
  dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByLabelText("Amount (₱) *"), "125.50");
  await user.type(
    within(dialog).getByLabelText("Note (optional)"),
    "Campus lunch",
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Create transaction" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(store.state().accounts[0].balance).toBe(87450);
  await user.click(screen.getByRole("button", { name: "Activity" }));
  await user.click(screen.getByRole("button", { name: /^Campus lunch/ }));
  dialog = screen.getByRole("dialog");
  const amount = within(dialog).getByLabelText("Amount (₱) *");
  await user.clear(amount);
  await user.type(amount, "100");
  await user.click(
    within(dialog).getByRole("button", { name: "Save changes" }),
  );
  await waitFor(() =>
    expect(screen.queryByText("Edit transaction")).toBeNull(),
  );
  expect(store.state().accounts[0].balance).toBe(90000);
  await user.click(screen.getByRole("button", { name: "Delete Campus lunch" }));
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm" }),
  );
  await waitFor(() => expect(store.state().transactions).toHaveLength(0));
  expect(store.state().accounts[0].balance).toBe(100000);
});
test("demo navigation renders budgets, goals, offline insights, meals and settings", async () => {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "Explore a demo" }),
  );
  await screen.findByText("Hello, friend.");
  expect(document.querySelector("aside")).toBeNull();
  const done = async () => {
    expect(
      within(screen.getByRole("dialog")).queryByText("expensave"),
    ).toBeNull();
    const close = screen.getByRole("button", { name: "Close panel" });
    expect(close.textContent).toBe("");
    await user.click(close);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  };
  await user.click(screen.getByRole("button", { name: "Budgets & bills" }));
  await screen.findByText("Bills & subscriptions");
  await done();
  await user.click(screen.getByRole("button", { name: "Goals" }));
  await screen.findByText("Emergency fund");
  await done();
  await user.click(screen.getByRole("button", { name: "Insights" }));
  await screen.findByText("Clarity, without the crystal ball.");
  await done();
  await user.click(screen.getByRole("button", { name: "Meal ideas" }));
  await screen.findByText("Your menu starts here");
  await done();
  await user.click(screen.getAllByRole("button", { name: "Settings" })[0]);
  await screen.findByText("Your everyday plan");
  const name = screen.getByLabelText("What should we call you? *");
  await user.clear(name);
  await user.type(name, "Sire");
  await user.click(screen.getByRole("button", { name: "Save preferences" }));
  await waitFor(() => expect(store.state().settings.name).toBe("Sire"));
});

test("quick entry logs food and transport and a whole wallet card opens its editor", async () => {
  const user = userEvent.setup();
  await completeSetup(user);
  store.account({
    name: "Cash",
    bank: "Cash",
    type: "cash",
    opening: 100000,
    color: "#087f5b",
  });
  window.dispatchEvent(new Event("focus"));
  const input = await screen.findByLabelText("Describe a transaction *");
  await user.type(input, "30 pesos for food");
  expect(screen.getByRole("combobox", { name: "Category" }).textContent).toContain("Auto · Food");
  await user.click(screen.getByRole("button", { name: "Log" }));
  await waitFor(() => expect(store.state().transactions).toHaveLength(1));
  expect(store.state().transactions[0].category).toBe("Food");
  expect(store.state().accounts[0].balance).toBe(97000);
  await waitFor(() => expect((input as HTMLInputElement).value).toBe(""));
  await user.type(input, "20 pesos for transpo{Enter}");
  await waitFor(() => expect(store.state().transactions).toHaveLength(2));
  expect(store.state().accounts[0].balance).toBe(95000);
  await waitFor(() => expect((input as HTMLInputElement).value).toBe(""));
  store.account({
    name: "Savings",
    bank: "BDO",
    type: "bank",
    opening: 0,
    color: "#087f5b",
  });
  window.dispatchEvent(new Event("focus"));
  await screen.findByRole("button", { name: "Open Savings wallet" });
  await user.type(input, "transfered 50 from Cash to Savings");
  await screen.findByLabelText("To wallet");
  await user.click(screen.getByRole("button", { name: "Log" }));
  await waitFor(() => expect((input as HTMLInputElement).value).toBe(""));
  expect(store.state().accounts.find((a) => a.name === "Cash")!.balance).toBe(
    90000,
  );
  expect(
    store.state().accounts.find((a) => a.name === "Savings")!.balance,
  ).toBe(5000);
  expect(
    store.state().transactions.filter((t) => t.kind === "transfer"),
  ).toHaveLength(1);
  const card = screen.getByRole("button", { name: "Open Cash wallet" });
  card.focus();
  await user.keyboard("{Enter}");
  await screen.findByText("Edit wallet");
  await user.click(screen.getByRole("button", { name: "Close dialog" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await user.click(card);
  await screen.findByText("Edit wallet");
});

test("meal collection starts empty, saves user food, edits it and deletes it", async () => {
  const user = userEvent.setup();
  await completeSetup(user);
  await user.click(screen.getByRole("button", { name: "Meal ideas" }));
  await screen.findByText("Your menu starts here");
  expect(store.state().meals).toHaveLength(0);
  await user.click(screen.getByRole("button", { name: "Add meal" }));
  let editor = screen.getByRole("dialog", { name: "Add a meal" });
  await user.type(within(editor).getByLabelText("Meal name *"), "My lunch");
  await user.type(
    within(editor).getByLabelText("Cost per serving (₱) *"),
    "45",
  );
  await user.type(
    within(editor).getByLabelText("Ingredients (optional)"),
    "My own ingredients",
  );
  await user.click(within(editor).getByRole("button", { name: "Save meal" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Add a meal" })).toBeNull(),
  );
  expect(store.state().meals[0].cost).toBe(4500);
  await user.click(screen.getByRole("button", { name: "Edit My lunch meal" }));
  editor = screen.getByRole("dialog", { name: "Edit meal" });
  const cost = within(editor).getByLabelText("Cost per serving (₱) *");
  await user.clear(cost);
  await user.type(cost, "50");
  await user.click(within(editor).getByRole("button", { name: "Save meal" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Edit meal" })).toBeNull(),
  );
  expect(store.state().meals[0].cost).toBe(5000);
  await user.click(await screen.findByRole("button", { name: "Close panel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await user.click(screen.getByRole("button", { name: "Meal ideas" }));
  await screen.findByRole("button", { name: "Edit My lunch meal" });
  await user.click(
    screen.getByRole("button", { name: "Delete My lunch meal" }),
  );
  await user.click(
    within(screen.getByRole("dialog", { name: "Delete meal?" })).getByRole(
      "button",
      { name: "Delete meal" },
    ),
  );
  await screen.findByText("Your menu starts here");
  expect(store.state().meals).toHaveLength(0);
});

test("onboarding preserves back navigation, saves planning details without income, and stays complete after reload", async () => {
  const user = userEvent.setup();
  expect(
    screen.queryByRole("navigation", { name: "Dashboard features" }),
  ).toBeNull();
  await user.type(
    await screen.findByLabelText("What should we call you? *"),
    "Ada",
  );
  await user.click(screen.getByRole("button", { name: "Continue" }));
  const income = screen.getByLabelText("Expected income on payday (₱) *");
  await user.clear(income);
  await user.type(income, "30000");
  const buffer = screen.getByLabelText("Safety buffer (₱) *");
  await user.clear(buffer);
  await user.type(buffer, "1000");
  await user.click(screen.getByRole("button", { name: "Back" }));
  expect(
    (screen.getByLabelText("What should we call you? *") as HTMLInputElement)
      .value,
  ).toBe("Ada");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(
    (
      screen.getByLabelText(
        "Expected income on payday (₱) *",
      ) as HTMLInputElement
    ).value,
  ).toBe("30000");
  await user.click(screen.getByRole("button", { name: "Open my dashboard" }));
  await screen.findByText("Hello, Ada.");
  expect(store.state().settings).toMatchObject({
    name: "Ada",
    expectedIncome: 3000000,
    buffer: 100000,
    onboardingCompleted: true,
  });
  expect(store.state().transactions).toHaveLength(0);
  expect(store.state().accounts).toHaveLength(0);
  cleanup();
  render(
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>,
  );
  await screen.findByText("Hello, Ada.");
  expect(screen.queryByText("Let’s make it yours.")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Settings" }));
  await user.clear(screen.getByLabelText("What should we call you? *"));
  await user.type(
    screen.getByLabelText("What should we call you? *"),
    "Unsaved",
  );
  await user.click(screen.getByRole("button", { name: "Close panel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(store.state().settings.name).toBe("Ada");
  await user.click(screen.getByRole("button", { name: "Settings" }));
  expect(
    (screen.getByLabelText("What should we call you? *") as HTMLInputElement)
      .value,
  ).toBe("Ada");
  expect(screen.queryByText("Let’s make it yours.")).toBeNull();
});

test("failed setup remains on screen and can be retried", async () => {
  const user = userEvent.setup();
  await user.type(
    await screen.findByLabelText("What should we call you? *"),
    "Sam",
  );
  await user.click(screen.getByRole("button", { name: "Continue" }));
  const originalFetch = globalThis.fetch;
  vi.stubGlobal("fetch", async (url: string, options?: RequestInit) =>
    url === "/api/settings"
      ? {
          ok: false,
          json: async () => ({ error: "Could not save setup. Try again." }),
        }
      : originalFetch(url, options),
  );
  await user.click(screen.getByRole("button", { name: "Open my dashboard" }));
  await screen.findByText("Could not save setup. Try again.");
  expect(store.state().settings.onboardingCompleted).toBe(false);
  expect(
    screen.queryByRole("navigation", { name: "Dashboard features" }),
  ).toBeNull();
  vi.stubGlobal("fetch", originalFetch);
  await user.click(screen.getByRole("button", { name: "Open my dashboard" }));
  await screen.findByText("Hello, Sam.");
});
