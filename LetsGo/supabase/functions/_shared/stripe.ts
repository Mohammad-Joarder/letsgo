import Stripe from "https://esm.sh/stripe@17.4.0?target=deno";

const API_VERSION = "2024-11-20.acacia";

export function getStripe(): Stripe {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key, {
    apiVersion: API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export function audToCents(aud: number): number {
  return Math.round(aud * 100);
}

export function centsToAud(cents: number): number {
  return Math.round(cents) / 100;
}
