import { BPS, floorBps, percentOf, roundBps } from "./money";

export type LevelRule = {
  level: number;
  maxCargoValue: number;
  taxRateBps: number;
  flatFee: number;
  minTax: number;
};

export type PlanLine = {
  resourceId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type TripItemPlan = {
  resourceId: string;
  quantity: number;
  unitPrice: number;
  value: number;
};

export type TripPlan = {
  seq: number;
  level: number;
  capacity: number;
  cargoValue: number;
  tax: number;
  waste: number;
  items: TripItemPlan[];
};

export type ResourcePlan = {
  resourceId: string;
  name: string;
  quantity: number;
  value: number;
};

export type SalePlan = {
  trips: TripPlan[];
  gross: number;
  tax: number;
  net: number;
  totalUnits: number;
  totalWaste: number;
  perResource: ResourcePlan[];
  warnings: string[];
};

export type PlanResult =
  | { ok: true; plan: SalePlan }
  | { ok: false; error: string };

export function computeTripTax(cargoValue: number, rule: LevelRule): number {
  const percentage = roundBps(cargoValue, rule.taxRateBps);
  return Math.max(percentage, rule.minTax) + rule.flatFee;
}

/**
 * Pack sale lines into trips capped at the level's maximum cargo value.
 *
 * Strategy: first-fit decreasing by unit value. For each trip we take as many
 * units as possible from the most valuable line first. This keeps trips full
 * without splitting units, and produces a clean manifest.
 */
export function planSale(lines: PlanLine[], rule: LevelRule): PlanResult {
  if (!Number.isInteger(rule.maxCargoValue) || rule.maxCargoValue <= 0) {
    throw new Error("Invalid trading post level: maximum cargo value must be positive.");
  }

  const active = lines.filter((line) => line.quantity > 0);
  if (active.length === 0) {
    return { ok: false, error: "Add at least one resource to the sale." };
  }

  for (const line of active) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      return { ok: false, error: `Quantity for ${line.name} must be a positive whole number.` };
    }
    if (!Number.isSafeInteger(line.unitPrice) || line.unitPrice <= 0) {
      return { ok: false, error: `Set a unit price for ${line.name}.` };
    }
    if (line.unitPrice > rule.maxCargoValue) {
      return {
        ok: false,
        error: `One unit of ${line.name} (${line.unitPrice}) is worth more than a full level ${rule.level} trip (${rule.maxCargoValue}). Use a higher trading post level.`,
      };
    }
  }

  const remaining = active.map((line) => line.quantity);
  const order = active
    .map((line, index) => ({ index, price: line.unitPrice }))
    .sort((a, b) => b.price - a.price)
    .map((entry) => entry.index);

  const trips: TripPlan[] = [];
  let guard = 0;

  while (remaining.some((qty) => qty > 0)) {
    guard += 1;
    if (guard > 5000) {
      return { ok: false, error: "Could not pack this sale into trips. Check the trading post table." };
    }

    let cargoValue = 0;
    const items: TripItemPlan[] = [];

    for (const index of order) {
      if (remaining[index] <= 0) continue;
      const line = active[index];
      const space = rule.maxCargoValue - cargoValue;
      const canTake = Math.floor(space / line.unitPrice);
      const take = Math.min(remaining[index], canTake);
      if (take <= 0) continue;

      const existing = items.find((item) => item.resourceId === line.resourceId);
      if (existing) {
        existing.quantity += take;
        existing.value += take * line.unitPrice;
      } else {
        items.push({
          resourceId: line.resourceId,
          quantity: take,
          unitPrice: line.unitPrice,
          value: take * line.unitPrice,
        });
      }
      remaining[index] -= take;
      cargoValue += take * line.unitPrice;
    }

    if (items.length === 0) {
      return { ok: false, error: "Could not fit the remaining units into a trip. Check unit prices and the level cap." };
    }

    trips.push({
      seq: trips.length + 1,
      level: rule.level,
      capacity: rule.maxCargoValue,
      cargoValue,
      tax: computeTripTax(cargoValue, rule),
      waste: rule.maxCargoValue - cargoValue,
      items,
    });
  }

  const gross = trips.reduce((sum, trip) => sum + trip.cargoValue, 0);
  const tax = trips.reduce((sum, trip) => sum + trip.tax, 0);
  const totalWaste = trips.reduce((sum, trip) => sum + trip.waste, 0);

  const perResource: ResourcePlan[] = active.map((line) => ({
    resourceId: line.resourceId,
    name: line.name,
    quantity: line.quantity,
    value: line.quantity * line.unitPrice,
  }));

  const warnings: string[] = [];
  const lastTrip = trips[trips.length - 1];
  if (trips.length > 1) {
    warnings.push(`This sale needs ${trips.length} trips at level ${rule.level}.`);
  }
  if (lastTrip && lastTrip.waste > 0) {
    const fill = percentOf(lastTrip.cargoValue, lastTrip.capacity);
    warnings.push(
      `Last trip is ${fill.toFixed(0)}% full — ${lastTrip.waste.toLocaleString("en-US")} of capacity unused.`,
    );
  }
  const overtaxed = trips.find((trip) => trip.tax >= trip.cargoValue);
  if (overtaxed) {
    warnings.push(`Tax on trip ${overtaxed.seq} meets or exceeds its cargo value. Check your level table.`);
  }
  const effectiveTaxRate = percentOf(tax, gross);
  if (effectiveTaxRate >= 40) {
    warnings.push(`Effective tax is ${effectiveTaxRate.toFixed(1)}% of gross. Double-check the rate for level ${rule.level}.`);
  }

  return {
    ok: true,
    plan: {
      trips,
      gross,
      tax,
      net: gross - tax,
      totalUnits: active.reduce((sum, line) => sum + line.quantity, 0),
      totalWaste,
      perResource,
      warnings,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Supplier attribution preview                                        */
/* ------------------------------------------------------------------ */

export type SupplierLot = {
  id: string;
  supplierId: string;
  supplierName: string;
  shareBps: number;
  quantityRemaining: number;
  receivedAt: string;
};

export type SharePreviewRow = {
  supplierId: string;
  supplierName: string;
  quantity: number;
  grossValue: number;
  amount: number;
};

/**
 * Simulate FIFO lot consumption to preview what each supplier would earn.
 * Posting re-runs this logic server-side against real lots.
 */
export function previewSupplierShares(
  lines: PlanLine[],
  lotsByResource: Record<string, SupplierLot[]>,
): SharePreviewRow[] {
  const bySupplier = new Map<string, SharePreviewRow>();

  for (const line of lines) {
    if (line.quantity <= 0) continue;
    let need = line.quantity;
    const lots = [...(lotsByResource[line.resourceId] ?? [])].sort((a, b) => {
      const dateDiff = new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
      return dateDiff !== 0 ? dateDiff : a.id.localeCompare(b.id);
    });

    for (const lot of lots) {
      if (need <= 0) break;
      const take = Math.min(need, lot.quantityRemaining);
      if (take <= 0) continue;
      const grossValue = take * line.unitPrice;
      const amount = floorBps(grossValue, lot.shareBps);
      const current = bySupplier.get(lot.supplierId) ?? {
        supplierId: lot.supplierId,
        supplierName: lot.supplierName,
        quantity: 0,
        grossValue: 0,
        amount: 0,
      };
      current.quantity += take;
      current.grossValue += grossValue;
      current.amount += amount;
      bySupplier.set(lot.supplierId, current);
      need -= take;
    }
  }

  return [...bySupplier.values()].sort((a, b) => b.amount - a.amount);
}

export function stockFromLots(lots: SupplierLot[]): number {
  return lots.reduce((sum, lot) => sum + lot.quantityRemaining, 0);
}

export function bpsToPercentLabel(bps: number): string {
  return `${(bps / BPS) * 100}%`;
}
