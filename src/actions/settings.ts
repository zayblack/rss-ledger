"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, requireSession, verifyPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseAmountInput, parsePercentInput } from "@/lib/money";

export type FormState = { error?: string; success?: string };

export async function updateWorkspaceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim();

  if (name.length < 2) return { error: "Workspace name is too short." };
  if (currency.length < 1 || currency.length > 20) return { error: "Enter a currency label." };

  await prisma.tenant.update({
    where: { id: session.tenant.id },
    data: { name, currency },
  });

  revalidatePath("/");
  revalidatePath("/settings");
  return { success: "Workspace updated." };
}

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!current) return { error: "Enter your current password." };
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (next.length > 200) return { error: "New password is too long." };
  if (next !== confirm) return { error: "New passwords do not match." };
  if (next === current) return { error: "Choose a password different from your current one." };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user) return { error: "Account not found." };
  if (!(await verifyPassword(current, user.passwordHash))) {
    return { error: "Current password is incorrect." };
  }

  const passwordHash = await hashPassword(next);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: session.user.id },
      data: { passwordHash },
    });
    await tx.session.deleteMany({
      where: { userId: session.user.id, NOT: { id: session.sessionId } },
    });
    await logAudit(tx, {
      tenantId: session.tenant.id,
      userId: session.user.id,
      action: "password.changed",
      entity: "user",
      entityId: session.user.id,
    });
  });

  revalidatePath("/settings");
  return { success: "Password updated. Other sessions have been signed out." };
}

export async function updateResourceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const tenantId = session.tenant.id;
  const id = String(formData.get("id") ?? "");

  const name = String(formData.get("name") ?? "").trim();
  const unitLabel = String(formData.get("unitLabel") ?? "").trim() || "units";
  const unitPrice = parseAmountInput(formData.get("unitPrice"));
  const threshold = parseAmountInput(formData.get("lowStockThreshold"));

  if (!id) return { error: "Missing resource." };
  if (name.length < 1) return { error: "Enter a resource name." };
  if (unitPrice === null) return { error: "Unit price must be a whole number." };
  if (threshold === null) return { error: "Low-stock threshold must be a whole number." };

  const resource = await prisma.resource.findFirst({ where: { id, tenantId } });
  if (!resource) return { error: "Resource not found." };

  const clash = await prisma.resource.findFirst({
    where: { tenantId, name, NOT: { id } },
  });
  if (clash) return { error: "Another resource already uses that name." };

  await prisma.resource.update({
    where: { id },
    data: { name, unitLabel, unitPrice, lowStockThreshold: threshold },
  });

  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/settings");
  return { success: `${name} updated.` };
}

type LevelRow = {
  level: number;
  maxCargoValue: number;
  taxRateBps: number;
  flatFee: number;
  minTax: number;
};

export async function saveLevelsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const tenantId = session.tenant.id;
  const raw = String(formData.get("rows") ?? "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Could not read the trading post table." };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { error: "Add at least one trading post level." };
  }
  if (parsed.length > 200) {
    return { error: "That is too many levels." };
  }

  const rows: LevelRow[] = [];
  const seen = new Set<number>();

  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) {
      return { error: "One of the rows is invalid." };
    }
    const row = entry as Record<string, unknown>;
    const level = Number(row.level);
    const maxCargoValue = Number(row.maxCargoValue);
    const taxRateBps = Number(row.taxRateBps);
    const flatFee = Number(row.flatFee ?? 0);
    const minTax = Number(row.minTax ?? 0);

    if (!Number.isInteger(level) || level < 1 || level > 999) {
      return { error: "Level numbers must be whole numbers between 1 and 999." };
    }
    if (seen.has(level)) return { error: `Level ${level} appears more than once.` };
    seen.add(level);

    if (!Number.isSafeInteger(maxCargoValue) || maxCargoValue <= 0) {
      return { error: `Level ${level}: maximum cargo value must be a positive whole number.` };
    }
    if (!Number.isInteger(taxRateBps) || taxRateBps < 0 || taxRateBps > 10_000) {
      return { error: `Level ${level}: tax rate must be between 0% and 100%.` };
    }
    if (!Number.isSafeInteger(flatFee) || flatFee < 0) {
      return { error: `Level ${level}: flat fee must be zero or more.` };
    }
    if (!Number.isSafeInteger(minTax) || minTax < 0) {
      return { error: `Level ${level}: minimum tax must be zero or more.` };
    }

    rows.push({ level, maxCargoValue, taxRateBps, flatFee, minTax });
  }

  rows.sort((a, b) => a.level - b.level);

  await prisma.$transaction(async (tx) => {
    await tx.tradingPostLevel.deleteMany({ where: { tenantId } });
    await tx.tradingPostLevel.createMany({
      data: rows.map((row) => ({ tenantId, ...row })),
    });
    await logAudit(tx, {
      tenantId,
      userId: session.user.id,
      action: "levels.updated",
      entity: "tradingPostLevel",
      detail: `${rows.length} levels saved`,
    });
  });

  revalidatePath("/settings");
  revalidatePath("/sales/new");
  return { success: `Saved ${rows.length} trading post levels.` };
}

export async function loadDemoDataAction(): Promise<void> {
  const session = await requireSession();
  const tenantId = session.tenant.id;

  const supplierCount = await prisma.supplier.count({ where: { tenantId } });
  if (supplierCount > 0) redirect("/inventory");

  const resources = await prisma.resource.findMany({
    where: { tenantId, archived: false },
    orderBy: { sortOrder: "asc" },
  });
  if (resources.length === 0) redirect("/settings");

  const now = new Date();
  const receivedAt = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    const first = await tx.supplier.create({
      data: {
        tenantId,
        name: "Highland Traders",
        shareBps: 3500,
        contact: "highland@example.com",
        notes: "Sample supplier created by demo data.",
      },
    });
    const second = await tx.supplier.create({
      data: {
        tenantId,
        name: "Mira's Camp",
        shareBps: 4000,
        contact: "mira@example.com",
        notes: "Sample supplier created by demo data.",
      },
    });

    for (const resource of resources) {
      const deliveries = [
        { supplierId: first.id, quantity: 800 },
        { supplierId: second.id, quantity: 400 },
      ];
      for (const entry of deliveries) {
        const delivery = await tx.delivery.create({
          data: {
            tenantId,
            supplierId: entry.supplierId,
            resourceId: resource.id,
            quantity: entry.quantity,
            unitCost: 0,
            receivedAt,
            note: "Demo data",
          },
        });
        await tx.lot.create({
          data: {
            tenantId,
            deliveryId: delivery.id,
            supplierId: entry.supplierId,
            resourceId: resource.id,
            quantityReceived: entry.quantity,
            quantityRemaining: entry.quantity,
            receivedAt,
          },
        });
      }
    }

    await logAudit(tx, {
      tenantId,
      userId: session.user.id,
      action: "demo.loaded",
      entity: "tenant",
      entityId: tenantId,
      detail: "Sample suppliers and deliveries created.",
    });
  });

  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/suppliers");
  redirect("/inventory?demo=1");
}
