import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z, ZodError } from "zod";
import { Store, insights, settingsSchema } from "./store.js";
import { parseQuickEntry } from "./quick-entry.js";

export function createApp(store: Store, logging = false) {
  const app = Fastify({ logger: logging, bodyLimit: 20 * 1024 * 1024 });
  app.addHook("onRequest", async (req, reply) => {
    let host = "";
    try {
      host = new URL("http://" + req.headers.host).hostname;
    } catch {}
    if (!["localhost", "127.0.0.1", "[::1]"].includes(host))
      return reply
        .code(403)
        .send({ error: "Access this app using localhost or 127.0.0.1" });
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin) {
        try {
          if (new URL(origin).host !== req.headers.host)
            return reply
              .code(403)
              .send({ error: "Cross-origin writes are not allowed" });
        } catch {
          return reply.code(403).send({ error: "Invalid origin" });
        }
      }
      if (req.headers["x-expensave-client"] !== "1")
        return reply
          .code(403)
          .send({ error: "Missing application request header" });
    }
  });
  app.addHook("onSend", async (req, reply, payload) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer")
      .header("X-Frame-Options", "DENY")
      .header(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
    if (req.url.startsWith("/api/")) reply.header("Cache-Control", "no-store");
    return payload;
  });
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    const e = error as Error & { statusCode?: number };
    if (e.message.includes("SQLITE")) {
      req.log.error(e);
      return reply.code(400).send({
        error: "The operation could not be saved. Check the selected records.",
      });
    }
    return reply.code(e.statusCode || 400).send({ error: e.message });
  });
  app.get("/api/health", async () => ({ ok: true, version: "0.1.0" }));
  app.get("/api/state", async () => {
    const state = store.state();
    return { ...state, insights: insights(state) };
  });
  app.post("/api/accounts", async (req) => ({ id: store.account(req.body) }));
  app.put<{ Params: { id: string } }>("/api/accounts/:id", async (req) => {
    if (!store.state().accounts.some((a) => a.id === req.params.id))
      throw new Error("Wallet not found");
    return { id: store.account(req.body, req.params.id) };
  });
  app.post("/api/transactions", async (req) => ({
    id: store.transaction(req.body),
  }));
  app.post("/api/transactions/quick", async (req) => {
    const input = z
      .object({
        text: z.string().min(1).max(240),
        accountId: z.string().optional(),
        toAccountId: z.string().optional(),
        category: z.string().optional(),
      })
      .parse(req.body);
    const state = store.state();
    return {
      id: store.transaction({
        ...parseQuickEntry(input, state.accounts),
        date: state.today,
      }),
    };
  });
  app.put<{ Params: { id: string } }>("/api/transactions/:id", async (req) => {
    if (!store.state().transactions.some((t) => t.id === req.params.id))
      throw new Error("Transaction not found");
    return { id: store.transaction(req.body, req.params.id) };
  });
  for (const kind of ["budgets", "bills", "goals", "meals"] as const) {
    app.post("/api/" + kind, async (req) => ({
      id: store.resource(kind, req.body),
    }));
    app.put<{ Params: { id: string } }>(
      "/api/" + kind + "/:id",
      async (req) => {
        if (
          !store.all<{ id: string }>(kind).some((x) => x.id === req.params.id)
        )
          throw new Error("Record not found");
        return { id: store.resource(kind, req.body, req.params.id) };
      },
    );
  }
  for (const kind of [
    "accounts",
    "transactions",
    "budgets",
    "bills",
    "goals",
    "meals",
  ] as const)
    app.delete<{ Params: { id: string } }>(
      "/api/" + kind + "/:id",
      async (req) => {
        store.remove(kind, req.params.id);
        return { ok: true };
      },
    );
  app.put("/api/settings", async (req) => {
    store.put("settings", "profile", settingsSchema.parse(req.body));
    return { ok: true };
  });
  app.post<{ Params: { id: string } }>("/api/bills/:id/pay", async (req) => {
    const b = z
      .object({ accountId: z.string(), due: z.string() })
      .parse(req.body);
    store.payBill(req.params.id, b.accountId, b.due);
    return { ok: true };
  });
  app.post("/api/reset", async (req) => {
    z.object({ confirmation: z.literal("DELETE ALL DATA") }).parse(req.body);
    const b = store.backup();
    store.restore({
      ...b,
      accounts: [],
      transactions: [],
      budgets: [],
      bills: [],
      goals: [],
      meals: [],
    });
    return { ok: true };
  });
  app.post("/api/demo", async () => {
    store.demo();
    return { ok: true };
  });
  app.get("/api/backup", async (_, reply) =>
    reply
      .header(
        "Content-Disposition",
        'attachment; filename="expensave-backup.json"',
      )
      .send(store.backup()),
  );
  app.post("/api/restore", async (req) => {
    store.restore(req.body);
    return { ok: true };
  });
  app.get("/api/export.csv", async (_, reply) => {
    const s = store.state(),
      names = new Map(s.accounts.map((a) => [a.id, a.name]));
    const cell = (v: unknown) => {
      let text = String(v ?? "");
      if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const rows = [
      [
        "Date",
        "Type",
        "Wallet",
        "Destination",
        "Category",
        "Amount PHP",
        "Note",
      ],
      ...s.transactions.map((t) => [
        t.date,
        t.kind,
        names.get(t.accountId),
        t.toAccountId ? names.get(t.toAccountId) : "",
        t.category,
        (t.amount / 100).toFixed(2),
        t.note,
      ]),
    ];
    return reply
      .type("text/csv; charset=utf-8")
      .header(
        "Content-Disposition",
        'attachment; filename="expensave-transactions.csv"',
      )
      .send("\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n"));
  });
  const client = resolve("dist/client");
  if (existsSync(client)) {
    app.register(fastifyStatic, { root: client });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/")
        ? reply.code(404).send({ error: "Not found" })
        : reply.sendFile("index.html"),
    );
  }
  return app;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const dir = resolve(process.env.DATA_DIR || "data");
  mkdirSync(dir, { recursive: true });
  const store = new Store(resolve(dir, "expensave.sqlite"));
  const app = createApp(store, true);
  app.addHook("onClose", async () => store.close());
  const stop = async () => {
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  await app.listen({
    port: Number(process.env.PORT || 3000),
    host: process.env.HOST || "127.0.0.1",
  });
}
