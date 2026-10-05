"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useL } from "./LangProvider";

// Minimal typings for the Square Web Payments SDK (loaded from Square's CDN).
type TokenResult = { status: string; token?: string; errors?: Array<{ message: string }> };
type Tokenizer = {
  attach?: (selector: string | HTMLElement, options?: object) => Promise<void>;
  tokenize: (verificationDetails?: object) => Promise<TokenResult>;
  destroy: () => Promise<boolean>;
};
type PaymentRequest = { update: (o: object) => void };
type SquarePayments = {
  card: (options?: object) => Promise<Tokenizer>;
  paymentRequest: (o: object) => PaymentRequest;
  googlePay: (r: PaymentRequest) => Promise<Tokenizer>;
  applePay: (r: PaymentRequest) => Promise<Tokenizer>;
};
declare global {
  interface Window {
    Square?: { payments: (applicationId: string, locationId: string) => SquarePayments };
  }
}

const APP_ID = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID ?? "";
const LOCATION_ID = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ?? "";
const SCRIPT_URL =
  process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === "production"
    ? "https://web.squarecdn.com/v1/square.js"
    : "https://sandbox.web.squarecdn.com/v1/square.js";

let scriptPromise: Promise<void> | null = null;
function loadSquare(): Promise<void> {
  if (window.Square) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_URL;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error("The payment form couldn't load."));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export type BillingContact = { givenName: string; familyName: string; email: string; phone?: string };

export type SquareCardHandle = {
  /** Returns a single-use card token, or throws with a message for the guest. */
  tokenize: (amountCents: number, contact: BillingContact) => Promise<string>;
};

type Props = {
  /** Show Apple Pay / Google Pay for this amount. Leave out for card only. */
  walletAmountCents?: number;
  /** Called with a wallet token when the guest pays with Apple Pay or Google Pay. */
  onWalletToken?: (token: string) => void;
  /** Return an error message to stop a wallet payment before it opens (e.g. terms not accepted). */
  beforeWallet?: () => string | null;
};

const dollars = (cents: number) => (cents / 100).toFixed(2);

