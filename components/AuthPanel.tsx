"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "signup" | "login" | "forgot" | "reset";

async function post(path: string, body: object) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
  return data;
}

/** 6-digit code box used by email verification, password reset and admin sign-in. */
export function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label>
      6-digit code
      <input
        className="code-input"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        required
      />
    </label>
  );
}

/** Shown to a signed-in guest whose email isn't confirmed yet. */
export function VerifyEmail({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post("/api/auth/verify", { code });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    setInfo(null);
    try {
      await post("/api/auth/resend", {});
      setInfo("We sent a new code.");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form className="guest-form auth" onSubmit={submit}>
      <p className="auth-intro">
        <strong>Confirm your email.</strong> We sent a 6-digit code to <strong>{email}</strong>. It can take a minute;
        check your spam folder too.
      </p>
      <CodeInput value={code} onChange={setCode} />
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {info && <p className="notice">{info}</p>}
      <button className="pay" type="submit" disabled={busy || code.length !== 6}>
        {busy ? "Checking…" : "Confirm email"}
      </button>
      <button type="button" className="link" onClick={resend}>
        Send a new code
      </button>
    </form>
  );
}

export function AuthPanel({ intro, initialMode = "signup" }: { intro?: string; initialMode?: "signup" | "login" }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", website: "" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const go = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") await post("/api/auth/signup", form);
      else if (mode === "login") await post("/api/auth/login", { email: form.email, password: form.password });
      else if (mode === "forgot") {
        await post("/api/auth/reset/request", { email: form.email });
        setInfo("If there's an account with that email, we sent it a 6-digit code.");
        setMode("reset");
        setBusy(false);
        return;
      } else {
        await post("/api/auth/reset/confirm", { email: form.email, code, password: form.password });
      }
      // The server decides what comes next (e.g. the email code step).
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const tabs = mode === "signup" || mode === "login";

  return (
    <div className="auth">
      {intro && tabs && <p className="auth-intro">{intro}</p>}
      {tabs && (
        <div className="auth-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => go("signup")}>
            Create account
          </button>
          <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => go("login")}>
            Sign in
          </button>
        </div>
      )}
      {mode === "forgot" && <p className="auth-intro">Enter your email and we&apos;ll send you a code to choose a new password.</p>}
      {mode === "reset" && <p className="auth-intro">Enter the code from your email and your new password.</p>}

      <form className="guest-form" onSubmit={submit}>
        {mode === "signup" && (
          <>
            <div className="row">
              <label>
                First name
                <input required autoComplete="given-name" value={form.firstName} onChange={set("firstName")} />
              </label>
              <label>
                Last name
                <input required autoComplete="family-name" value={form.lastName} onChange={set("lastName")} />
              </label>
            </div>
            <label>
              Mobile phone
              <input required type="tel" autoComplete="tel" placeholder="(813) 555-0100" value={form.phone} onChange={set("phone")} />
            </label>
            {/* Honeypot for bots: hidden from people and screen readers. */}
            <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set("website")} />
          </>
        )}
        <label>
          Email
          <input
            required
            type="email"
            autoComplete="email"
            value={form.email}
            readOnly={mode === "reset"}
            onChange={set("email")}
          />
        </label>
        {mode === "reset" && <CodeInput value={code} onChange={setCode} />}
        {mode !== "forgot" && (
          <label>
            {mode === "reset" ? "New password" : "Password"}
            <input
              required
              type="password"
              minLength={mode === "login" ? undefined : 10}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={form.password}
              onChange={set("password")}
            />
            {mode !== "login" && <span className="field-hint">At least 10 characters.</span>}
          </label>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {info && <p className="notice">{info}</p>}
        <button className="pay" type="submit" disabled={busy}>
          {busy
            ? "One moment…"
            : { signup: "Create account", login: "Sign in", forgot: "Send code", reset: "Save new password" }[mode]}
        </button>
        {mode === "login" && (
          <button type="button" className="link" onClick={() => go("forgot")}>
            Forgot your password?
          </button>
        )}
        {(mode === "forgot" || mode === "reset") && (
          <button type="button" className="link" onClick={() => go("login")}>
            Back to sign in
          </button>
        )}
        {mode === "signup" && (
          <p className="fine">We&apos;ll email you a code to confirm your address. Your phone is only used about your stay.</p>
        )}
      </form>
    </div>
  );
}

export function SignOutButton({ admin = false }: { admin?: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="link"
      onClick={async () => {
        await fetch(admin ? "/api/admin/logout" : "/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
