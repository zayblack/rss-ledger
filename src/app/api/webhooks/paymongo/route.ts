import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPaymongoSignature } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("paymongo-signature");

  if (!verifyPaymongoSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    data?: {
      attributes?: {
        type?: string;
        data?: {
          id?: string;
          attributes?: {
            metadata?: { tenantId?: string; plan?: string };
            status?: string;
          };
        };
      };
    };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = event?.data?.attributes?.type;
  const payload = event?.data?.attributes?.data;
  const attributes = payload?.attributes;
  const metadata = attributes?.metadata;
  const tenantId = metadata?.tenantId;
  const plan = metadata?.plan;

  // Handle successful checkout payment.
  if (type === "checkout_session.payment.paid" && tenantId && (plan === "mid" || plan === "premium")) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        plan,
        subscriptionStatus: "active",
        subscriptionExpiresAt: expiresAt,
        billingProvider: "paymongo",
        billingSubscriptionId: payload?.id ?? null,
      },
    });
  }

  // Handle payment failure / expiry (best-effort).
  if (type === "payment.failed" && tenantId) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: "past_due" },
    });
  }

  return NextResponse.json({ received: true });
}