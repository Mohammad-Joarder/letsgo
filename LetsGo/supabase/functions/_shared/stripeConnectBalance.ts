import type Stripe from "https://esm.sh/stripe@17.4.0?target=deno";

export type ConnectBalanceSnapshot = {
  availableCents: number;
  pendingCents: number;
  bankAccountAvailableCents: number;
  cardAvailableCents: number;
};

function sumCurrency(
  entries: Stripe.Balance["available"] | Stripe.Balance["pending"],
  currency: string
): number {
  const cur = currency.toLowerCase();
  let total = 0;
  for (const entry of entries ?? []) {
    if (entry.currency.toLowerCase() === cur) total += entry.amount;
  }
  return total;
}

function sourceTypeCents(
  entries: Stripe.Balance["available"],
  currency: string,
  sourceType: "bank_account" | "card"
): number {
  const cur = currency.toLowerCase();
  let total = 0;
  for (const entry of entries ?? []) {
    if (entry.currency.toLowerCase() !== cur) continue;
    const st = entry.source_types as Record<string, number> | undefined;
    if (st && typeof st[sourceType] === "number") {
      total += st[sourceType]!;
    }
  }
  return total;
}

export function readConnectBalance(
  balance: Stripe.Balance,
  currency = "aud"
): ConnectBalanceSnapshot {
  return {
    availableCents: sumCurrency(balance.available, currency),
    pendingCents: sumCurrency(balance.pending, currency),
    bankAccountAvailableCents: sourceTypeCents(balance.available, currency, "bank_account"),
    cardAvailableCents: sourceTypeCents(balance.available, currency, "card"),
  };
}

/** Total available cents on the connected account (all source types). */
export function availableConnectCents(balance: Stripe.Balance, currency = "aud"): number {
  return readConnectBalance(balance, currency).availableCents;
}

/**
 * Stripe payout source_type for Connect — default is `card`, which fails when funds
 * are only in the bank_account bucket (common after transfers).
 */
export function pickPayoutSourceType(
  balance: Stripe.Balance,
  amountCents: number,
  currency = "aud"
): "bank_account" | "card" | null {
  const snap = readConnectBalance(balance, currency);
  if (snap.bankAccountAvailableCents >= amountCents) return "bank_account";
  if (snap.cardAvailableCents >= amountCents) return "card";
  if (snap.availableCents >= amountCents) {
    // Funds exist but source_types split is missing or uneven — prefer bank (transfers).
    if (snap.bankAccountAvailableCents >= snap.cardAvailableCents) return "bank_account";
    return "card";
  }
  return null;
}

export async function waitForConnectBalance(
  stripe: Stripe,
  connectId: string,
  minCents: number,
  currency = "aud",
  opts?: { attempts?: number; delayMs?: number }
): Promise<{ available: number; balance: Stripe.Balance; snapshot: ConnectBalanceSnapshot }> {
  const attempts = opts?.attempts ?? 10;
  const delayMs = opts?.delayMs ?? 500;
  let lastBalance: Stripe.Balance | null = null;
  let lastSnap: ConnectBalanceSnapshot = {
    availableCents: 0,
    pendingCents: 0,
    bankAccountAvailableCents: 0,
    cardAvailableCents: 0,
  };

  for (let i = 0; i < attempts; i++) {
    const balance = await stripe.balance.retrieve({ stripeAccount: connectId });
    lastBalance = balance;
    lastSnap = readConnectBalance(balance, currency);
    if (lastSnap.availableCents >= minCents) {
      return { available: lastSnap.availableCents, balance, snapshot: lastSnap };
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return {
    available: lastSnap.availableCents,
    balance: lastBalance!,
    snapshot: lastSnap,
  };
}

/** @deprecated Use availableConnectCents — kept for imports during deploy */
export function availableBankCents(balance: Stripe.Balance, currency = "aud"): number {
  return availableConnectCents(balance, currency);
}

export async function waitForBankBalance(
  stripe: Stripe,
  connectId: string,
  minCents: number,
  currency = "aud",
  opts?: { attempts?: number; delayMs?: number }
): Promise<number> {
  const { available } = await waitForConnectBalance(stripe, connectId, minCents, currency, opts);
  return available;
}
