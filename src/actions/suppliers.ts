"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { requireLimit, EntitlementError } from "@/lib/entitlements";
import { parseAmountInput, parsePercentInput } from "@/lib/money";
import { parseDateInput } from "@/lib/format";

export type FormState = { error?: string; success?: string };

export async function createSupplierAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const tenantId = session.tenant.id;

  const name = String(formData.get("name") ?? "").trim();
  const shareBps = parsePercentInput(formData.get("share"));
  const contact = String(formData.get("contact") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (name.length < 2) return { error: "Enter a supplier name." };
  if (shareBps === null) return { error: "Enter a share between 0% and 100%." };

  const existing = await prisma.supplier.findUnique({
    where: { tenantId_name: { tenantId, name } },
  });
  if (existing) return { error: "A supplier with that name already exists." };

  // Entitlement: supplier cap.
  try {
    const count = await prisma.supplier.count({ where: { tenantId, archived: false } });
    requireLimit(session.tenant.plan, "suppliers", count);
  } catch (err) {
    if (err instanceof EntitlementError) return { error: err.message };
    throw err;
  }

  const supplier = await prisma.$transaction(async (tx) => {
    const created = await tx.supplier.create({
      data: { tenantId, name, shareBps, contact: contact || null, notes: notes || null },
    });
    await logAudit(tx, {
      tenantId,
      userId: session.user.id,
      action: "supplier.created",
      entity: "supplier",
      entityId: created.id,
      detail: name,
    });
    return created;
  });

  revalidatePath("/");
  revalidatePath("/suppliers");
  redirect(`/suppliers/${supplier.id}`);
}

export async function updateSupplierAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const tenantId = session.tenant.id;
  const id = String(formData.get("id") ?? "");

  const name = String(formData.get("name") ?? "").trim();
  const shareBps = parsePercentInput(formData.get("share"));
  const contact = String(formData.get("contact") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!id) return { error: "Missing supplier." };
  if (name.length < 2) return { error: "Enter a supplier name." };
  if (shareBps === null) return { error: "Enter a share between 0% and 100%." };

  const supplier = await prisma.supplier.findFirst({ where: { id, tenantId } });
  if (!supplier) return { error: "Supplier not found." };

  const clash = await prisma.supplier.findFirst({
    where: { tenantId, name, NOT: { id } },
  });
  if (clash) return { error: "Another supplier already uses that name." };

  await prisma.supplier.update({
    where: { id },
    data: { name, shareBps, contact: contact || null, notes: notes || null },
  });

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  return { success: "Supplier updated." };
}

export async function recordPaymentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const tenantId = session.tenant.id;

  const supplierId = String(formData.get("supplierId") ?? "");
  const amount = parseAmountInput(formData.get("amount"));
  const paidAt = parseDateInput(String(formData.get("paidAt") ?? ""));
  const method = String(formData.get("method") ?? "cash").trim() || "cash";
  const note = String(formData.get("note") ?? "").trim();

  if (!supplierId) return { error: "Missing supplier." };
  if (amount === null || amount <= 0) return { error: "Enter an amount greater than zero." };
  if (!paidAt) return { error: "Choose a valid payment date." };

  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId } });
  if (!supplier) return { error: "Supplier not found." };

  const balanceRows = await prisma.supplierLedgerEntry.aggregate({
    where: { tenantId, supplierId },
    _sum: { amount: true },
  });
  const balance = Number(balanceRows._sum.amount ?? 0n);

  if (amount > balance) {
    return {
      error: `That is more than the outstanding balance (${balance.toLocaleString("en-US")}).`,
    };
  }

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        tenantId,
        supplierId,
        amount,
        method,
        paidAt,
        note: note || null,
      },
    });

    await tx.supplierLedgerEntry.create({
      data: {
        tenantId,
        supplierId,
        type: "payment",
        amount: -amount,
        refType: "payment",
        refId: payment.id,
        occurredAt: paidAt,
        note: note || `Payment via ${method}`,
      },
    });

    await logAudit(tx, {
      tenantId,
      userId: session.user.id,
      action: "payment.recorded",
      entity: "payment",
      entityId: payment.id,
      detail: `${amount} to ${supplier.name}`,
    });
  });

  revalidatePath("/");
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${supplierId}`);
  return { success: "Payment recorded." };
}

export async function voidPaymentAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const tenantId = session.tenant.id;
  const id = String(formData.get("id") ?? "");
  const supplierId = String(formData.get("supplierId") ?? "");

  const payment = await prisma.payment.findFirst({
    where: { id, tenantId, voidedAt: null },
  });

  if (!payment) redirect(`/suppliers/${supplierId}`);

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id }, data: { voidedAt: new Date() } });
    await tx.supplierLedgerEntry.create({
      data: {
        tenantId,
        supplierId: payment.supplierId,
        type: "reversal",
        amount: payment.amount,
        refType: "payment",
        refId: payment.id,
        occurredAt: new Date(),
        note: "Payment voided",
      },
    });
    await logAudit(tx, {
      tenantId,
      userId: session.user.id,
      action: "payment.voided",
      entity: "payment",
      entityId: id,
    });
  });

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${payment.supplierId}`);
  redirect(`/suppliers/${payment.supplierId}`);
}

export async function toggleSupplierArchiveAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  const supplier = await prisma.supplier.findFirst({
    where: { id, tenantId: session.tenant.id },
  });
  if (!supplier) redirect("/suppliers");

  await prisma.supplier.update({
    where: { id },
    data: { archived: !supplier.archived },
  });

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  redirect(`/suppliers/${id}`);
}
