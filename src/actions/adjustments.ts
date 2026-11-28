"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseAmountInput, toNumber } from "@/lib/money";
import { parseDateInput } from "@/lib/format";

export type FormState = { error?: string; success?: string };

const ADJUSTMENT_SUPPLIER_NAME = "Inventory adjustments";

async function getOrCreateAdjustmentSupplier(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
  const existing = await tx.supplier.findFirst({
    where: { tenantId, name: ADJUSTMENT_SUPPLIER_NAME },
  });
  if (existing) return existing.id;
  const created = await tx.supplier.create({
    data: {
      tenantId,
      name: ADJUSTMENT_SUPPLIER_NAME,
      shareBps: 0,
      archived: true,
      isSystem: true,
      notes: "System supplier for manual stock adjustments.",
    },
  });
  return created.id;
}

export async function recordAdjustmentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const tenantId = session.tenant.id;

  const resourceId = String(formData.get("resourceId") ?? "");
  const deltaRaw = String(formData.get("delta") ?? "").trim();
  const sign = String(formData.get("sign") ?? "+");
  const reason = String(formData.get("reason") ?? "").trim();
  const occurredAt = parseDateInput(String(formData.get("occurredAt") ?? ""));

  const amount = parseAmountInput(deltaRaw);
  if (!resourceId) return { error: "Choose a resource." };
  if (amount === null || amount <= 0) return { error: "Enter a quantity greater than zero." };
  if (!occurredAt) return { error: "Choose a valid date." };

  const delta = sign === "-" ? -amount : amount;

  const resource = await prisma.resource.findFirst({ where: { id: resourceId, tenantId, archived: false } });
  if (!resource) return { error: "Resource not found." };

  try {
    await prisma.$transaction(async (tx) => {
      if (delta > 0) {
        const supplierId = await getOrCreateAdjustmentSupplier(tx, tenantId);
        const delivery = await tx.delivery.create({
          data: {
            tenantId,
            supplierId,
            resourceId,
            quantity: amount,
            unitCost: 0,
            receivedAt: occurredAt,
            note: `Adjustment: ${reason || "stock increase"}`,
          },
        });
        await tx.lot.create({
          data: {
            tenantId,
            deliveryId: delivery.id,
            supplierId,
            resourceId,
            quantityReceived: amount,
            quantityRemaining: amount,
            receivedAt: occurredAt,
          },
        });
      } else {
        let need = amount;
        const lots = await tx.lot.findMany({
          where: { tenantId, resourceId, quantityRemaining: { gt: 0 } },
          orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
        });
        for (const lot of lots) {
          if (need <= 0) break;
          const take = Math.min(need, toNumber(lot.quantityRemaining));
          if (take <= 0) continue;
          await tx.lot.update({
            where: { id: lot.id },
            data: { quantityRemaining: { decrement: take } },
          });
          need -= take;
        }
        if (need > 0) {
          throw new Error(`Not enough stock to remove ${amount} units.`);
        }
      }

      await logAudit(tx, {
        tenantId,
        userId: session.user.id,
        action: "inventory.adjusted",
        entity: "resource",
        entityId: resourceId,
        detail: `${delta > 0 ? "+" : "-"}${amount} ${resource.name} — ${reason || "adjustment"}`,
      });
    });
  } catch (err: any) {
    return { error: err?.message ?? "Could not record adjustment." };
  }

  revalidatePath("/");
  revalidatePath("/inventory");
  return { success: "Adjustment recorded." };
}