"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { planSale, type PlanLine } from "@/lib/calc";
import { nextSaleReference } from "@/lib/references";
import { floorBps, toNumber } from "@/lib/money";
import { logAudit } from "@/lib/audit";
import { parseDateInput } from "@/lib/format";

class ActionError extends Error {}

const saleSchema = z.object({
  customerName: z.string().trim().min(1, "Enter a customer name.").max(120),
  soldAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid sale date."),
  notes: z.string().max(2000).optional(),
  level: z.number().int().min(1).max(999),
  lines: z
    .array(
      z.object({
        resourceId: z.string().min(1),
        quantity: z.number().int().positive("Quantities must be whole numbers."),
        unitPrice: z.number().int().positive("Unit prices must be whole numbers."),
      }),
    )
    .min(1, "Add at least one resource.")
    .max(50),
});

export type CreateSaleInput = z.infer<typeof saleSchema>;
export type CreateSaleResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Reads the tenant's existing references and delegates the numbering rule to
 * the pure helper. Concurrent posts can still pick the same number;
 * createSaleAction retries on the unique conflict.
 */
async function nextReferenceForTenant(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<string> {
  const rows = await tx.sale.findMany({
    where: { tenantId },
    select: { reference: true },
  });
  return nextSaleReference(rows.map((row) => row.reference));
}

function isReferenceConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes("reference") : true;
}

export async function createSaleAction(
  input: CreateSaleInput,
): Promise<CreateSaleResult> {
  const session = await requireSession();
  const tenantId = session.tenant.id;

  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid sale." };
  }

  const data = parsed.data;
  const soldAt = parseDateInput(data.soldAt);
  if (!soldAt) return { ok: false, error: "Choose a valid sale date." };

  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const saleId = await prisma.$transaction(
        async (tx) => {
          const level = await tx.tradingPostLevel.findUnique({
            where: { tenantId_level: { tenantId, level: data.level } },
          });
          if (!level) {
            throw new ActionError(`Trading post level ${data.level} is not configured.`);
          }

          const resourceIds = [...new Set(data.lines.map((line) => line.resourceId))];
          const resources = await tx.resource.findMany({
            where: { tenantId, id: { in: resourceIds }, archived: false },
          });
          const resourceMap = new Map(resources.map((resource) => [resource.id, resource]));
          if (resourceMap.size !== resourceIds.length) {
            throw new ActionError("One of the selected resources is no longer available.");
          }

          const planLines: PlanLine[] = data.lines.map((line) => {
            const resource = resourceMap.get(line.resourceId)!;
            return {
              resourceId: line.resourceId,
              name: resource.name,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
            };
          });

          const planned = planSale(planLines, {
            level: level.level,
            maxCargoValue: toNumber(level.maxCargoValue),
            taxRateBps: level.taxRateBps,
            flatFee: toNumber(level.flatFee),
            minTax: toNumber(level.minTax),
          });
          if (!planned.ok) throw new ActionError(planned.error);
          const plan = planned.plan;

          const stockRows = await tx.lot.groupBy({
            by: ["resourceId"],
            where: { tenantId, resourceId: { in: resourceIds } },
            _sum: { quantityRemaining: true },
          });
          const stockMap = new Map(
            stockRows.map((row) => [row.resourceId, toNumber(row._sum.quantityRemaining)]),
          );

          for (const line of data.lines) {
            const available = stockMap.get(line.resourceId) ?? 0;
            if (line.quantity > available) {
              throw new ActionError(
                `Not enough ${resourceMap.get(line.resourceId)!.name}: need ${line.quantity}, have ${available}.`,
              );
            }
          }

          const reference = await nextReferenceForTenant(tx, tenantId);

          const sale = await tx.sale.create({
            data: {
              tenantId,
              reference,
              customerName: data.customerName,
              soldAt,
              notes: data.notes?.trim() || null,
              status: "draft",
            },
          });

          const suppliers = await tx.supplier.findMany({ where: { tenantId } });
          const supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
          const credits = new Map<string, number>();

          for (const line of data.lines) {
            const resource = resourceMap.get(line.resourceId)!;
            const lineTotal = line.quantity * line.unitPrice;

            const createdLine = await tx.saleLine.create({
              data: {
                saleId: sale.id,
                resourceId: line.resourceId,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                lineTotal,
              },
            });

            let need = line.quantity;
            const lots = await tx.lot.findMany({
              where: {
                tenantId,
                resourceId: line.resourceId,
                quantityRemaining: { gt: 0 },
              },
              orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
            });

            for (const lot of lots) {
              if (need <= 0) break;
              const take = Math.min(need, toNumber(lot.quantityRemaining));
              if (take <= 0) continue;

              const supplier = supplierMap.get(lot.supplierId);
              if (!supplier) {
                throw new ActionError("A supplier attached to this stock no longer exists.");
              }

              const shareAmount = floorBps(take * line.unitPrice, supplier.shareBps);

              await tx.lot.update({
                where: { id: lot.id },
                data: { quantityRemaining: { decrement: take } },
              });

              await tx.lotConsumption.create({
                data: {
                  saleId: sale.id,
                  saleLineId: createdLine.id,
                  lotId: lot.id,
                  supplierId: lot.supplierId,
                  quantity: take,
                  unitPrice: line.unitPrice,
                  shareBps: supplier.shareBps,
                  shareAmount,
                },
              });

              credits.set(lot.supplierId, (credits.get(lot.supplierId) ?? 0) + shareAmount);
              need -= take;
            }

            if (need > 0) {
              throw new ActionError(
                `Stock for ${resource.name} changed while planning. Refresh and try again.`,
              );
            }
          }

          for (const trip of plan.trips) {
            const createdTrip = await tx.trip.create({
              data: {
                saleId: sale.id,
                seq: trip.seq,
                level: trip.level,
                capacity: trip.capacity,
                cargoValue: trip.cargoValue,
                tax: trip.tax,
              },
            });

            for (const item of trip.items) {
              await tx.tripItem.create({
                data: {
                  tripId: createdTrip.id,
                  resourceId: item.resourceId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  value: item.value,
                },
              });
            }
          }

          let supplierShareTotal = 0;
          for (const [supplierId, amount] of credits) {
            supplierShareTotal += amount;
            if (amount <= 0) continue;
            await tx.supplierLedgerEntry.create({
              data: {
                tenantId,
                supplierId,
                type: "credit",
                amount,
                refType: "sale",
                refId: sale.id,
                occurredAt: soldAt,
                note: `Sale ${reference}`,
              },
            });
          }

          await tx.sale.update({
            where: { id: sale.id },
            data: {
              status: "posted",
              postedAt: new Date(),
              grossTotal: plan.gross,
              taxTotal: plan.tax,
              netTotal: plan.net,
              supplierShareTotal,
            },
          });

          await logAudit(tx, {
            tenantId,
            userId: session.user.id,
            action: "sale.posted",
            entity: "sale",
            entityId: sale.id,
            detail: `${reference} · ${data.customerName} · gross ${plan.gross} · tax ${plan.tax} · net ${plan.net}`,
          });

          return sale.id;
        },
        { timeout: 20_000 },
      );

      revalidatePath("/");
      revalidatePath("/sales");
      revalidatePath("/inventory");
      revalidatePath("/suppliers");

      return { ok: true, id: saleId };
    } catch (error) {
      if (error instanceof ActionError) {
        return { ok: false, error: error.message };
      }
      if (isReferenceConflict(error) && attempt < MAX_ATTEMPTS) continue;
      console.error("createSaleAction", error);
      return { ok: false, error: "Could not post the sale. Please try again." };
    }
  }

  return { ok: false, error: "Could not post the sale. Please try again." };
}

