import { useState, useRef } from "react";
import { Alert, Button, MenuItem, TextField } from "@mui/material";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import type { Account } from "../server/store";
import {
  entryCategories,
  isTransferEntry,
  parseQuickEntry,
  suggestCategory,
  type QuickInput,
} from "../server/quick-entry";

export function QuickEntry({
  accounts,
  save,
}: {
  accounts: Account[];
  save: (input: QuickInput) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const transfer = isTransferEntry(text);
  const input: QuickInput = {
    text,
    accountId: accountId || undefined,
    toAccountId: toAccountId || undefined,
    category: category || undefined,
  };
  let preview = "",
    hint = "",
    autoCategory = suggestCategory(text),
    autoWallet = accounts.length === 1 ? accounts[0].name : "Use name in entry",
    autoDestination = "Use name in entry";
  try {
    if (text.trim()) {
      const parsed = parseQuickEntry(input, accounts);
      const amount = new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
      }).format(parsed.amount / 100);
      const source = accounts.find((a) => a.id === parsed.accountId)!.name;
      autoCategory = parsed.category;
      autoWallet = "Auto · " + source;
      if (parsed.toAccountId)
        autoDestination =
          "Auto · " + accounts.find((a) => a.id === parsed.toAccountId)!.name;
      preview =
        parsed.kind === "transfer"
          ? `${amount} · ${source} → ${accounts.find((a) => a.id === parsed.toAccountId)!.name}`
          : `${parsed.kind === "income" || parsed.kind === "refund" ? "+" : "−"}${amount} · ${parsed.category} · ${source}`;
    }
  } catch (cause) {
    hint = (cause as Error).message;
  }
  return (
    <section
      className="surface quick-entry"
      aria-labelledby="quick-entry-title"
    >
      <div className="section-title">
        <div>
          <h2 id="quick-entry-title">Just say what you spent.</h2>
          <p>Write it once. We’ll fill in the details.</p>
        </div>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setError("");
          setBusy(true);
          try {
            parseQuickEntry(input, accounts);
            await save(input);
            setText("");
            setCategory("");
            setTimeout(() => inputRef.current?.focus(), 0);
          } catch (cause) {
            setError((cause as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="quick-entry-line">
          <TextField
            label="Describe a transaction"
            placeholder="30 pesos for food, or transfer 500 from BPI to BDO"
            inputRef={inputRef}
            required
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setCategory("");
              setError("");
            }}
            inputProps={{ maxLength: 240 }}
            disabled={busy}
          />
          <Button
            variant="contained"
            type="submit"
            disabled={busy || !text.trim()}
            endIcon={<ArrowForwardRounded />}
          >
            {busy ? "Logging…" : "Log"}
          </Button>
        </div>
        <div className="quick-entry-options">
          <TextField
            select
            label={transfer ? "From wallet" : "Wallet"}
            slotProps={{
              select: { displayEmpty: true },
              inputLabel: { shrink: true },
            }}
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setError("");
            }}
            disabled={busy}
          >
            <MenuItem value="">{autoWallet}</MenuItem>
            {accounts.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.name} · {a.bank}
              </MenuItem>
            ))}
          </TextField>
          {transfer ? (
            <TextField
              select
              label="To wallet"
              slotProps={{
                select: { displayEmpty: true },
                inputLabel: { shrink: true },
              }}
              value={toAccountId}
              onChange={(e) => {
                setToAccountId(e.target.value);
                setError("");
              }}
              disabled={busy}
            >
              <MenuItem value="">{autoDestination}</MenuItem>
              {accounts
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.name} · {a.bank}
                  </MenuItem>
                ))}
            </TextField>
          ) : (
            <TextField
              select
              label="Category"
              slotProps={{
                select: { displayEmpty: true },
                inputLabel: { shrink: true },
              }}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={busy}
            >
              <MenuItem value="">Auto · {autoCategory}</MenuItem>
              {entryCategories.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
          )}
        </div>
        <p
          className={preview ? "quick-entry-preview" : "quick-entry-hint"}
          aria-live="polite"
        >
          {preview ||
            hint ||
            "Try “20 pesos for transpo”. Press Enter or Log to save and update your balance."}
        </p>
        {error && <Alert severity="error">{error}</Alert>}
      </form>
    </section>
  );
}
