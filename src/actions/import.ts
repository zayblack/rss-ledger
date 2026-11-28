"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseAmountInput } from "@/lib/money";
import { requireLimit, EntitlementError } from "@/lib/entitlements";

export type FormState = { error?: string; success?: string };

export async function importResourcesAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const tenantId = session.tenant.id;

  const csv = String(formData.get("csv") ?? "").trim();
  if (!csv) return { error: "Paste CSV data first." };

  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { error: "No rows found." };

  // Skip header row if present.
  let rows = lines;
  if (/name/i.test(lines[0]) && /price/i.test(lines[0])) {
    rows = lines.slice(1);
  }

  const parsed: { name: string; unitLabel: string; unitPrice: number; lowStockThreshold: number }[] = [];
  for (const line of rows) {
    const parts = line.split(",").map((p) => p.trim());
    const name = parts[0];
    if (!name) return { error: "Each row needs a name." };
    const unitLabel = parts[1] || "units";
    const unitPrice = parseAmountInput(parts[2] ?? "0") ?? 0;
    const threshold = parseAmountInput(parts[3] ?? "0") ?? 0;
    parsed.push({ name, unitLabel, unitPrice, lowStockThreshold: threshold });
  }

  try {
    const count = await prisma.resource.count({ where: { tenantId, archived: false } });
    requireLimit(session.tenant.plan, "resources", count + parsed.length - 1);
  } catch (err) {
    if (err instanceof EntitlementError) return { error: err.message };
    throw err;
  }

  let created = 0;
  await prisma.$transaction(async (tx) => {
    for (const row of parsed) {
      try {
        await tx.resource.create({
          data: { tenantId, name: row.name, unitLabel: row.unitLabel, unitPrice: row.unitPrice, lowStockThreshold: row.lowStockThreshold },
        });
        created += 1;
      } catch {
        // skip duplicates
      }
    }
    await logAudit(tx, {
      tenantId,
      userId: session.user.id,
      action: "resources.imported",
      entity: "resource",
      detail: `Imported ${created} resources`,
    });
  });

  revalidatePath("/settings");
  revalidatePath("/inventory");
  return { success: `Imported ${created} of ${parsed.length} resources.` };
}