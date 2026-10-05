"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/track";
import { useL } from "./LangProvider";

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
  const { l } = useL();
  return (
    <label>
      {l("6-digit code", "Código de 6 dígitos")}
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
  const { l, msg } = useL();
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
      setError(msg((err as Error).message));
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    setInfo(null);
    try {
      await post("/api/auth/resend", {});
      setInfo(l("We sent a new code.", "Te enviamos un código nuevo."));
    } catch (err) {
      setError(msg((err as Error).message));
    }
  }

  return (
    <form className="guest-form auth" onSubmit={submit}>
      <p className="auth-intro">
        <strong>{l("Confirm your email.", "Confirma tu email.")}</strong>{" "}
        {l("We sent a 6-digit code to", "Te enviamos un código de 6 dígitos a")} <strong>{email}</strong>.{" "}
        {l("It can take a minute; check your spam folder too.", "Puede tardar un minuto; revisa también la carpeta de spam.")}
      </p>
      <CodeInput value={code} onChange={setCode} />
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {info && <p className="notice">{info}</p>}
      <button className="pay" type="submit" disabled={busy || code.length !== 6}>
        {busy ? l("Checking…", "Verificando…") : l("Confirm email", "Confirmar email")}
      </button>
      <button type="button" className="link" onClick={resend}>
        {l("Send a new code", "Enviar un código nuevo")}
      </button>
    </form>
  );
}

export function AuthPanel({ intro, initialMode = "signup" }: { intro?: string; initialMode?: "signup" | "login" }) {
  const router = useRouter();
  const { lang, l, msg } = useL();
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
      if (mode === "signup") {
        await post("/api/auth/signup", { ...form, lang });
        track("signup");
      }
      else if (mode === "login") await post("/api/auth/login", { email: form.email, password: form.password });
      else if (mode === "forgot") {
        await post("/api/auth/reset/request", { email: form.email });
        setInfo(l("If there's an account with that email, we sent it a 6-digit code.", "Si hay una cuenta con ese email, le enviamos un código de 6 dígitos."));
        setMode("reset");
        setBusy(false);
        return;
      } else {
        await post("/api/auth/reset/confirm", { email: form.email, code, password: form.password });
      }
      // The server decides what comes next (e.g. the email code step).
      router.refresh();
    } catch (err) {
      setError(msg((err as Error).message));
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
            {l("Create account", "Crear cuenta")}
          </button>
          <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => go("login")}>
            {l("Sign in", "Iniciar sesión")}
          </button>
        </div>
      )}
      {mode === "forgot" && (
        <p className="auth-intro">
          {l("Enter your email and we'll send you a code to choose a new password.", "Escribe tu email y te enviaremos un código para elegir una contraseña nueva.")}
        </p>
      )}
      {mode === "reset" && (
        <p className="auth-intro">{l("Enter the code from your email and your new password.", "Escribe el código del email y tu nueva contraseña.")}</p>
      )}

      <form className="guest-form" onSubmit={submit}>
        {mode === "signup" && (
          <>
            <div className="row">
              <label>
                {l("First name", "Nombre")}
                <input required autoComplete="given-name" value={form.firstName} onChange={set("firstName")} />
              </label>
              <label>
                {l("Last name", "Apellido")}
                <input required autoComplete="family-name" value={form.lastName} onChange={set("lastName")} />
              </label>
            </div>
            <label>
              {l("Mobile phone", "Celular")}
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
            {mode === "reset" ? l("New password", "Contraseña nueva") : l("Password", "Contraseña")}
            <input
              required
              type="password"
              minLength={mode === "login" ? undefined : 10}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={form.password}
              onChange={set("password")}
            />
            {mode !== "login" && <span className="field-hint">{l("At least 10 characters.", "Al menos 10 caracteres.")}</span>}
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
            ? l("One moment…", "Un momento…")
            : {
                signup: l("Create account", "Crear cuenta"),
                login: l("Sign in", "Iniciar sesión"),
                forgot: l("Send code", "Enviar código"),
                reset: l("Save new password", "Guardar contraseña nueva"),
              }[mode]}
        </button>
        {mode === "login" && (
          <button type="button" className="link" onClick={() => go("forgot")}>
            {l("Forgot your password?", "¿Olvidaste tu contraseña?")}
          </button>
        )}
        {(mode === "forgot" || mode === "reset") && (
          <button type="button" className="link" onClick={() => go("login")}>
            {l("Back to sign in", "Volver a iniciar sesión")}
          </button>
        )}
        {mode === "signup" && (
          <p className="fine">
            {l(
              "We'll email you a code to confirm your address. Your phone is only used about your stay.",
              "Te enviaremos un código por email para confirmar tu dirección. Tu teléfono solo se usa para temas de tu estadía.",
            )}
          </p>
        )}
      </form>
    </div>
  );
}

export function SignOutButton({ admin = false }: { admin?: boolean }) {
  const router = useRouter();
  const { l } = useL();
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
      {admin ? "Sign out" : l("Sign out", "Cerrar sesión")}
    </button>
  );
}
