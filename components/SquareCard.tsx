"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

// Minimal typings for the Square Web Payments SDK (loaded from Square's CDN).
type TokenResult = { status: string; token?: string; errors?: Array<{ message: string }> };
type SquareCardInstance = {
  attach: (selector: string | HTMLElement) => Promise<void>;
  tokenize: (verificationDetails: object) => Promise<TokenResult>;
  destroy: () => Promise<boolean>;
};
type SquarePayments = { card: (options?: object) => Promise<SquareCardInstance> };
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

export const SquareCard = forwardRef<SquareCardHandle>(function SquareCard(_props, ref) {
  const container = useRef<HTMLDivElement>(null);
  const card = useRef<SquareCardInstance | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    let instance: SquareCardInstance | null = null;
    (async () => {
      try {
        if (!APP_ID || !LOCATION_ID) throw new Error("Square isn't configured.");
        await loadSquare();
        const payments = window.Square!.payments(APP_ID, LOCATION_ID);
        instance = await payments.card({
          style: {
            input: { fontSize: "16px", color: "#12332d" },
            ".input-container.is-focus": { borderColor: "#e7ad35" },
          },
        });
        if (cancelled) return void instance.destroy();
        await instance.attach(container.current!);
        card.current = instance;
        setStatus("ready");
      } catch (err) {
        console.error("[square]", err);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      card.current = null;
      instance?.destroy().catch(() => undefined);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    async tokenize(amountCents, contact) {
      if (!card.current) throw new Error("The payment form isn't ready yet.");
      const result = await card.current.tokenize({
        amount: (amountCents / 100).toFixed(2),
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
      <span className="card-label">Card</span>
      <div ref={container} />
      {status === "loading" && <p className="notice">Loading secure card form…</p>}
      {status === "error" && (
        <p className="notice error" role="alert">
          The card form couldn&apos;t load. Refresh the page to try again.
        </p>
      )}
    </div>
  );
});