export async function voidSaleAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const tenantId = session.tenant.id;
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!id) redirect("/sales");
  if (reason.length < 3) {
    redirect(`/sales/${id}?error=${encodeURIComponent("Add a short reason for voiding.")}`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({ where: { id, tenantId } });
    if (!sale || sale.status !== "posted") {
      return { error: "Only posted sales can be voided." as string | null };
    }

    const consumptions = await tx.lotConsumption.findMany({ where: { saleId: id } });
    for (const consumption of consumptions) {
      await tx.lot.update({
        where: { id: consumption.lotId },
        data: { quantityRemaining: { increment: consumption.quantity } },
      });
    }

    const credits = await tx.supplierLedgerEntry.findMany({
      where: { tenantId, refType: "sale", refId: id, type: "credit" },
    });
    for (const credit of credits) {
      await tx.supplierLedgerEntry.create({
        data: {
          tenantId,
          supplierId: credit.supplierId,
          type: "reversal",
          amount: -toNumber(credit.amount),
          refType: "sale",
          refId: id,
          occurredAt: new Date(),
          note: `Voided ${sale.reference}: ${reason}`,
        },
      });
    }

    await tx.sale.update({
      where: { id },
      data: { status: "void", voidedAt: new Date(), voidReason: reason },
    });

    await logAudit(tx, {
      tenantId,
      userId: session.user.id,
      action: "sale.voided",
      entity: "sale",
      entityId: id,
      detail: reason,
    });

    return { error: null as string | null };
  });

  revalidatePath("/");
  revalidatePath("/sales");
  revalidatePath(`/sales/${id}`);
  revalidatePath("/inventory");
  revalidatePath("/suppliers");

  if (result.error) {
    redirect(`/sales/${id}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/sales/${id}`);
}

export async function deleteDraftAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/sales");

  await prisma.sale.deleteMany({
    where: { id, tenantId: session.tenant.id, status: "draft" },
  });

  revalidatePath("/sales");
  redirect("/sales");
}
