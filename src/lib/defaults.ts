import type { Prisma } from "@prisma/client";

/**
 * Starter configuration.
 *
 * These are deliberately sample values so a new workspace is usable immediately.
 * Every seller should edit them in Settings to match their game's trading post
 * table and resource names.
 */

export const DEFAULT_RESOURCES = [
  { name: "Iron Ore", unitLabel: "units", unitPrice: 18_000, lowStockThreshold: 100 },
  { name: "Raw Silk", unitLabel: "units", unitPrice: 25_000, lowStockThreshold: 80 },
  { name: "Cured Hide", unitLabel: "units", unitPrice: 9_500, lowStockThreshold: 150 },
  { name: "Mana Crystal", unitLabel: "units", unitPrice: 42_000, lowStockThreshold: 40 },
] as const;

/** Level 17 matches the example from the brief: 2,000,000 cap, 470,000 tax (23.5%). */
export const DEFAULT_LEVELS = [
  { level: 1, maxCargoValue: 100_000 },
  { level: 2, maxCargoValue: 150_000 },
  { level: 3, maxCargoValue: 220_000 },
  { level: 4, maxCargoValue: 300_000 },
  { level: 5, maxCargoValue: 400_000 },
  { level: 6, maxCargoValue: 520_000 },
  { level: 7, maxCargoValue: 660_000 },
  { level: 8, maxCargoValue: 820_000 },
  { level: 9, maxCargoValue: 1_000_000 },
  { level: 10, maxCargoValue: 1_150_000 },
  { level: 11, maxCargoValue: 1_300_000 },
  { level: 12, maxCargoValue: 1_450_000 },
  { level: 13, maxCargoValue: 1_600_000 },
  { level: 14, maxCargoValue: 1_700_000 },
  { level: 15, maxCargoValue: 1_800_000 },
  { level: 16, maxCargoValue: 1_900_000 },
  { level: 17, maxCargoValue: 2_000_000 },
  { level: 18, maxCargoValue: 2_150_000 },
  { level: 19, maxCargoValue: 2_300_000 },
  { level: 20, maxCargoValue: 2_500_000 },
].map((entry) => ({
  ...entry,
  taxRateBps: 2350,
  flatFee: 0,
  minTax: 0,
}));

export async function seedTenantDefaults(tx: Prisma.TransactionClient, tenantId: string) {
  await tx.resource.createMany({
    data: DEFAULT_RESOURCES.map((resource, index) => ({
      tenantId,
      name: resource.name,
      unitLabel: resource.unitLabel,
      unitPrice: resource.unitPrice,
      lowStockThreshold: resource.lowStockThreshold,
      sortOrder: index,
    })),
  });

  await tx.tradingPostLevel.createMany({
    data: DEFAULT_LEVELS.map((level) => ({
      tenantId,
      level: level.level,
      maxCargoValue: level.maxCargoValue,
      taxRateBps: level.taxRateBps,
      flatFee: level.flatFee,
      minTax: level.minTax,
    })),
  });
}

/**
 * Invited sellers start with a copy of the inviter's resource list and trading
 * post table (configuration only, never data). Falls back to starter defaults.
 */
export async function copyTemplateToTenant(
  tx: Prisma.TransactionClient,
  sourceTenantId: string,
  targetTenantId: string,
) {
  const [resources, levels] = await Promise.all([
    tx.resource.findMany({ where: { tenantId: sourceTenantId }, orderBy: { sortOrder: "asc" } }),
    tx.tradingPostLevel.findMany({ where: { tenantId: sourceTenantId }, orderBy: { level: "asc" } }),
  ]);

  if (resources.length === 0 || levels.length === 0) {
    await seedTenantDefaults(tx, targetTenantId);
    return;
  }

  await tx.resource.createMany({
    data: resources.map((resource, index) => ({
      tenantId: targetTenantId,
      name: resource.name,
      unitLabel: resource.unitLabel,
      unitPrice: resource.unitPrice,
      lowStockThreshold: resource.lowStockThreshold,
      sortOrder: index,
    })),
  });

  await tx.tradingPostLevel.createMany({
    data: levels.map((level) => ({
      tenantId: targetTenantId,
      level: level.level,
      maxCargoValue: level.maxCargoValue,
      taxRateBps: level.taxRateBps,
      flatFee: level.flatFee,
      minTax: level.minTax,
      notes: level.notes,
    })),
  });
}
