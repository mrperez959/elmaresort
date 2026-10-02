import "server-only";
import { SquareClient, SquareEnvironment, SquareError } from "square";
import { env } from "./env";

let client: SquareClient | null = null;

export function square(): SquareClient {
  if (!client) {
    client = new SquareClient({
      token: env.squareAccessToken(),
      environment: env.squareProduction() ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
    });
  }
  return client;
}

const CARD_MESSAGES: Record<string, string> = {
  GENERIC_DECLINE: "Your card was declined. Try a different card or contact your bank.",
  CARD_DECLINED: "Your card was declined. Try a different card or contact your bank.",
  INSUFFICIENT_FUNDS: "Your card was declined for insufficient funds.",
  CVV_FAILURE: "The security code (CVV) doesn't match. Check it and try again.",
  ADDRESS_VERIFICATION_FAILURE: "The ZIP code doesn't match your card. Check it and try again.",
  INVALID_EXPIRATION: "The expiration date is invalid. Check it and try again.",
  CARD_EXPIRED: "This card has expired. Use a different card.",
  INVALID_CARD: "The card number isn't valid. Check it and try again.",
  CARD_NOT_SUPPORTED: "This card type isn't accepted. Use a different card.",
  CARD_DECLINED_VERIFICATION_REQUIRED: "Your bank needs to verify this payment. Try again and complete the verification.",
  TRANSACTION_LIMIT: "This charge is over your card's limit. Use a different card.",
};

/** A friendly message if Square declined the card, otherwise null. */
export function cardDeclineMessage(err: unknown): string | null {
  if (!(err instanceof SquareError)) return null;
  for (const e of err.errors ?? []) {
    if (CARD_MESSAGES[e.code]) return CARD_MESSAGES[e.code];
    if (e.category === "PAYMENT_METHOD_ERROR") return "Your card couldn't be charged. Try a different card.";
  }
  return null;
}
