import React, { useEffect, useState } from "react";
import {
  createTheme,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Snackbar,
  Alert,
  LinearProgress,
  Tooltip,
  FormControlLabel,
  Switch,
  CircularProgress,
  InputAdornment,
} from "@mui/material";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import SwapHorizRounded from "@mui/icons-material/SwapHorizRounded";
import PieChartRounded from "@mui/icons-material/PieChartRounded";
import FlagRounded from "@mui/icons-material/FlagRounded";
import RestaurantRounded from "@mui/icons-material/RestaurantRounded";
import AutoGraphRounded from "@mui/icons-material/AutoGraphRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import NorthEastRounded from "@mui/icons-material/NorthEastRounded";
import SouthWestRounded from "@mui/icons-material/SouthWestRounded";
import MoreHorizRounded from "@mui/icons-material/MoreHorizRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import UploadRounded from "@mui/icons-material/UploadRounded";
import SpaRounded from "@mui/icons-material/SpaRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import CreditCardRounded from "@mui/icons-material/CreditCardRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import BoltRounded from "@mui/icons-material/BoltRounded";
import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import ShoppingBagRounded from "@mui/icons-material/ShoppingBagRounded";
import DirectionsBusRounded from "@mui/icons-material/DirectionsBusRounded";
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-500.css";
import "@fontsource/roboto/latin-700.css";
import type {
  Account,
  Transaction,
  State,
  Insights,
  Budget,
  Bill,
  Goal,
} from "../server/store";
import "./style.css";
import { Onboarding } from "./Onboarding";
import { QuickEntry } from "./QuickEntry";
import { Meals } from "./Meals";
import { entryCategories } from "../server/quick-entry";

type Data = State & { insights: Insights };
type Page =
  | "Overview"
  | "Transactions"
  | "Wallets"
  | "Budgets"
  | "Goals"
  | "Meal ideas"
  | "Insights"
  | "Settings";
type Modal = {
  kind: "transaction" | "account" | "budget" | "bill" | "goal" | "pay";
  record?: any;
};
export const theme = createTheme({
  palette: {
    primary: { main: "#087f5b", dark: "#056346" },
    secondary: { main: "#e1e8db", contrastText: "#24382c" },
    background: { default: "#f7f8f4", paper: "#fdfefa" },
    divider: "#ccd7c5",
    text: { primary: "#24382c", secondary: "#566650" },
  },
  typography: {
    fontFamily: "Roboto, Arial, sans-serif",
    fontSize: 18,
    button: { textTransform: "none", fontWeight: 500 },
  },
  shape: { borderRadius: 16 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: "9999px", padding: "13px 25px", fontSize: 17 },
      },
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: "50%" } } },
    MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 28 } } },
    MuiLinearProgress: {
      styleOverrides: { root: { borderRadius: 99, height: 7 } },
    },
  },
});
const categories = entryCategories;
const colors = ["#087f5b", "#056346", "#335c46"];
const accentColor = (value: string) =>
  colors.includes(value) ? value : colors[0];
const currency = (n: number, compact = false) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: compact ? 0 : 2,
    minimumFractionDigits: compact ? 0 : 2,
  }).format(n / 100);
