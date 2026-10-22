import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { z } from "zod";
export const money = z.number().int().min(0).max(10_000_000_000);
const signedMoney = z.number().int().min(-10_000_000_000).max(10_000_000_000);
export const date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((s) => !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s, "Invalid date");
const label = z.string().trim().min(1).max(80);
export const accountSchema = z.object({
    name: label,
    bank: z.string().max(40).default("Custom"),
    type: z.enum(["bank", "cash", "credit"]),
    opening: signedMoney,
    color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    last4: z
        .string()
        .regex(/^\d{0,4}$/)
        .default(""),
});
export const transactionSchema = z.object({
    kind: z.enum(["expense", "income", "transfer", "refund"]),
    accountId: z.string().min(1),
    toAccountId: z.string().nullable().optional(),
    amount: money.refine((n) => n > 0, "Amount must be greater than zero"),
    date,
    category: label,
    note: z.string().max(240).default(""),
});
export const budgetSchema = z.object({
    category: label,
    amount: money.refine((n) => n > 0),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});
export const billSchema = z.object({
    name: label,
    amount: money.refine((n) => n > 0),
    due: date,
    category: label,
    monthly: z.boolean().default(true),
});
export const goalSchema = z
    .object({
    name: label,
    target: money.refine((n) => n > 0),
    saved: money,
    color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
})
    .refine((x) => x.saved <= x.target, "Saved amount cannot exceed the target");
