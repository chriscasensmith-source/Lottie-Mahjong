"use client";

import { useEffect, useRef, useState } from "react";
import { CARD_YEAR } from "@/data/hands";

interface LoginScreenProps {
  sendCode: (email: string) => Promise<string | null>;
  verifyCode: (email: string, code: string) => Promise<string | null>;
}

const LAST_EMAIL_KEY = "mahj_last_email";
const RESEND_WAIT = 60; // seconds

// Two plain steps: type your email, then type the code we emailed you.
// Large type, one thing to do per screen.
export function LoginScreen({ sendCode, verifyCode }: LoginScreenProps) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const last = window.localStorage.getItem(LAST_EMAIL_KEY);
      if (last) setEmail(last);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  async function requestCode() {
    const clean = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(clean)) {
      setError("Please type your full email address.");
      return;
    }
    setBusy(true);
    setError(null);
    const err = await sendCode(clean);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    try {
      window.localStorage.setItem(LAST_EMAIL_KEY, clean);
    } catch {
      /* ignore */
    }
    setCode("");
    setWait(RESEND_WAIT);
    setStep("code");
  }

  async function submitCode(value: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const err = await verifyCode(email, value);
    setBusy(false);
    if (err) setError(err);
    // On success the app swaps this screen for the journal by itself.
  }

  const field =
    "min-h-14 w-full rounded-2xl border-2 border-maroon-900/25 bg-white px-4 text-xl text-maroon-900 outline-none placeholder:text-maroon-900/45 focus:border-maroon-600";
  const primary =
    "min-h-14 w-full rounded-2xl bg-maroon-700 text-lg font-semibold text-cream-50 shadow-sm transition-colors hover:bg-maroon-800 disabled:opacity-60";

  return (
    <main className="paper-texture mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-10 pt-6">
      <header className="rounded-3xl bg-maroon-700 px-5 py-6 text-center text-cream-50 shadow-[0_8px_24px_rgba(52,8,17,0.16)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-cream-200/85">🀄 {CARD_YEAR} NMJL card</p>
        <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">My Mahj Diary</h1>
        <p className="mt-1 text-sm text-cream-100/85">Your hands, rounds &amp; wins.</p>
      </header>

      <section className="card mt-5 p-5" aria-live="polite">
        {step === "email" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void requestCode();
            }}
          >
            <h2 className="font-display text-2xl font-bold text-maroon-800">Sign in</h2>
            <p className="mt-1 text-base text-maroon-900/85">
              Type your email and we&apos;ll send you a code. No password needed.
            </p>
            <label htmlFor="login-email" className="mt-5 block text-base font-semibold text-maroon-900">
              Your email
            </label>
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className={`mt-1.5 ${field}`}
            />
            {error && (
              <p role="alert" className="mt-3 rounded-xl bg-outcome-wall-soft px-3 py-2 text-base text-outcome-wall-ink">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className={`mt-5 ${primary}`}>
              {busy ? "Sending…" : "Email me a code"}
            </button>
            <p className="mt-4 text-sm text-maroon-900/75">
              First time here? Use the same steps. Your own diary is created for you, and only you can see it.
            </p>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitCode(code);
            }}
          >
            <h2 className="font-display text-2xl font-bold text-maroon-800">Check your email</h2>
            <p className="mt-1 text-base text-maroon-900/85">
              We sent a code to <span className="font-semibold text-maroon-900">{email.trim()}</span>. Type it here.
            </p>
            <label htmlFor="login-code" className="mt-5 block text-base font-semibold text-maroon-900">
              Code from the email
            </label>
            <input
              id="login-code"
              ref={codeRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={10}
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "");
                setCode(v);
                setError(null);
              }}
              placeholder="123456"
              className={`mt-1.5 text-center font-display text-3xl font-bold tracking-[0.3em] ${field}`}
            />
            {error && (
              <p role="alert" className="mt-3 rounded-xl bg-outcome-wall-soft px-3 py-2 text-base text-outcome-wall-ink">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy || code.length < 6} className={`mt-5 ${primary}`}>
              {busy ? "Checking…" : "Sign in"}
            </button>
            <p className="mt-4 text-sm text-maroon-900/80">
              It can take a minute to arrive. If you don&apos;t see it, look in your Spam or Junk folder.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || wait > 0}
                onClick={() => void requestCode()}
                className="min-h-11 flex-1 rounded-full bg-cream-200 px-4 text-sm font-semibold text-maroon-800 hover:bg-cream-300 disabled:opacity-60"
              >
                {wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setError(null);
                }}
                className="min-h-11 flex-1 rounded-full px-4 text-sm font-semibold text-maroon-700 ring-1 ring-maroon-300 hover:bg-maroon-50"
              >
                Use a different email
              </button>
            </div>
          </form>
        )}
      </section>

      <p className="mt-5 text-center text-sm text-maroon-900/75">
        You&apos;ll stay signed in on this device, so you only do this once.
      </p>
    </main>
  );
}