export const SquareCard = forwardRef<SquareCardHandle, Props>(function SquareCard(props, ref) {
  const { walletAmountCents, onWalletToken, beforeWallet } = props;
  const { l } = useL();
  const container = useRef<HTMLDivElement>(null);
  const googleBox = useRef<HTMLDivElement>(null);
  const card = useRef<Tokenizer | null>(null);
  const request = useRef<PaymentRequest | null>(null);
  const wallets = useRef<{ google: Tokenizer | null; apple: Tokenizer | null }>({ google: null, apple: null });
  const callbacks = useRef({ onWalletToken, beforeWallet });
  callbacks.current = { onWalletToken, beforeWallet };
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [detail, setDetail] = useState("");
  const [hasApple, setHasApple] = useState(false);
  const [hasGoogle, setHasGoogle] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const wantWallets = walletAmountCents !== undefined && Boolean(onWalletToken);

  useEffect(() => {
    let cancelled = false;
    const created: Tokenizer[] = [];
    (async () => {
      try {
        if (!APP_ID) throw new Error("NEXT_PUBLIC_SQUARE_APPLICATION_ID is missing (add it in Vercel and redeploy).");
        if (!LOCATION_ID) throw new Error("NEXT_PUBLIC_SQUARE_LOCATION_ID is missing (add it in Vercel and redeploy).");
        const sandboxId = APP_ID.startsWith("sandbox-");
        const sandboxEnv = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT !== "production";
        if (sandboxId !== sandboxEnv) {
          throw new Error(
            sandboxId
              ? "The Application ID is a Sandbox one but NEXT_PUBLIC_SQUARE_ENVIRONMENT is production."
              : "The Application ID is a Production one but NEXT_PUBLIC_SQUARE_ENVIRONMENT isn't production.",
          );
        }
        await loadSquare();
        const payments = window.Square!.payments(APP_ID, LOCATION_ID);
        const instance = await payments.card({
          style: {
            input: { fontSize: "16px", color: "#01325b" },
            ".input-container.is-focus": { borderColor: "#fe6b51" },
          },
        });
        created.push(instance);
        if (cancelled) return;
        await instance.attach!(container.current!);
        card.current = instance;
        setStatus("ready");

        if (!wantWallets) return;
        const req = payments.paymentRequest({
          countryCode: "US",
          currencyCode: "USD",
          total: { amount: dollars(walletAmountCents!), label: "Total" },
        });
        request.current = req;
        // Each wallet is optional: it only shows where the device/browser supports it.
        try {
          const g = await payments.googlePay(req);
          created.push(g);
          if (!cancelled && googleBox.current) {
            await g.attach!(googleBox.current, { buttonColor: "black", buttonSizeMode: "fill", buttonType: "long" });
            wallets.current.google = g;
            setHasGoogle(true);
          }
        } catch {
          /* not available */
        }
        try {
          const a = await payments.applePay(req);
          created.push(a);
          if (!cancelled) {
            wallets.current.apple = a;
            setHasApple(true);
          }
        } catch {
          /* not available (e.g. not Safari, or domain not registered for Apple Pay) */
        }
      } catch (err) {
        console.error("[square]", err);
        if (!cancelled) {
          setStatus("error");
          setDetail((err as Error)?.message ?? String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
      card.current = null;
      wallets.current = { google: null, apple: null };
      created.forEach((t) => t.destroy().catch(() => undefined));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantWallets]);

  // Keep the wallet sheets showing the current total.
  useEffect(() => {
    if (walletAmountCents !== undefined) {
      request.current?.update({ total: { amount: dollars(walletAmountCents), label: "Total" } });
    }
  }, [walletAmountCents]);

  async function payWith(kind: "google" | "apple") {
    setWalletError(null);
    const stop = callbacks.current.beforeWallet?.();
    if (stop) return setWalletError(stop);
    const w = wallets.current[kind];
    if (!w) return;
    try {
      const result = await w.tokenize();
      if (result.status === "OK" && result.token) callbacks.current.onWalletToken?.(result.token);
      else if (result.status !== "Cancel") setWalletError(result.errors?.[0]?.message ?? l("Payment couldn't be completed. Try again.", "No se pudo completar el pago. Inténtalo de nuevo."));
    } catch (err) {
      console.error("[square wallet]", err);
    }
  }

  useImperativeHandle(ref, () => ({
    async tokenize(amountCents, contact) {
      if (!card.current) throw new Error("The payment form isn't ready yet.");
      const result = await card.current.tokenize({
        amount: dollars(amountCents),
        currencyCode: "USD",
        intent: "CHARGE",
        customerInitiated: true,
        sellerKeyedIn: false,
        billingContact: { ...contact, countryCode: "US" },
      });
      if (result.status === "OK" && result.token) return result.token;
      throw new Error(result.errors?.[0]?.message ?? "Check your card details and try again.");
    },
  }));

  return (
    <div className="card-field">
      {wantWallets && (
        <div className="wallets" hidden={!hasApple && !hasGoogle}>
          {hasApple && (
            <button
              type="button"
              className="apple-pay"
              aria-label={l("Pay with Apple Pay", "Pagar con Apple Pay")}
              onClick={() => payWith("apple")}
            />
          )}
          <div
            ref={googleBox}
            className="google-pay"
            hidden={!hasGoogle}
            onClick={() => payWith("google")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && payWith("google")}
          />
          {walletError && (
            <p className="notice error" role="alert">
              {walletError}
            </p>
          )}
          <div className="or-card">
            <span>{l("or pay with card", "o paga con tarjeta")}</span>
          </div>
        </div>
      )}
      <span className="card-label">{l("Card", "Tarjeta")}</span>
      <div ref={container} />
      {status === "loading" && <p className="notice">{l("Loading secure card form…", "Cargando el formulario seguro de tarjeta…")}</p>}
      {status === "error" && (
        <p className="notice error" role="alert">
          {l("The card form couldn't load. Refresh the page to try again.", "El formulario de tarjeta no cargó. Recarga la página para intentarlo de nuevo.")}
          {detail && <span className="error-detail">Details: {detail}</span>}
        </p>
      )}
    </div>
  );
});
