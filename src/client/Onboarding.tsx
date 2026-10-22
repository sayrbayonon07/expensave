import { useState, type FormEvent } from "react";
import { Alert, Button, TextField } from "@mui/material";
import SpaRounded from "@mui/icons-material/SpaRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import type { Settings } from "../server/store";

function cents(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw new Error(
      "Enter an amount of zero or more with up to two decimal places.",
    );
  return Math.round(Number(value) * 100);
}

export function Onboarding({
  settings,
  today,
  save,
  demo,
}: {
  settings: Settings;
  today: string;
  save: (settings: Settings) => Promise<void>;
  demo?: () => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(
    settings.name === "there" ? "" : settings.name,
  );
  const [timezone, setTimezone] = useState(settings.timezone);
  const [income, setIncome] = useState(String(settings.expectedIncome / 100));
  const [payday, setPayday] = useState(settings.payday);
  const [buffer, setBuffer] = useState(String(settings.buffer / 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!step) {
      if (!name.trim()) return setError("Enter the name you’d like us to use.");
      try {
        new Intl.DateTimeFormat("en", { timeZone: timezone.trim() });
      } catch {
        return setError("Enter a valid timezone, such as Asia/Manila.");
      }
      setStep(1);
      return;
    }
    setBusy(true);
    try {
      await save({
        name: name.trim(),
        timezone: timezone.trim(),
        payday,
        expectedIncome: cents(income),
        buffer: cents(buffer),
        onboardingCompleted: true,
      });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="setup-page">
      <header className="app-header setup-header">
        <div className="brand">
          <SpaRounded />
          <span>
            expensave<span className="brand-dot">.</span>
          </span>
        </div>
        <span className="setup-duration">Quick setup · About a minute</span>
      </header>
      <main className="setup-main">
        <section className="setup-intro" aria-labelledby="setup-title">
          <span className="setup-kicker">A little clarity starts here</span>
          <h1 id="setup-title">
            Your money.
            <br />A little more you.
          </h1>
          <p>A few details to make your everyday plan feel like yours.</p>
          <div className="setup-illustration" aria-hidden="true">
            <div className="setup-paper">
              <SpaRounded />
              <span />
              <span />
              <span />
            </div>
            <div className="setup-illustration-pocket">
              <SpaRounded />
              <span>A little room to grow.</span>
            </div>
          </div>
        </section>
        <section
          className="surface setup-card"
          aria-labelledby="setup-step-title"
        >
          <ol className="setup-steps" aria-label="Setup progress">
            {["About you", "Your money"].map((label, index) => (
              <li
                key={label}
                aria-current={step === index ? "step" : undefined}
                className={step >= index ? "active" : ""}
              >
                <span>{step > index ? <CheckRounded /> : index + 1}</span>
                {label}
              </li>
            ))}
          </ol>
          <p className="setup-step-count" aria-live="polite">
            Step {step + 1} of 2
          </p>
          <h2 id="setup-step-title">
            {step ? "Make a little room." : "Let’s make it yours."}
          </h2>
          <p className="setup-description">
            {step
              ? "Set your next payday and the money you want to keep aside."
              : "Start with what we should call you."}
          </p>
          <form onSubmit={submit}>
            <div className="form-stack setup-fields" key={step}>
              {!step ? (
                <>
                  <TextField
                    label="What should we call you?"
                    required
                    autoFocus
                    name="name"
                    autoComplete="given-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    inputProps={{ maxLength: 80 }}
                    disabled={busy}
                  />
                  <TextField
                    label="Timezone"
                    required
                    name="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    helperText="Keeps your transactions and payday on local time."
                    disabled={busy}
                  />
                </>
              ) : (
                <>
                  <TextField
                    label="Expected income on payday (₱)"
                    required
                    autoFocus
                    name="expectedIncome"
                    type="number"
                    value={income}
                    onChange={(e) => setIncome(e.target.value)}
                    inputProps={{ min: 0, max: 100000000, step: 0.01 }}
                    helperText="Your take-home amount for the next payday. Use 0 if it varies."
                    disabled={busy}
                  />
                  <TextField
                    label="Next payday"
                    required
                    name="payday"
                    type="date"
                    value={payday}
                    onChange={(e) => setPayday(e.target.value)}
                    inputProps={{ min: today }}
                    slotProps={{ inputLabel: { shrink: true } }}
                    disabled={busy}
                  />
                  <TextField
                    label="Safety buffer (₱)"
                    required
                    name="buffer"
                    type="number"
                    value={buffer}
                    onChange={(e) => setBuffer(e.target.value)}
                    inputProps={{ min: 0, max: 100000000, step: 0.01 }}
                    helperText="Money to keep out of your daily spending allowance. Start with 0 if you prefer."
                    disabled={busy}
                  />
                  <p className="setup-note">
                    Expected income is for planning. Add it as a transaction
                    when it arrives.
                  </p>
                </>
              )}
              {error && <Alert severity="error">{error}</Alert>}
            </div>
            <div className="setup-actions">
              {step === 1 && (
                <Button
                  type="button"
                  startIcon={<ArrowBackRounded />}
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    setStep(0);
                  }}
                >
                  Back
                </Button>
              )}
              <Button
                type="submit"
                variant="contained"
                endIcon={<ArrowForwardRounded />}
                disabled={busy}
              >
                {busy ? "Saving…" : step ? "Open my dashboard" : "Continue"}
              </Button>
            </div>
          </form>
          {!step && demo && (
            <Button
              className="setup-demo"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await demo();
                } catch (cause) {
                  setError((cause as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Explore a demo
            </Button>
          )}
          <p className="setup-footnote">
            You can change these details any time.
          </p>
        </section>
      </main>
    </div>
  );
}
