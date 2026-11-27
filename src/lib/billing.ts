/**
 * Billing — PayMongo (Phase 2a: Philippines local gateways).
 *
 * PayMongo amounts are in the smallest currency unit (centavos for PHP).
 * Checkout sessions are one-time; renewal is handled by re-checkout or
 * upgraded to Paddle/Lemon Squeezy later for auto-renewal.
 */

export type PaidPlan = "mid" | "premium";

export type PlanPrice = {
  plan: PaidPlan;
  amount: number; // centavos
  currency: "PHP";
  label: string;
  description: string;
};

export const PLAN_PRICES: Record<PaidPlan, PlanPrice> = {
  mid: {
    plan: "mid",
    amount: 69900, // ₱699.00
    currency: "PHP",
    label: "₱699 / month",
    description: "Mid plan — monthly subscription",
  },
  premium: {
    plan: "premium",
    amount: 229900, // ₱2,299.00
    currency: "PHP",
    label: "₱2,299 / month",
    description: "Premium plan — monthly subscription",
  },
};

export const PAYMENT_METHOD_TYPES = ["gcash", "paymaya", "card", "grab_pay"];

export function paymongoSecretKey(): string {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new Error("PAYMONGO_SECRET_KEY is not set.");
  return key;
}

export function paymongoWebhookSecret(): string {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret) throw new Error("PAYMONGO_WEBHOOK_SECRET is not set.");
  return secret;
}

export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export type CheckoutSession = {
  id: string;
  checkoutUrl: string;
};

export async function createPaymongoCheckoutSession(params: {
  tenantId: string;
  plan: PaidPlan;
}): Promise<CheckoutSession> {
  const price = PLAN_PRICES[params.plan];
  const res = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${paymongoSecretKey()}:`).toString("base64")}`,
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [
            {
              currency: price.currency,
              amount: price.amount,
              name: price.description,
              quantity: 1,
            },
          ],
          payment_method_types: PAYMENT_METHOD_TYPES,
          success_url: `${appBaseUrl()}/settings/billing?success=1&plan=${params.plan}`,
          cancel_url: `${appBaseUrl()}/settings/billing?canceled=1`,
          description: price.description,
          metadata: {
            tenantId: params.tenantId,
            plan: params.plan,
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayMongo checkout failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as {
    data: { id: string; attributes: { checkout_url: string } };
  };
  return { id: json.data.id, checkoutUrl: json.data.attributes.checkout_url };
}

/**
 * Verify a PayMongo webhook signature.
 * Header format: "t=<timestamp>,te=<test_sig>,li=<live_sig>"
 */
export function verifyPaymongoSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const secret = paymongoWebhookSecret();

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k, v.join("=")];
    }),
  );

  const timestamp = parts.t;
  const testSig = parts.te;
  const liveSig = parts.li;
  if (!timestamp) return false;

  const crypto = require("node:crypto") as typeof import("node:crypto");
  const signedPayload = `${timestamp}.${rawBody}`;
  const computed = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

  // Accept either test or live signature (PayMongo sends both; which is valid depends on mode).
  const candidates = [testSig, liveSig].filter(Boolean) as string[];
  return candidates.some((sig) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(sig));
    } catch {
      return false;
    }
  });
}