"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "signup" | "login";

export function AuthPanel({ intro, initialMode = "signup" }: { intro?: string; initialMode?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body =
        mode === "signup" ? form : { email: form.email, password: form.password };
      const r = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      {intro && <p className="auth-intro">{intro}</p>}
      <div className="auth-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          onClick={() => {
            setMode("signup");
            setError(null);
          }}
        >
          Create account
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          onClick={() => {
            setMode("login");
            setError(null);
          }}
        >
          Sign in
        </button>
      </div>
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
              Phone
              <input required type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} />
            </label>
          </>
        )}
        <label>
          Email
          <input required type="email" autoComplete="email" value={form.email} onChange={set("email")} />
        </label>
        <label>
          Password
          <input
            required
            type="password"
            minLength={mode === "signup" ? 8 : undefined}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={form.password}
            onChange={set("password")}
          />
        </label>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <button className="pay" type="submit" disabled={busy}>
          {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
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
        await fetch(admin ? "/api/admin/logout" : "/api/auth/logout", { method: "POST" });
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
