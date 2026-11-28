"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseAmountInput, toNumber } from "@/lib/money";
import { parseDateInput } from "@/lib/format";

export type FormState = { error?: string; success?: string };

export async function recordDeliveryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const tenantId = session.tenant.id;

  const supplierId = String(formData.get("supplierId") ?? "");
  const resourceId = String(formData.get("resourceId") ?? "");
  const quantity = parseAmountInput(formData.get("quantity"));
  const unitCost = parseAmountInput(formData.get("unitCost")) ?? 0;
  const receivedAt = parseDateInput(String(formData.get("receivedAt") ?? ""));
  const note = String(formData.get("note") ?? "").trim();

  if (!supplierId || !resourceId) return { error: "Choose a supplier and a resource." };
  if (quantity === null || quantity <= 0) return { error: "Enter a quantity greater than zero." };
  if (!receivedAt) return { error: "Choose a valid delivery date." };

  const [supplier, resource] = await Promise.all([
    prisma.supplier.findFirst({ where: { id: supplierId, tenantId, archived: false } }),
    prisma.resource.findFirst({ where: { id: resourceId, tenantId, archived: false } }),
  ]);

  if (!supplier) return { error: "Supplier not found." };
  if (!resource) return { error: "Resource not found." };

  await prisma.$transaction(async (tx) => {
    const delivery = await tx.delivery.create({
      data: {
        tenantId,
        supplierId,
        resourceId,
        quantity,
        unitCost,
        receivedAt,
        note: note || null,
      },
    });

    await tx.lot.create({
      data: {
        tenantId,
        deliveryId: delivery.id,
        supplierId,
        resourceId,
        quantityReceived: quantity,
        quantityRemaining: quantity,
        receivedAt,
      },
    });

    await logAudit(tx, {
      tenantId,
      userId: session.user.id,
      action: "delivery.recorded",
      entity: "delivery",
      entityId: delivery.id,
      detail: `${quantity} × ${resource.name} from ${supplier.name}`,
    });
  });

  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${supplierId}`);
  redirect("/inventory?added=1");
}

export async function voidDeliveryAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const tenantId = session.tenant.id;
  const deliveryId = String(formData.get("deliveryId") ?? "");

  const delivery = await prisma.delivery.findFirst({
    where: { id: deliveryId, tenantId },
    include: { lots: true, resource: true },
  });

  if (!delivery) redirect("/inventory");

  const untouched = delivery.lots.every(
    (lot) => toNumber(lot.quantityRemaining) === toNumber(lot.quantityReceived),
  );

  if (!untouched) {
    redirect(
      `/inventory?error=${encodeURIComponent(
        `That ${delivery.resource.name} delivery has already been sold from. Void the related sales first.`,
      )}`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.lot.deleteMany({ where: { deliveryId, tenantId } });
    await tx.delivery.delete({ where: { id: deliveryId } });
    await logAudit(tx, {
      tenantId,
      userId: session.user.id,
      action: "delivery.voided",
      entity: "delivery",
      entityId: deliveryId,
      detail: `${delivery.quantity} × ${delivery.resource.name}`,
    });
  });

  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/suppliers");
  redirect("/inventory?removed=1");
}
