"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { createPaymongoCheckoutSession, type PaidPlan } from "@/lib/billing";

export async function createCheckoutAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const tenantId = session.tenant.id;

  const plan = String(formData.get("plan") ?? "") as PaidPlan;
  if (plan !== "mid" && plan !== "premium") {
    redirect("/settings/billing?error=invalid-plan");
  }

  try {
    const checkout = await createPaymongoCheckoutSession({ tenantId, plan });
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { billingProvider: "paymongo", billingSubscriptionId: checkout.id },
    });
    redirect(checkout.checkoutUrl);
  } catch (err) {
    console.error("createCheckoutAction", err);
    redirect("/settings/billing?error=checkout-failed");
  }
}