const fmtDate = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
const monthLabel = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });
const amountValue = (s: FormDataEntryValue | null) => {
  const value = String(s || "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error("Use a positive amount with up to two decimal places");
  return Math.round(Number(value) * 100);
};
const signedValue = (s: FormDataEntryValue | null) => {
  const value = String(s || "").trim();
  return value.startsWith("-")
    ? -amountValue(value.slice(1))
    : amountValue(value);
};
const catIcon = (category: string) =>
  category === "Food" ? (
    <RestaurantRounded />
  ) : category === "Transport" ? (
    <DirectionsBusRounded />
  ) : category === "Shopping" || category === "Groceries" ? (
    <ShoppingBagRounded />
  ) : category === "Utilities" ? (
    <BoltRounded />
  ) : (
    <ReceiptLongRounded />
  );
async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch("/api" + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      "X-Expensave-Client": "1",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong");
  return data;
}
function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <SpaRounded />
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
function SectionTitle({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  );
}
export function App() {
  const [data, setData] = useState<Data | null>(null),
    [page, setPage] = useState<Page>("Overview"),
    [modal, setModal] = useState<Modal | null>(null),
    [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(
      null,
    ),
    [loadError, setLoadError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState<{
      title: string;
      detail: string;
      action: () => Promise<void>;
    } | null>(null);
  const refresh = async () => {
    try {
      setData(await api("/state"));
      setLoadError("");
    } catch (e) {
      setLoadError((e as Error).message);
    }
  };
  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  const mutate = async (path: string, method: string, body?: unknown) => {
    await api(path, method, body);
    await refresh();
  };
  const perform = async (
    action: () => Promise<void>,
    message = "Saved successfully",
  ) => {
    setBusy(true);
    try {
      await action();
      setNotice({ text: message });
      return true;
    } catch (e) {
      setNotice({ text: (e as Error).message, error: true });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const remove = (kind: string, id: string, name: string) =>
    setConfirm({
      title: `Delete ${name}?`,
      detail:
        kind === "transactions"
          ? "This reverses the transaction’s effect on your balances."
          : "This removes the record from your workspace.",
      action: () => mutate("/" + kind + "/" + id, "DELETE"),
    });
  const go = (p: Page) => {
    setPage(p);
  };
  if (!data)
    return (
      <div className="loading">
        <div className="brand">
          <SpaRounded />
          expensave<span>®</span>
        </div>
        {loadError ? (
          <>
            <Alert severity="error">
              Could not connect to Expensave. {loadError}
            </Alert>
            <Button onClick={refresh}>Try again</Button>
          </>
        ) : (
          <CircularProgress size={28} />
        )}
      </div>
    );
  if (!data.settings.onboardingCompleted)
    return (
      <Onboarding
        settings={data.settings}
        today={data.today}
        save={async (settings) => {
          await api("/settings", "PUT", settings);
          setData(await api("/state"));
          window.scrollTo({ top: 0 });
        }}
        demo={
          !data.accounts.length
            ? async () => {
                await api("/demo", "POST", {});
                setData(await api("/state"));
              }
            : undefined
        }
      />
    );
  const s = data.insights;
  const featureActions = [
    {
      name: "Transactions" as Page,
      label: "Activity",
      icon: <SwapHorizRounded />,
    },
    {
      name: "Budgets" as Page,
      label: "Budgets & bills",
      icon: <PieChartRounded />,
    },
    { name: "Goals" as Page, label: "Goals", icon: <FlagRounded /> },
    {
      name: "Meal ideas" as Page,
      label: "Meal ideas",
      icon: <RestaurantRounded />,
    },
    { name: "Insights" as Page, label: "Insights", icon: <AutoGraphRounded /> },
  ];
  return (
    <>
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("Overview");
          }}
          aria-label="Expensave dashboard"
        >
          <SpaRounded />
          <span>
            expensave<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="header-actions">
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={() =>
              setModal({
                kind: data.accounts.length ? "transaction" : "account",
              })
            }
          >
            Add {data.accounts.length ? "transaction" : "wallet"}
          </Button>
          <Tooltip title="Settings">
            <IconButton
              className="settings-button"
              aria-label="Settings"
              onClick={() => go("Settings")}
            >
              <SettingsRounded />
            </IconButton>
          </Tooltip>
          <span className="avatar" aria-label="Your profile">
            {data.settings.name === "there"
              ? "Y"
              : data.settings.name[0].toUpperCase()}
          </span>
        </div>
      </header>
      <main className="dashboard-main">
        <div className="dashboard-intro">
          <div>
            <p className="greeting">Hello, {data.settings.name}.</p>
            <h1>
              A little clarity.
              <br />A lot more possibility.
            </h1>
          </div>
          <span className="month-pill">
            <CalendarMonthRounded />
            {monthLabel(data.today)}
          </span>
        </div>
        {loadError && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Could not refresh your data: {loadError}
          </Alert>
        )}
        {data.accounts.length === 0 && (
          <div className="welcome-banner">
            <div>
              <h3>A fresh start for your finances.</h3>
              <p>
                Add your first wallet, or take a look around with sample data.
              </p>
            </div>
            <Button
              disabled={busy}
              onClick={() =>
                void perform(
                  () => mutate("/demo", "POST", {}),
                  "Sample workspace loaded",
                )
              }
              endIcon={<ArrowForwardRounded />}
            >
              Explore a demo
            </Button>
          </div>
        )}
        <section className="money-hero" aria-label="Your money overview">
          <div className="hero-main">
            <span className="hero-label">Available to spend</span>
            <strong className="hero-amount">
              {currency(Math.max(0, s.available), true)}
            </strong>
            <p>
              {s.available < 0
                ? "Your planned commitments exceed available funds."
                : "A little breathing room, after your bills and savings."}
            </p>
            <Button
              variant="outlined"
              onClick={() => go("Insights")}
              endIcon={<ArrowForwardRounded />}
            >
              See your money plan
            </Button>
            <div className="hero-art" aria-hidden="true">
              <SpaRounded />
            </div>
          </div>
          <div className="hero-side">
            <div className="hero-daily">
              <span className="hero-label">
                <SpaRounded />A little room for today
              </span>
              <strong>
                {currency(s.daily, true)}
                <small>/ day</small>
              </strong>
              <p>
                {s.days
                  ? `${s.days} days until payday.`
                  : "Set your next payday in Settings."}
              </p>
            </div>
            <div className="hero-monthly">
              <div>
                <span>
                  <SouthWestRounded />
                  Money in
                </span>
                <strong>{currency(s.income, true)}</strong>
              </div>
              <div>
                <span>
                  <NorthEastRounded />
                  Money out
                </span>
                <strong>{currency(s.spent, true)}</strong>
              </div>
            </div>
          </div>
        </section>
        <nav className="feature-actions" aria-label="Dashboard features">
          {featureActions.map((f) => (
            <Button
              key={f.name}
              variant="outlined"
              startIcon={f.icon}
              onClick={() => go(f.name)}
            >
              {f.label}
            </Button>
          ))}
        </nav>
        {!!data.accounts.length && (
          <QuickEntry
            accounts={data.accounts}
            save={async (input) => {
              await mutate("/transactions/quick", "POST", input);
              setNotice({ text: "Transaction logged" });
            }}
          />
        )}
        <section className="wallet-section" aria-labelledby="wallet-heading">
          <div className="dashboard-section-heading">
            <div>
              <h2 id="wallet-heading">Your wallets.</h2>
              <p>Every pocket. A little more perspective.</p>
            </div>
            <Button
              endIcon={<ArrowForwardRounded />}
              onClick={() => go("Wallets")}
            >
              Manage wallets
            </Button>
          </div>
          <div className="wallet-rail">
            {data.accounts.map((a) => (
              <WalletCard
                key={a.id}
                account={a}
                onEdit={() => setModal({ kind: "account", record: a })}
              />
            ))}
            <button
              className="add-wallet-card"
              onClick={() => setModal({ kind: "account" })}
            >
              <span>
                <AddRounded />
              </span>
              <strong>Add a wallet</strong>
              <small>Bank, cash, or credit card</small>
            </button>
          </div>
        </section>
        <div className="dashboard-details">
          <section className="surface activity-card">
            <SectionTitle
              title="The latest little things"
              sub="Your recent activity, all in one place."
              action={
                <Button
                  endIcon={<ArrowForwardRounded />}
                  onClick={() => go("Transactions")}
                >
                  View activity
                </Button>
              }
            />
            <TransactionRows
              data={data}
              rows={data.transactions.slice(0, 5)}
              edit={(r) => setModal({ kind: "transaction", record: r })}
            />
          </section>
          <section className="surface spending-card">
            <SectionTitle
              title="Your week, in view"
              sub="Daily expenses over the last seven days."
            />
            <SpendingChart data={data} />
          </section>
        </div>
        <section className="everyday-section">
          <div className="dashboard-section-heading">
            <div>
              <h2>Make room for what matters.</h2>
              <p>A few helpful things, whenever you need them.</p>
            </div>
          </div>
          <div className="everyday-grid">
            <button
              className="everyday-card budget-preview"
              onClick={() => go("Budgets")}
            >
              <span className="everyday-top">
                <PieChartRounded />
                <ArrowForwardRounded />
              </span>
              <h3>A plan that fits.</h3>
              <p>
                {s.budgets.length
                  ? `${s.budgets.length} budgets to keep you on track.`
                  : "Give your everyday spending a little direction."}
              </p>
              <div className="preview-budget-bars">
                {(s.budgets.length
                  ? s.budgets.slice(0, 3)
                  : [
                      { category: "Food", amount: 1, spent: 0 },
                      { category: "Transport", amount: 1, spent: 0 },
                    ]
                ).map((b) => (
                  <div key={b.category}>
                    <span>{b.category}</span>
                    <div>
                      <i
                        style={{
                          width:
                            Math.max(
                              0,
                              Math.min(100, (b.spent / b.amount) * 100),
                            ) + "%",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </button>
            <button
              className="everyday-card goal-preview"
              onClick={() => go("Goals")}
            >
              <span className="everyday-top">
                <FlagRounded />
                <ArrowForwardRounded />
              </span>
              <h3>Something to look forward to.</h3>
              <p>
                {data.goals.length
                  ? `${currency(s.reserved, true)} set aside for your goals.`
                  : "A weekend away. A rainy day. Something just for you."}
              </p>
              <div className="goal-preview-art" aria-hidden="true">
                <FlagRounded />
              </div>
            </button>
            <button
              className="everyday-card food-preview"
              onClick={() => go("Meal ideas")}
            >
              <span className="everyday-top">
                <RestaurantRounded />
                <ArrowForwardRounded />
              </span>
              <h3>Good food. Happy budget.</h3>
              <p>Simple meal ideas that leave a little more in your pocket.</p>
              <div className="food-preview-art" aria-hidden="true">
                <RestaurantRounded />
              </div>
            </button>
          </div>
        </section>
        {data.bills.length > 0 && (
          <section className="upcoming-strip">
            <div>
              <ReceiptLongRounded />
              <div>
                <h3>A little heads-up.</h3>
                <p>
                  {data.bills[0].name} · {currency(data.bills[0].amount, true)}{" "}
                  ·{" "}
                  {data.bills[0].due < data.today
                    ? "Overdue"
                    : `Due ${fmtDate(data.bills[0].due)}`}
                </p>
              </div>
            </div>
            <Button
              onClick={() => go("Budgets")}
              endIcon={<ArrowForwardRounded />}
            >
              View bills
            </Button>
          </section>
        )}
        <footer className="footer">
          <a
            className="footer-wordmark"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            expensave.
          </a>
          <span>A little saved. A little more possible.</span>
        </footer>
      </main>
      <Dialog
        className="feature-panel"
        open={page !== "Overview"}
        onClose={() => !busy && go("Overview")}
        maxWidth="xl"
        fullWidth
        aria-labelledby="feature-title"
      >
        <DialogTitle className="feature-panel-heading" id="feature-title">
          <div>
            <span>
              {page === "Transactions"
                ? "Activity"
                : page === "Budgets"
                  ? "Budgets & bills"
                  : page}
            </span>
          </div>
          <IconButton
            className="panel-close"
            onClick={() => go("Overview")}
            aria-label="Close panel"
          >
            <CloseRounded />
          </IconButton>
        </DialogTitle>
        <DialogContent className="feature-panel-content" key={page}>
          {page === "Transactions" && (
            <TransactionsPage
              data={data}
              edit={(r) => setModal({ kind: "transaction", record: r })}
              remove={(r) => remove("transactions", r.id, "transaction")}
            />
          )}
          {page === "Wallets" && (
            <>
              <SectionTitle
                title="Your accounts"
                sub="Balances reflect recorded activity. Bank connections are manual."
                action={
                  <Button
                    variant="outlined"
                    startIcon={<AddRounded />}
                    onClick={() => setModal({ kind: "account" })}
                  >
                    New wallet
                  </Button>
                }
              />
              <div className="all-wallets">
                {data.accounts.map((a) => (
                  <div key={a.id}>
                    <WalletCard
                      account={a}
                      onEdit={() => setModal({ kind: "account", record: a })}
                    />
                    <div className="wallet-meta">
                      <span>
                        {a.type === "credit"
                          ? "Credit card · debt shown above"
                          : a.type === "cash"
                            ? "Cash wallet"
                            : "Bank account"}
                        {a.type === "credit" && a.balance > 0
                          ? " · " + currency(a.balance) + " credit"
                          : ""}
                      </span>
                      <IconButton
                        size="small"
                        aria-label={"Delete " + a.name}
                        onClick={() => remove("accounts", a.id, a.name)}
                      >
                        <DeleteOutlineRounded fontSize="small" />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
              {!data.accounts.length && (
                <Empty
                  title="A wallet for every purpose"
                  detail="Add BDO, BPI, MariBank, cash, or a custom account."
                />
              )}
              <div className="info-strip">
                <SwapHorizRounded />
                <p>
                  Moving money between wallets? Choose <strong>Transfer</strong>
                  . Use the credit card as the destination when paying it off.
                </p>
              </div>
              <div className="stats-strip">
                <div>
                  <span>Cash & bank balances</span>
                  <strong>{currency(s.liquid)}</strong>
                </div>
                <div>
                  <span>Credit card debt</span>
                  <strong>{currency(s.debt)}</strong>
                </div>
                <div>
                  <span>Net balance</span>
                  <strong>{currency(s.netWorth)}</strong>
                </div>
              </div>
            </>
          )}
          {page === "Budgets" && (
            <>
              <SectionTitle
                title={monthLabel(data.today) + " budgets"}
                sub="Monthly category limits. Refunds reduce category spending."
                action={
                  <Button
                    variant="outlined"
                    startIcon={<AddRounded />}
                    onClick={() => setModal({ kind: "budget" })}
                  >
                    New budget
                  </Button>
                }
              />
              <div className="budget-grid">
                {s.budgets.map((b) => (
                  <section className="surface" key={b.id}>
                    <div className="budget-card-head">
                      <span className="icon-bubble mint">
                        {catIcon(b.category)}
                      </span>
                      <div>
                        <IconButton
                          aria-label={"Edit " + b.category}
                          onClick={() =>
                            setModal({ kind: "budget", record: b })
                          }
                        >
                          <EditOutlined fontSize="small" />
                        </IconButton>
                        <IconButton
                          aria-label={"Delete " + b.category}
                          onClick={() =>
                            remove("budgets", b.id, b.category + " budget")
                          }
                        >
                          <DeleteOutlineRounded fontSize="small" />
                        </IconButton>
                      </div>
                    </div>
                    <BudgetBar budget={b} />
                    <p className={b.spent > b.amount ? "over-budget" : "muted"}>
                      {b.spent > b.amount
                        ? currency(b.spent - b.amount) + " over budget"
                        : currency(b.amount - b.spent) + " left to spend"}
                    </p>
                  </section>
                ))}
              </div>
              {!s.budgets.length && (
                <Empty
                  title="Start with the everyday essentials"
                  detail="Try food, transport, and groceries."
                />
              )}
              <section className="surface bills-section">
                <SectionTitle
                  title="Bills & subscriptions"
                  sub="Mark a bill paid to record its expense. Monthly bills advance one month."
                  action={
                    <Button
                      startIcon={<AddRounded />}
                      onClick={() => setModal({ kind: "bill" })}
                    >
                      Add bill
                    </Button>
                  }
                />
                {data.bills.map((b) => (
                  <div className="bill-row" key={b.id}>
                    <span className="icon-bubble mint">
                      <ReceiptLongRounded />
                    </span>
                    <div className="grow">
                      <strong>{b.name}</strong>
                      <small>
                        {fmtDate(b.due)} · {b.category} ·{" "}
                        {b.monthly ? "Monthly" : "One time"}
                      </small>
                    </div>
                    <strong>{currency(b.amount)}</strong>
                    <Button
                      disabled={!data.accounts.length}
                      onClick={() => setModal({ kind: "pay", record: b })}
                    >
                      Pay
                    </Button>
                    <IconButton
                      aria-label={"Edit " + b.name}
                      onClick={() => setModal({ kind: "bill", record: b })}
                    >
                      <EditOutlined fontSize="small" />
                    </IconButton>
                    <IconButton
                      aria-label={"Delete " + b.name}
                      onClick={() => remove("bills", b.id, b.name)}
                    >
                      <DeleteOutlineRounded fontSize="small" />
                    </IconButton>
                  </div>
                ))}
                {!data.bills.length && (
                  <p className="muted">
                    Add a bill to reserve its amount before payday.
                  </p>
                )}
              </section>
            </>
          )}
          {page === "Goals" && (
            <>
              <SectionTitle
                title="Good things take little steps"
                sub="Saved amounts reserve part of your existing money; they don’t move money between wallets."
                action={
                  <Button
                    variant="outlined"
                    startIcon={<AddRounded />}
                    onClick={() => setModal({ kind: "goal" })}
                  >
                    New goal
                  </Button>
                }
              />
              <div className="budget-grid">
                {data.goals.map((g) => (
                  <section className="surface goal-card" key={g.id}>
                    <div className="budget-card-head">
                      <span
                        className="icon-bubble"
                        style={{
                          background: "var(--sage-surface)",
                          color: accentColor(g.color),
                        }}
                      >
                        <FlagRounded />
                      </span>
                      <IconButton
                        aria-label={"Edit " + g.name}
                        onClick={() => setModal({ kind: "goal", record: g })}
                      >
                        <EditOutlined fontSize="small" />
                      </IconButton>
                    </div>
                    <h2>{g.name}</h2>
                    <div className="goal-amount">
                      {currency(g.saved, true)}
                      <span>of {currency(g.target, true)}</span>
                    </div>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, (g.saved / g.target) * 100)}
                      sx={{
                        "& .MuiLinearProgress-bar": {
                          background: accentColor(g.color),
                        },
                      }}
                    />
                    <div className="goal-footer">
                      <span>
                        {Math.round((g.saved / g.target) * 100)}% of the way
                        there
                      </span>
                      <IconButton
                        aria-label={"Delete " + g.name}
                        onClick={() => remove("goals", g.id, g.name)}
                      >
                        <DeleteOutlineRounded fontSize="small" />
                      </IconButton>
                    </div>
                  </section>
                ))}
              </div>
              {!data.goals.length && (
                <Empty
                  title="What are you saving for?"
                  detail="An emergency fund, a trip, or something just for you."
                />
              )}
            </>
          )}
          {page === "Insights" && (
            <InsightsPage data={data} settings={() => go("Settings")} />
          )}
          {page === "Meal ideas" && (
            <Meals
              meals={data.meals}
              save={async (meal, id) => {
                await mutate(
                  "/meals" + (id ? "/" + id : ""),
                  id ? "PUT" : "POST",
                  meal,
                );
              }}
              remove={async (id) => {
                await mutate("/meals/" + id, "DELETE");
              }}
            />
          )}
          {page === "Settings" && (
            <SettingsPage
              data={data}
              busy={busy}
              save={(body) => perform(() => mutate("/settings", "PUT", body))}
              reset={() =>
                setConfirm({
                  title: "Clear all financial data?",
                  detail:
                    "This removes all wallets, transactions, budgets, bills, goals, and saved meals. Your preferences remain. Download a backup before continuing.",
                  action: () =>
                    mutate("/reset", "POST", {
                      confirmation: "DELETE ALL DATA",
                    }),
                })
              }
              restore={(file) =>
                setConfirm({
                  title: "Replace this workspace?",
                  detail:
                    "Restoring replaces all wallets, transactions, budgets, bills, goals, and settings. Download a backup first.",
                  action: async () => {
                    await mutate(
                      "/restore",
                      "POST",
                      JSON.parse(await file.text()),
                    );
                  },
                })
              }
            />
          )}
        </DialogContent>
      </Dialog>
      {modal && (
        <Editor
          modal={modal}
          data={data}
          busy={busy}
          close={() => setModal(null)}
          submit={async (path, method, body) => {
            if (await perform(() => mutate(path, method, body))) setModal(null);
          }}
        />
      )}
      <Dialog
        open={!!confirm}
        onClose={() => !busy && setConfirm(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{confirm?.title}</DialogTitle>
        <DialogContent>
          <p>{confirm?.detail}</p>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            color="error"
            onClick={async () => {
              if (confirm && (await perform(confirm.action, "Done")))
                setConfirm(null);
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={!!notice}
        autoHideDuration={6000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={notice?.error ? "error" : "success"}
          onClose={() => setNotice(null)}
          variant="filled"
        >
          {notice?.text}
        </Alert>
      </Snackbar>
    </>
  );
}
function WalletCard({
  account: a,
  onEdit,
}: {
  account: Account;
  onEdit: () => void;
}) {
  return (
    <article
      className="wallet-sleeve"
      aria-label={a.name + " wallet"}
      style={{ "--wallet-accent": accentColor(a.color) } as React.CSSProperties}
    >
      <button
        className="wallet-open"
        aria-label={"Open " + a.name + " wallet"}
        aria-haspopup="dialog"
        onClick={onEdit}
      />
      <div className="wallet-card">
        <div className="wallet-card-top">
          <strong>{a.bank === "Custom" ? a.name : a.bank}</strong>
        </div>
        <span className="wallet-name">{a.name}</span>
        <strong className="wallet-balance">
          {currency(a.type === "credit" ? Math.max(0, -a.balance) : a.balance)}
        </strong>
        <div className="wallet-card-bottom">
          <span>
            {a.type === "credit"
              ? "Amount owed"
              : a.type === "cash"
                ? "Always on hand"
                : a.last4
                  ? "•••• " + a.last4
                  : "Personal account"}
          </span>
          {a.type === "cash" ? (
            <AccountBalanceWalletRounded />
          ) : (
            <CreditCardRounded />
          )}
        </div>
        <div className="wallet-circle" />
      </div>
      <IconButton
        className="wallet-menu"
        onClick={onEdit}
        aria-label={"Edit " + a.name}
        size="small"
      >
        <MoreHorizRounded />
      </IconButton>
      <div className="wallet-pocket" aria-hidden="true">
        <AccountBalanceWalletRounded />
        <span>
          {a.type === "cash"
            ? "Cash"
            : a.type === "credit"
              ? "Credit"
              : "Bank account"}
        </span>
        <span className="wallet-pocket-snap" />
      </div>
    </article>
  );
}
function BudgetBar({ budget: b }: { budget: Budget & { spent: number } }) {
  const over = b.spent > b.amount;
  return (
    <div className="budget-bar">
      <div>
        <strong>{b.category}</strong>
        <span>{Math.round((b.spent / b.amount) * 100)}%</span>
      </div>
      <LinearProgress
        variant="determinate"
        value={Math.max(0, Math.min(100, (b.spent / b.amount) * 100))}
        sx={{
          background: "var(--sage-surface)",
          "& .MuiLinearProgress-bar": {
            background: over ? "#c56949" : "var(--accent)",
          },
        }}
      />
      <small>
        {currency(b.spent, true)} <span>of {currency(b.amount, true)}</span>
      </small>
    </div>
  );
}
function SpendingChart({ data }: { data: Data }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(data.today + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - 6 + i);
    const date = d.toISOString().slice(0, 10);
    return {
      date,
      amount: data.transactions
        .filter((t) => t.date === date && t.kind === "expense")
        .reduce((a, t) => a + t.amount, 0),
      label: d.toLocaleDateString("en", { weekday: "short", timeZone: "UTC" }),
    };
  });
  const max = Math.max(10000, ...days.map((d) => d.amount));
  return (
    <div
      className="chart"
      role="img"
      aria-label={
        "Daily expenses: " +
        days.map((d) => d.label + " " + currency(d.amount)).join(", ")
      }
    >
      <div className="chart-labels">
        <span>{currency(max, true)}</span>
        <span>{currency(max / 2, true)}</span>
        <span>₱0</span>
      </div>
      <div className="chart-bars">
        <div className="chart-grid" />
        {days.map((d, i) => (
          <div className="bar-column" key={d.date}>
            <Tooltip title={`${fmtDate(d.date)}: ${currency(d.amount)}`}>
              <div
                className={"bar " + (i === 6 ? "current" : "")}
                style={{
                  height: Math.max(d.amount ? 3 : 1, (d.amount / max) * 145),
                }}
              >
                <span>{d.amount ? currency(d.amount, true) : ""}</span>
              </div>
            </Tooltip>
            <small>{d.label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
function TransactionRows({
  data,
  rows,
  edit,
  remove,
}: {
  data: Data;
  rows: Transaction[];
  edit: (r: Transaction) => void;
  remove?: (r: Transaction) => void;
}) {
  if (!rows.length)
    return (
      <Empty
        title="A clear page"
        detail="Your transactions will appear here."
      />
    );
  return (
    <div className="transaction-list">
      {rows.map((t) => (
        <div className="transaction-row" key={t.id}>
          <span
            className={
              "icon-bubble " +
              (t.kind === "income" || t.kind === "refund" ? "lime" : "mint")
            }
          >
            {t.kind === "transfer" ? (
              <SwapHorizRounded />
            ) : t.kind === "income" ? (
              <SouthWestRounded />
            ) : (
              catIcon(t.category)
            )}
          </span>
          <button className="transaction-description" onClick={() => edit(t)}>
            <strong>{t.note || t.category}</strong>
            <small>
              {data.accounts.find((a) => a.id === t.accountId)?.name}
              {t.kind === "transfer"
                ? " → " +
                  data.accounts.find((a) => a.id === t.toAccountId)?.name
                : " · " + t.category}
            </small>
          </button>
          <span className="transaction-date">{fmtDate(t.date)}</span>
          <strong
            className={
              "transaction-amount " +
              (["income", "refund"].includes(t.kind) ? "positive" : "")
            }
          >
            {t.kind === "transfer"
              ? ""
              : t.kind === "income" || t.kind === "refund"
                ? "+"
                : "−"}
            {currency(t.amount)}
          </strong>
          {remove && (
            <IconButton
              size="small"
              aria-label={"Delete " + (t.note || t.category)}
              onClick={() => remove(t)}
            >
              <DeleteOutlineRounded fontSize="small" />
            </IconButton>
          )}
        </div>
      ))}
    </div>
  );
}
function TransactionsPage({
  data,
  edit,
  remove,
}: {
  data: Data;
  edit: (r: Transaction) => void;
  remove: (r: Transaction) => void;
}) {
  const [search, setSearch] = useState(""),
    [kind, setKind] = useState("all"),
    [wallet, setWallet] = useState("all"),
    [page, setPage] = useState(0);
  const filtered = data.transactions.filter(
    (t) =>
      (kind === "all" || t.kind === kind) &&
      (wallet === "all" ||
        t.accountId === wallet ||
        t.toAccountId === wallet) &&
      (t.note + " " + t.category + " " + t.date)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const count = Math.max(1, Math.ceil(filtered.length / 20));
  useEffect(() => setPage(0), [search, kind, wallet]);
  useEffect(() => {
    if (page >= count) setPage(count - 1);
  }, [count, page]);
  return (
    <section className="surface">
      <div className="filter-row">
        <TextField
          placeholder="Search transactions"
          aria-label="Search transactions"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          select
          label="Type"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <MenuItem value="all">All types</MenuItem>
          {["expense", "income", "transfer", "refund"].map((v) => (
            <MenuItem key={v} value={v}>
              {v[0].toUpperCase() + v.slice(1)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Wallet"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
        >
          <MenuItem value="all">All wallets</MenuItem>
          {data.accounts.map((a) => (
            <MenuItem key={a.id} value={a.id}>
              {a.name}
            </MenuItem>
          ))}
        </TextField>
        <Button
          component="a"
          href="/api/export.csv"
          startIcon={<DownloadRounded />}
        >
          Export
        </Button>
      </div>
      <TransactionRows
        data={data}
        rows={filtered.slice(page * 20, page * 20 + 20)}
        edit={edit}
        remove={remove}
      />
      <div className="pagination">
        <span>
          {filtered.length} transactions · Page {page + 1} of {count}
        </span>
        <div>
          <Button disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Button
            disabled={page + 1 >= count}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
function InsightsPage({
  data,
  settings,
}: {
  data: Data;
  settings: () => void;
}) {
  const s = data.insights;
  return (
    <>
      <div className="insight-banner">
        <SpaRounded />
        <div>
          <h2>Clarity, without the crystal ball.</h2>
          <p>
            These insights use your recorded activity and plans. Every
            calculation happens locally.
          </p>
        </div>
      </div>
      <div className="insights-grid">
        <section className="surface">
          <SectionTitle
            title="Your daily allowance"
            action={<Button onClick={settings}>Adjust plan</Button>}
          />
          <div className="insight-number">
            {currency(s.daily, true)}
            <span>/ day</span>
          </div>
          <p className="muted">
            For the {s.days} days before your next payday.
          </p>
          <div className="calculation">
            {[
              ["Cash & bank balances", s.liquid],
              ["Credit card debt", -s.debt],
              ["Reserved for goals", -s.reserved],
              ["Safety buffer", -data.settings.buffer],
              ["Unpaid bills before payday", -s.upcoming],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <span>{label}</span>
                <strong>{currency(Number(value))}</strong>
              </div>
            ))}
            <div className="calculation-total">
              <strong>Available before payday</strong>
              <strong>{currency(s.available)}</strong>
            </div>
          </div>
          {s.available < 0 && (
            <Alert severity="warning">
              Your commitments exceed available funds by{" "}
              {currency(-s.available)}. Review bills, savings reservations, and
              spending.
            </Alert>
          )}
          {!s.days && (
            <Alert severity="info">
              Set a future payday in Settings to calculate an allowance.
            </Alert>
          )}
        </section>
        <section className="surface">
          <SectionTitle
            title="A look toward payday"
            sub="Estimated net cash before your next income arrives."
          />
          <div className="insight-number">{currency(s.projected, true)}</div>
          <div className="forecast-range">
            <span>
              Higher spending<strong>{currency(s.projectedLow, true)}</strong>
            </span>
            <span>
              Lower spending<strong>{currency(s.projectedHigh, true)}</strong>
            </span>
          </div>
          <p className="muted">
            Assumes {currency(s.variableDaily, true)} per day in variable
            spending, with a ±25% spending scenario range. This is a scenario,
            not a statistical confidence interval.
          </p>
          <Alert severity={s.observedDays < 14 ? "info" : "success"}>
            {s.observedDays < 14
              ? "Limited history: " +
                s.observedDays +
                " observed days. Estimates will change as you add transactions."
              : "Based on " + s.observedDays + " days of recorded history."}
          </Alert>
          <p className="fine-print">
            Includes current card debt and unpaid bills through payday.
            Categories used by scheduled bills are excluded from the
            variable-spending average to reduce double counting. Goals and your
            safety buffer remain part of the projected balance. Expected income
            of {currency(data.settings.expectedIncome, true)} is not included
            until received.
          </p>
        </section>
      </div>
      <section className="surface">
        <SectionTitle title="Things worth a second look" />
        {s.budgets
          .filter((b) => b.spent / b.amount >= 0.8)
          .map((b) => (
            <div className="insight-row" key={b.id}>
              <span className="icon-bubble peach">{catIcon(b.category)}</span>
              <div>
                <strong>
                  {b.category}: {Math.round((b.spent / b.amount) * 100)}% of
                  budget used
                </strong>
                <p>
                  {b.spent > b.amount
                    ? "Over by " +
                      currency(b.spent - b.amount) +
                      ". Consider reducing optional spending or revising this budget."
                    : currency(b.amount - b.spent) + " remaining this month."}
                </p>
              </div>
            </div>
          ))}
        {!s.budgets.some((b) => b.spent / b.amount >= 0.8) && (
          <p className="muted">No categories are above 80% of their budget.</p>
        )}
      </section>
    </>
  );
}
function SettingsPage({
  data,
  busy,
  save,
  restore,
  reset,
}: {
  data: Data;
  busy: boolean;
  reset: () => void;
  save: (body: unknown) => Promise<boolean>;
  restore: (file: File) => void;
}) {
  return (
    <div className="settings-grid">
      <section className="surface">
        <SectionTitle
          title="Your everyday plan"
          sub="These details power your daily allowance and forecast."
        />
        <PlanForm data={data} busy={busy} save={save} />
      </section>
      <div>
        <section className="surface">
          <SectionTitle title="Your data, in your hands" />
          <p className="muted">
            Back up your wallets, transactions, budgets, goals, bills, meals,
            and settings. Keep a copy outside Docker before updating or
            restoring.
          </p>
          <div className="backup-actions">
            <Button
              component="a"
              href="/api/backup"
              variant="outlined"
              startIcon={<DownloadRounded />}
            >
              Download backup
            </Button>
            <Button component="label" startIcon={<UploadRounded />}>
              Restore backup
              <input
                hidden
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) restore(file);
                  e.target.value = "";
                }}
              />
            </Button>
            <Button
              component="a"
              href="/api/export.csv"
              startIcon={<DownloadRounded />}
            >
              Export transactions CSV
            </Button>
          </div>
          <Button color="error" onClick={reset}>
            Clear all financial data
          </Button>
          <p className="fine-print">
            Backups contain your financial records as readable JSON. Store them
            somewhere private. CSV is for spreadsheets; use JSON to restore.
          </p>
        </section>
        <section className="surface">
          <SectionTitle title="Built to stay local" />
          <div className="feature-note">
            <CheckRounded />
            <span>Works without internet after installation</span>
          </div>
          <div className="feature-note">
            <CheckRounded />
            <span>SQLite data persists in your Docker volume</span>
          </div>
          <div className="feature-note">
            <CheckRounded />
            <span>No external fonts, trackers, or AI requests</span>
          </div>
          <p className="fine-print">
            Keep Docker running while you use Expensave. This version is for one
            local workspace and manual account tracking. Apple Intelligence is
            not integrated in the Linux container.
          </p>
        </section>
      </div>
    </div>
  );
}
function PlanForm({
  data,
  busy,
  save,
}: {
  data: Data;
  busy: boolean;
  save: (body: unknown) => Promise<boolean>;
}) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const disabled = busy || saving;
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (disabled) return;
        setError("");
        setSaving(true);
        try {
          const f = new FormData(e.currentTarget);
          await save({
            name: f.get("name"),
            payday: f.get("payday"),
            expectedIncome: amountValue(f.get("expectedIncome")),
            buffer: amountValue(f.get("buffer")),
            timezone: f.get("timezone"),
            onboardingCompleted: true,
          });
        } catch (cause) {
          setError((cause as Error).message);
        } finally {
          setSaving(false);
        }
      }}
    >
      <TextField
        label="What should we call you?"
        name="name"
        required
        defaultValue={data.settings.name}
        inputProps={{ maxLength: 80 }}
        disabled={disabled}
      />
      <TextField
        label="Next payday"
        name="payday"
        type="date"
        required
        defaultValue={data.settings.payday}
        slotProps={{ inputLabel: { shrink: true } }}
        disabled={disabled}
      />
      <TextField
        label="Expected income on payday (₱)"
        name="expectedIncome"
        type="number"
        required
        defaultValue={data.settings.expectedIncome / 100}
        inputProps={{ min: 0, max: 100000000, step: 0.01 }}
        helperText="For planning only. Record income when it arrives."
        disabled={disabled}
      />
      <TextField
        label="Safety buffer (₱)"
        name="buffer"
        type="number"
        required
        defaultValue={data.settings.buffer / 100}
        inputProps={{ min: 0, max: 100000000, step: 0.01 }}
        helperText="Money kept out of your daily spending allowance."
        disabled={disabled}
      />
      <TextField
        label="Timezone"
        name="timezone"
        required
        defaultValue={data.settings.timezone}
        helperText="For example: Asia/Manila"
        disabled={disabled}
      />
      {error && <Alert severity="error">{error}</Alert>}
      <Button type="submit" variant="contained" disabled={disabled}>
        {saving ? "Saving…" : "Save preferences"}
      </Button>
    </form>
  );
}
function Editor({
  modal,
  data,
  busy,
  close,
  submit,
}: {
  modal: Modal;
  data: Data;
  busy: boolean;
  close: () => void;
  submit: (path: string, method: string, body: unknown) => Promise<void>;
}) {
  const r = modal.record,
    k = modal.kind;
  const [kind, setKind] = useState(r?.kind || "expense"),
    [type, setType] = useState(r?.type || "bank"),
    [color, setColor] = useState(accentColor(r?.color || colors[0])),
    [bank, setBank] = useState(r?.bank || "BPI"),
    [error, setError] = useState("");
  const title =
    k === "pay"
      ? "Mark bill paid"
      : `${r ? "Edit" : "New"} ${k === "account" ? "wallet" : k}`;
  const submitForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const v = (name: string) => String(f.get(name) || "");
    try {
      let body: unknown,
        path = "";
      if (k === "transaction") {
        body = {
          kind,
          accountId: v("accountId"),
          toAccountId: kind === "transfer" ? v("toAccountId") : null,
          amount: amountValue(f.get("amount")),
          date: v("date"),
          category: kind === "transfer" ? "Transfer" : v("category"),
          note: v("note"),
        };
        path = "/transactions";
      } else if (k === "account") {
        body = {
          name: v("name"),
          bank,
          type,
          opening:
            type === "credit"
              ? -signedValue(f.get("opening"))
              : signedValue(f.get("opening")),
          color,
          last4: v("last4"),
        };
        path = "/accounts";
      } else if (k === "budget") {
        body = {
          category: v("category"),
          amount: amountValue(f.get("amount")),
          month: v("month"),
        };
        path = "/budgets";
      } else if (k === "bill") {
        body = {
          name: v("name"),
          amount: amountValue(f.get("amount")),
          due: v("due"),
          category: v("category"),
          monthly: f.get("monthly") === "on",
        };
        path = "/bills";
      } else if (k === "goal") {
        body = {
          name: v("name"),
          target: amountValue(f.get("target")),
          saved: amountValue(f.get("saved")),
          color,
        };
        path = "/goals";
      } else {
        await submit("/bills/" + r.id + "/pay", "POST", {
          accountId: v("accountId"),
          due: r.due,
        });
        return;
      }
      await submit(path + (r ? "/" + r.id : ""), r ? "PUT" : "POST", body);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const categoryField = (
    <>
      <TextField
        label="Category"
        name="category"
        required
        defaultValue={r?.category || (kind === "income" ? "Salary" : "Food")}
        slotProps={{ htmlInput: { list: "categories", maxLength: 80 } }}
      />
      <datalist id="categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
  const walletField = (name: string, label: string, value?: string) => (
    <TextField
      name={name}
      select
      label={label}
      required
      defaultValue={value || data.accounts[0]?.id || ""}
    >
      {data.accounts.map((a) => (
        <MenuItem key={a.id} value={a.id}>
          {a.bank} · {a.name}
        </MenuItem>
      ))}
    </TextField>
  );
  return (
    <Dialog open onClose={() => !busy && close()} fullWidth maxWidth="sm">
      <form onSubmit={submitForm}>
        <DialogTitle className="dialog-heading">
          {title}
          <IconButton aria-label="Close dialog" onClick={close} disabled={busy}>
            <CloseRounded />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <div className="form-stack editor-fields">
            {k === "transaction" && (
              <>
                <div className="type-tabs">
                  {["expense", "income", "transfer", "refund"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={kind === t ? "selected" : ""}
                      onClick={() => setKind(t)}
                    >
                      {t[0].toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
                <TextField
                  label="Amount (₱)"
                  name="amount"
                  type="number"
                  required
                  defaultValue={r ? r.amount / 100 : ""}
                  inputProps={{ min: 0.01, step: 0.01 }}
                />
                {walletField(
                  "accountId",
                  kind === "transfer" ? "From wallet" : "Wallet",
                  r?.accountId,
                )}
                {kind === "transfer" &&
                  walletField(
                    "toAccountId",
                    "To wallet",
                    r?.toAccountId || data.accounts[1]?.id,
                  )}
                {kind !== "transfer" && categoryField}
                <TextField
                  label="Date"
                  name="date"
                  type="date"
                  required
                  defaultValue={r?.date || data.today}
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { max: data.today },
                  }}
                />
                <TextField
                  label="Note (optional)"
                  name="note"
                  defaultValue={r?.note || ""}
                  inputProps={{ maxLength: 240 }}
                />
                {kind === "transfer" && (
                  <Alert severity="info">
                    Transfers move money between accounts without counting as
                    income or expenses.
                  </Alert>
                )}
              </>
            )}
            {k === "account" && (
              <>
                <TextField
                  label="Wallet name"
                  name="name"
                  required
                  defaultValue={r?.name || ""}
                  placeholder="Everyday spending"
                  inputProps={{ maxLength: 80 }}
                />
                <div className="form-pair">
                  <TextField
                    label="Institution"
                    select
                    value={bank}
                    onChange={(e) => {
                      setBank(e.target.value);
                    }}
                  >
                    {["BPI", "BDO", "MariBank", "Cash", "Custom"].map((b) => (
                      <MenuItem key={b} value={b}>
                        {b}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Account type"
                    select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    {[
                      ["bank", "Bank account"],
                      ["cash", "Cash"],
                      ["credit", "Credit card"],
                    ].map(([v, l]) => (
                      <MenuItem key={v} value={v}>
                        {l}
                      </MenuItem>
                    ))}
                  </TextField>
                </div>
                <TextField
                  label={
                    type === "credit"
                      ? "Opening debt (₱)"
                      : "Opening balance (₱)"
                  }
                  name="opening"
                  type="number"
                  required
                  defaultValue={
                    r ? (r.type === "credit" ? -r.opening : r.opening) / 100 : 0
                  }
                  inputProps={{ step: 0.01 }}
                  helperText={
                    r
                      ? "The balance before recorded transactions. Changing this adjusts your current balance."
                      : type === "credit"
                        ? "Enter debt as a positive amount. A negative amount means an overpayment credit."
                        : "Your balance before adding transactions."
                  }
                />
                <TextField
                  label="Last four digits (optional)"
                  name="last4"
                  defaultValue={r?.last4 || ""}
                  inputProps={{
                    maxLength: 4,
                    pattern: "[0-9]{0,4}",
                    inputMode: "numeric",
                  }}
                />
              </>
            )}
            {k === "budget" && (
              <>
                {categoryField}
                <TextField
                  label="Monthly limit (₱)"
                  name="amount"
                  type="number"
                  required
                  defaultValue={r ? r.amount / 100 : ""}
                  inputProps={{ min: 0.01, step: 0.01 }}
                />
                <TextField
                  label="Month"
                  name="month"
                  type="month"
                  required
                  defaultValue={r?.month || data.today.slice(0, 7)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </>
            )}
            {k === "bill" && (
              <>
                <TextField
                  label="Bill name"
                  name="name"
                  required
                  defaultValue={r?.name || ""}
                />
                <TextField
                  label="Amount (₱)"
                  name="amount"
                  type="number"
                  required
                  defaultValue={r ? r.amount / 100 : ""}
                  inputProps={{ min: 0.01, step: 0.01 }}
                />
                <TextField
                  label="Next due date"
                  name="due"
                  type="date"
                  required
                  defaultValue={r?.due || data.today}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                {categoryField}
                <FormControlLabel
                  control={
                    <Switch
                      name="monthly"
                      defaultChecked={r?.monthly ?? true}
                    />
                  }
                  label="Repeat monthly"
                />
              </>
            )}
            {k === "goal" && (
              <>
                <TextField
                  label="Goal name"
                  name="name"
                  required
                  defaultValue={r?.name || ""}
                />
                <TextField
                  label="Target amount (₱)"
                  name="target"
                  type="number"
                  required
                  defaultValue={r ? r.target / 100 : ""}
                  inputProps={{ min: 0.01, step: 0.01 }}
                />
                <TextField
                  label="Already reserved (₱)"
                  name="saved"
                  type="number"
                  required
                  defaultValue={r ? r.saved / 100 : 0}
                  inputProps={{ min: 0, step: 0.01 }}
                  helperText="This reserves existing money. It does not create income or transfer funds."
                />
              </>
            )}
            {(k === "goal" || k === "account") && (
              <div>
                <p className="field-label">Accent tone</p>
                <div className="color-picker">
                  {colors.map((c) => (
                    <button
                      type="button"
                      key={c}
                      aria-label={"Choose " + c}
                      aria-pressed={c === color}
                      style={{ background: c }}
                      onClick={() => setColor(c)}
                    >
                      {color === c && <CheckRounded />}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {k === "pay" && (
              <>
                <div className="pay-summary">
                  <ReceiptLongRounded />
                  <h2>{r.name}</h2>
                  <strong>{currency(r.amount)}</strong>
                  <p>Due {fmtDate(r.due)}</p>
                </div>
                {walletField("accountId", "Pay from wallet")}
                <Alert severity="info">
                  Records an expense today.
                  {r.monthly
                    ? " The next due date will advance one month."
                    : " The bill will be removed from upcoming payments."}
                </Alert>
              </>
            )}
            {error && <Alert severity="error">{error}</Alert>}
          </div>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy
              ? "Saving…"
              : k === "pay"
                ? "Record payment"
                : r
                  ? "Save changes"
                  : "Create " + (k === "account" ? "wallet" : k)}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