export const settingsSchema = z.object({
    name: label,
    payday: date,
    expectedIncome: money,
    buffer: money,
    timezone: z.string().refine((s) => {
        try {
            new Intl.DateTimeFormat("en", { timeZone: s });
            return true;
        }
        catch {
            return false;
        }
    }, "Invalid timezone"),
});
export function todayIn(timezone) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}
export function nextMonth(s) {
    const d = new Date(s + "T12:00:00Z");
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
    return d.toISOString().slice(0, 10);
}
const backupSchema = z.object({
    format: z.literal("expensave"),
    version: z.literal(1),
    accounts: z.array(accountSchema.extend({ id: label })).max(1000),
    transactions: z
        .array(transactionSchema.extend({ id: label, createdAt: z.string().datetime() }))
        .max(100000),
    budgets: z.array(budgetSchema.extend({ id: label })).max(10000),
    bills: z.array(billSchema.extend({ id: label })).max(10000),
    goals: z.array(goalSchema.safeExtend({ id: label })).max(10000),
    settings: settingsSchema,
});
export class Store {
    db;
    constructor(path) {
        this.db = new DatabaseSync(path);
        const version = this.db.prepare("PRAGMA user_version").get();
        if (version.user_version > 1) {
            this.db.close();
            throw new Error("This database requires a newer version of Expensave");
        }
        this.db
            .exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS transactions(id TEXT PRIMARY KEY, date TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS entries(id TEXT PRIMARY KEY, transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE, account_id TEXT NOT NULL REFERENCES accounts(id), amount INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS entries_account ON entries(account_id);
      CREATE INDEX IF NOT EXISTS transactions_date ON transactions(date);
      CREATE TABLE IF NOT EXISTS budgets(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS bills(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS goals(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
      PRAGMA user_version=1;`);
        if (!this.db.prepare("SELECT id FROM settings").get()) {
            const today = todayIn("Asia/Manila");
            const end = new Date(today + "T12:00:00Z");
            end.setUTCDate(end.getUTCDate() + 14);
            this.put("settings", "profile", {
                name: "there",
                payday: end.toISOString().slice(0, 10),
                expectedIncome: 0,
                buffer: 0,
                timezone: "Asia/Manila",
            });
        }
    }
    close() {
        this.db.close();
    }
    all(table) {
        return this.db.prepare(`SELECT payload FROM ${this.table(table)}`).all().map((r) => JSON.parse(r.payload));
    }
    table(table) {
        if (![
            "accounts",
            "transactions",
            "budgets",
            "bills",
            "goals",
            "settings",
        ].includes(table))
            throw new Error("Invalid table");
        return table;
    }
    put(table, id, value) {
        this.db
            .prepare(`INSERT INTO ${this.table(table)}(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload`)
            .run(id, JSON.stringify(value));
    }
    atomic(fn) {
        this.db.exec("BEGIN IMMEDIATE");
        try {
            const value = fn();
            this.db.exec("COMMIT");
            return value;
        }
        catch (e) {
            this.db.exec("ROLLBACK");
            throw e;
        }
    }
    state() {
        const settings = this.all("settings")[0];
        const sums = this.db
            .prepare("SELECT account_id, SUM(amount) AS amount FROM entries GROUP BY account_id")
            .all();
        const balances = new Map(sums.map((x) => [x.account_id, x.amount]));
        return {
            accounts: this.all("accounts").map((a) => ({
                ...a,
                balance: a.opening + (balances.get(a.id) || 0),
            })),
            transactions: this.all("transactions").sort((a, b) => b.date.localeCompare(a.date) ||
                b.createdAt.localeCompare(a.createdAt)),
            budgets: this.all("budgets"),
            bills: this.all("bills").sort((a, b) => a.due.localeCompare(b.due)),
            goals: this.all("goals"),
            settings,
            today: todayIn(settings.timezone),
        };
    }
    account(data, id = randomUUID()) {
        const a = accountSchema.parse(data);
        this.put("accounts", id, { ...a, id });
        return id;
    }
    saveTransaction(data, id = randomUUID(), createdAt = new Date().toISOString()) {
        const t = transactionSchema.parse(data);
        const accounts = new Set(this.all("accounts").map((a) => a.id));
        if (!accounts.has(t.accountId))
            throw new Error("Choose an existing wallet");
        if (t.kind === "transfer" &&
            (!t.toAccountId ||
                !accounts.has(t.toAccountId) ||
                t.toAccountId === t.accountId))
            throw new Error("Choose a different destination wallet");
        if (t.date > todayIn(this.all("settings")[0].timezone))
            throw new Error("Use bills for future payments; transactions must be dated today or earlier");
        const record = {
            ...t,
            toAccountId: t.kind === "transfer" ? t.toAccountId : null,
            id,
            createdAt,
        };
        this.db
            .prepare("INSERT INTO transactions(id,date,payload) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET date=excluded.date,payload=excluded.payload")
            .run(id, t.date, JSON.stringify(record));
        this.db.prepare("DELETE FROM entries WHERE transaction_id=?").run(id);
        const entry = this.db.prepare("INSERT INTO entries(id,transaction_id,account_id,amount) VALUES(?,?,?,?)");
        entry.run(randomUUID(), id, t.accountId, ["expense", "transfer"].includes(t.kind) ? -t.amount : t.amount);
        if (t.kind === "transfer")
            entry.run(randomUUID(), id, t.toAccountId, t.amount);
        return id;
    }
    transaction(data, id) {
        return this.atomic(() => this.saveTransaction(data, id));
    }
    resource(table, data, id = randomUUID()) {
        const schemas = {
            budgets: budgetSchema,
            bills: billSchema,
            goals: goalSchema,
        };
        const value = schemas[table].parse(data);
        if (table === "budgets") {
            const b = value;
            if (this.all("budgets").some((x) => x.id !== id &&
                x.category.toLowerCase() === b.category.toLowerCase() &&
                x.month === b.month))
                throw new Error("A budget already exists for this category and month");
        }
        this.put(table, id, { ...value, id });
        return id;
    }
    remove(table, id) {
        if (table === "accounts" &&
            this.db
                .prepare("SELECT id FROM entries WHERE account_id=? LIMIT 1")
                .get(id))
            throw new Error("This wallet has transactions. Move or delete its transactions first.");
        const result = this.db
            .prepare(`DELETE FROM ${this.table(table)} WHERE id=?`)
            .run(id);
        if (!result.changes)
            throw new Error("Record not found");
    }
    payBill(id, accountId, due) {
        return this.atomic(() => {
            const bill = this.all("bills").find((x) => x.id === id);
            if (!bill || bill.due !== due)
                throw new Error("This bill has changed or was already paid. Refresh and try again.");
            this.saveTransaction({
                kind: "expense",
                accountId,
                amount: bill.amount,
                date: todayIn(this.all("settings")[0].timezone),
                category: bill.category,
                note: bill.name,
            });
            if (bill.monthly)
                this.put("bills", id, { ...bill, due: nextMonth(bill.due) });
            else
                this.remove("bills", id);
        });
    }
    backup() {
        const s = this.state();
        return {
            format: "expensave",
            version: 1,
            exportedAt: new Date().toISOString(),
            accounts: s.accounts.map(({ balance, ...a }) => a),
            transactions: s.transactions,
            budgets: s.budgets,
            bills: s.bills,
            goals: s.goals,
            settings: s.settings,
        };
    }
    restore(input) {
        const b = backupSchema.parse(input);
        for (const rows of [
            b.accounts,
            b.transactions,
            b.budgets,
            b.bills,
            b.goals,
        ])
            if (new Set(rows.map((x) => x.id)).size !== rows.length)
                throw new Error("Backup contains duplicate record IDs");
        if (new Set(b.budgets.map((x) => x.month + "|" + x.category.toLowerCase()))
            .size !== b.budgets.length)
            throw new Error("Backup contains duplicate budgets");
        this.atomic(() => {
            this.db.exec("DELETE FROM entries; DELETE FROM transactions; DELETE FROM accounts; DELETE FROM budgets; DELETE FROM bills; DELETE FROM goals;");
            this.put("settings", "profile", b.settings);
            for (const a of b.accounts)
                this.account(a, a.id);
            for (const t of b.transactions)
                this.saveTransaction(t, t.id, t.createdAt);
            for (const k of ["budgets", "bills", "goals"])
                for (const r of b[k])
                    this.put(k, r.id, r);
        });
    }
    demo() {
        if (this.all("accounts").length || this.all("transactions").length)
            throw new Error("Demo data can only be loaded into an empty workspace");
        this.atomic(() => {
            const s = this.state(), today = s.today, month = today.slice(0, 7);
            const bpi = this.account({
                name: "Everyday",
                bank: "BPI",
                type: "bank",
                opening: 1800000,
                color: "#8c2434",
                last4: "4829",
            });
            const mari = this.account({
                name: "Rainy day",
                bank: "MariBank",
                type: "bank",
                opening: 1250000,
                color: "#ea713d",
                last4: "1082",
            });
            const cash = this.account({
                name: "Pocket money",
                bank: "Cash",
                type: "cash",
                opening: 150000,
                color: "#32694e",
                last4: "",
            });
            const samples = [
                ["Food", 18500, "Lunch at the campus", cash],
                ["Groceries", 124500, "Weekly groceries", bpi],
                ["Transport", 8000, "Ride home", cash],
                ["Shopping", 64900, "A few essentials", bpi],
                ["Food", 24000, "Coffee with friends", bpi],
                ["Utilities", 149900, "Internet bill", bpi],
                ["Food", 12000, "Breakfast", cash],
            ];
            samples.forEach(([category, amount, note, accountId], i) => {
                const d = new Date(today + "T12:00:00Z");
                d.setUTCDate(d.getUTCDate() - i);
                this.saveTransaction({
                    kind: "expense",
                    accountId,
                    amount,
                    category,
                    note,
                    date: d.toISOString().slice(0, 10),
                });
            });
            this.saveTransaction({
                kind: "transfer",
                accountId: bpi,
                toAccountId: mari,
                amount: 100000,
                date: today,
                category: "Transfer",
                note: "A little extra for later",
            });
            for (const [category, amount] of [
                ["Food", 500000],
                ["Groceries", 400000],
                ["Transport", 200000],
                ["Shopping", 250000],
                ["Utilities", 300000],
            ])
                this.resource("budgets", { category, amount, month });
            const due = new Date(today + "T12:00:00Z");
            due.setUTCDate(due.getUTCDate() + 5);
            this.resource("bills", {
                name: "Phone plan",
                amount: 59900,
                due: due.toISOString().slice(0, 10),
                category: "Utilities",
                monthly: true,
            });
            this.resource("goals", {
                name: "Emergency fund",
                saved: 800000,
                target: 3000000,
                color: "#008b65",
            });
            this.resource("goals", {
                name: "Weekend getaway",
                saved: 250000,
                target: 1000000,
                color: "#889b30",
            });
            this.put("settings", "profile", {
                ...s.settings,
                name: "friend",
                buffer: 200000,
                expectedIncome: 1500000,
            });
        });
    }
}
export function insights(s) {
    const { today } = s, month = today.slice(0, 7);
    const monthly = s.transactions.filter((t) => t.date.startsWith(month));
    const netExpense = (ts) => ts.reduce((a, t) => a +
        (t.kind === "expense" ? t.amount : t.kind === "refund" ? -t.amount : 0), 0);
    const spent = netExpense(monthly), income = monthly
        .filter((t) => t.kind === "income")
        .reduce((a, t) => a + t.amount, 0);
    const liquid = s.accounts
        .filter((a) => a.type !== "credit")
        .reduce((a, t) => a + t.balance, 0), debt = s.accounts
        .filter((a) => a.type === "credit")
        .reduce((a, t) => a + Math.max(0, -t.balance), 0);
    const days = Math.max(0, Math.ceil((Date.parse(s.settings.payday) - Date.parse(today)) / 86400000));
    const reserved = s.goals.reduce((a, g) => a + g.saved, 0);
    let upcoming = 0;
    for (const b of s.bills) {
        let due = b.due;
        let n = 0;
        while (due <= s.settings.payday && n++ < 1200) {
            upcoming += b.amount;
            if (!b.monthly)
                break;
            due = nextMonth(due);
        }
    }
    const available = liquid - debt - reserved - s.settings.buffer - upcoming;
    const recentStart = new Date(today + "T12:00:00Z");
    recentStart.setUTCDate(recentStart.getUTCDate() - 29);
    const recent = s.transactions.filter((t) => t.date >= recentStart.toISOString().slice(0, 10) && t.date <= today);
    const historyDates = s.transactions
        .filter((t) => ["expense", "refund"].includes(t.kind))
        .map((t) => t.date)
        .sort();
    const observedDays = historyDates.length
        ? Math.min(30, Math.max(1, Math.ceil((Date.parse(today) - Date.parse(historyDates[0])) / 86400000) + 1))
        : 0;
    const billCategories = new Set(s.bills.map((b) => b.category.toLowerCase()));
    const variableRecent = recent.filter((t) => !billCategories.has(t.category.toLowerCase()));
    const variableDaily = observedDays
        ? Math.max(0, Math.round(netExpense(variableRecent) / observedDays))
        : 0;
    const projected = liquid - debt - upcoming - variableDaily * days;
    const budgets = s.budgets
        .filter((b) => b.month === month)
        .map((b) => ({
        ...b,
        spent: netExpense(monthly.filter((t) => t.category.toLowerCase() === b.category.toLowerCase())),
    }));
    return {
        spent,
        income,
        liquid,
        debt,
        netWorth: s.accounts.reduce((a, t) => a + t.balance, 0),
        days,
        reserved,
        upcoming,
        available,
        daily: days ? Math.max(0, Math.floor(available / days)) : 0,
        variableDaily,
        observedDays,
        projected,
        projectedLow: projected - Math.round(variableDaily * days * 0.25),
        projectedHigh: projected + Math.round(variableDaily * days * 0.25),
        budgets,
    };
}
