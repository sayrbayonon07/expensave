import type { Account } from "./store.js";

export const entryCategories = [
  "Food",
  "Groceries",
  "Transport",
  "Shopping",
  "Utilities",
  "Housing",
  "Health",
  "Education",
  "Entertainment",
  "Salary",
  "Other",
];
export type QuickInput = {
  text: string;
  accountId?: string;
  toAccountId?: string;
  category?: string;
};
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export const isTransferEntry = (text: string) =>
  /\b(transfer(?:red|ed)?|lipat|moved?|sent|send)\b/i.test(text);
export function suggestCategory(text: string) {
  const rules: [string, RegExp][] = [
    ["Groceries", /\b(grocer(?:y|ies)|supermarket|palengke)\b/i],
    [
      "Food",
      /\b(food|pagkain|lunch|breakfast|dinner|snack|coffee|meal|kain|merienda|restaurant)\b/i,
    ],
    [
      "Transport",
      /\b(transpo(?:rt(?:ation)?)?|pamasahe|fare|jeep(?:ney)?|bus|taxi|grab|angkas|gas|fuel|train|mrt|lrt)\b/i,
    ],
    [
      "Utilities",
      /\b(electricity|water|internet|wifi|load|phone|meralco|utility|utilities)\b/i,
    ],
    ["Housing", /\b(rent|housing|upa)\b/i],
    ["Health", /\b(medicine|doctor|hospital|health|pharmacy)\b/i],
    ["Education", /\b(school|tuition|education|books)\b/i],
    [
      "Entertainment",
      /\b(movie|cinema|netflix|spotify|games|entertainment)\b/i,
    ],
    ["Shopping", /\b(shopping|clothes|shoes|shopee|lazada)\b/i],
    ["Salary", /\b(salary|income|sahod|payroll)\b/i],
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] || "Other";
}

function wallet(
  accounts: Account[],
  fragment: string | undefined,
  selected: string | undefined,
  label: string,
) {
  if (selected) {
    const account = accounts.find((a) => a.id === selected);
    if (!account) throw new Error(`Choose a valid ${label} wallet.`);
    return account.id;
  }
  if (fragment) {
    const words = ` ${normalize(fragment)} `;
    const exact = accounts.filter((a) =>
      [a.name, a.bank !== "Custom" ? a.bank : ""].some(
        (alias) => alias && normalize(alias) === normalize(fragment),
      ),
    );
    const matches = exact.length
      ? exact
      : accounts.filter((a) =>
          [a.name, a.bank !== "Custom" ? a.bank : ""].some(
            (alias) => alias && words.includes(` ${normalize(alias)} `),
          ),
        );
    if (matches.length === 1) return matches[0].id;
    throw new Error(
      matches.length
        ? `More than one wallet matches. Choose the ${label} wallet.`
        : `Wallet not recognized. Choose the ${label} wallet.`,
    );
  }
  if (accounts.length === 1 && label === "source") return accounts[0].id;
  throw new Error(
    `Choose the ${label} wallet, or include its name in your entry.`,
  );
}

export function parseQuickEntry(input: QuickInput, accounts: Account[]) {
  const text = input.text.trim();
  if (!text || text.length > 240)
    throw new Error("Describe one transaction in 240 characters or fewer.");
  if (!accounts.length)
    throw new Error("Add a wallet before logging a transaction.");
  const transfer = isTransferEntry(text);
  const from = text.match(/\bfrom\s+(.+?)(?=\s+to\s+|$)/i)?.[1];
  const to = text.match(/\bto\s+(.+)$/i)?.[1];
  const amountPart = text.split(/\b(?:from|to)\b/i)[0];
  if (/[-−]\s*(?:₱|PHP)?\s*\d/i.test(amountPart))
    throw new Error(
      "Use a positive amount; choose refund or income for money received.",
    );
  if (/[\$€£¥]|\b(centavos?|cents?|usd|dollars?|eur|euros?)\b/i.test(text))
    throw new Error(
      "Quick entry uses Philippine pesos. Enter the amount in pesos.",
    );
  if (/\b(yesterday|tomorrow|kahapon|bukas)\b/i.test(text))
    throw new Error(
      "Quick entry logs today. Use Add transaction to choose a different date.",
    );
  const amounts = [...amountPart.matchAll(/-?(?:\d[\d,]*(?:\.\d*)?|\.\d+)/g)];
  if (amounts.length !== 1)
    throw new Error(
      "Use one amount, for example “30 pesos for food” or “transfer 500 from BPI to BDO”.",
    );
  const raw = amounts[0][0];
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw))
    throw new Error("Use a positive amount with up to two decimal places.");
  const amount = Math.round(Number(raw.replaceAll(",", "")) * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 10_000_000_000)
    throw new Error(
      "Enter an amount greater than zero and no more than ₱100,000,000.",
    );
  const kind = transfer
    ? "transfer"
    : /\b(refund|refunded)\b/i.test(text)
      ? "refund"
      : /\b(income|salary|sahod|received|earned)\b/i.test(text)
        ? "income"
        : "expense";
  const accountId = wallet(accounts, from, input.accountId, "source");
  const toAccountId = transfer
    ? wallet(accounts, to, input.toAccountId, "destination")
    : null;
  if (accountId === toAccountId)
    throw new Error("Choose different wallets for a transfer.");
  const category = transfer
    ? "Other"
    : input.category || (kind === "income" ? "Salary" : suggestCategory(text));
  if (!entryCategories.includes(category))
    throw new Error("Choose a valid category.");
  return { kind, amount, category, accountId, toAccountId, note: text };
}
