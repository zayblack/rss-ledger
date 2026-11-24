/**
 * Lightweight regression checks for the money + packing engine.
 * Run with: npm run check
 */
import assert from "node:assert/strict";
import { planShipment, previewSupplierShares, type LevelRule } from "../src/lib/calc";
import { floorBps, roundBps } from "../src/lib/money";

const level17: LevelRule = {
  level: 17,
  maxCargoValue: 2_000_000,
  taxRateBps: 2350,
  flatFee: 0,
  minTax: 0,
};

// 1. A full trip is taxed at exactly the example rate: 470,000 on 2,000,000.
assert.equal(roundBps(2_000_000, 2350), 470_000);

// 2. Exactly one full trip.
const single = planShipment(
  [{ resourceId: "a", name: "Ore", quantity: 100, unitPrice: 20_000 }],
  level17,
);
assert.equal(single.ok, true);
if (single.ok) {
  assert.equal(single.plan.trips.length, 1);
  assert.equal(single.plan.gross, 2_000_000);
  assert.equal(single.plan.tax, 470_000);
  assert.equal(single.plan.net, 1_530_000);
  assert.equal(single.plan.trips[0].waste, 0);
}

// 3. 3,000,000 packs into 2 trips: 2M + 1M, tax 470k + 235k.
const multi = planShipment(
  [{ resourceId: "a", name: "Ore", quantity: 150, unitPrice: 20_000 }],
  level17,
);
assert.equal(multi.ok, true);
if (multi.ok) {
  assert.equal(multi.plan.trips.length, 2);
  assert.deepEqual(
    multi.plan.trips.map((trip) => trip.cargoValue),
    [2_000_000, 1_000_000],
  );
  assert.equal(multi.plan.tax, 705_000);
}

// 4. Mixed lines are packed by descending unit value without splitting units.
const mixed = planShipment(
  [
    { resourceId: "a", name: "Crystal", quantity: 10, unitPrice: 150_000 },
    { resourceId: "b", name: "Ore", quantity: 100, unitPrice: 10_000 },
  ],
  level17,
);
assert.equal(mixed.ok, true);
if (mixed.ok) {
  const total = mixed.plan.trips.reduce((sum, trip) => sum + trip.cargoValue, 0);
  assert.equal(total, 10 * 150_000 + 100 * 10_000);
  for (const trip of mixed.plan.trips) {
    assert.ok(trip.cargoValue <= 2_000_000, "trip must respect the cap");
  }
  // 2.5M needs two trips; the first should be packed full, the remainder rides alone.
  assert.equal(mixed.plan.trips.length, 2);
  assert.equal(mixed.plan.trips[0].cargoValue, 2_000_000);
  assert.equal(mixed.plan.trips[1].cargoValue, 500_000);
  assert.equal(mixed.plan.totalWaste, 1_500_000);
}

// 5. A single unit worth more than the cap is rejected with a clear error.
const tooBig = planShipment(
  [{ resourceId: "a", name: "Relic", quantity: 1, unitPrice: 2_500_000 }],
  level17,
);
assert.equal(tooBig.ok, false);

// 6. Supplier shares are floored, so we never overpay a fraction.
assert.equal(floorBps(999, 3333), 332); // 332.9667 -> 332

// 7. FIFO preview attributes the oldest lots first.
const shares = previewSupplierShares(
  [{ resourceId: "a", name: "Ore", quantity: 120, unitPrice: 10_000 }],
  {
    a: [
      {
        id: "lot-1",
        supplierId: "s1",
        supplierName: "Highland",
        shareBps: 3500,
        quantityRemaining: 100,
        receivedAt: "2026-01-01T12:00:00.000Z",
      },
      {
        id: "lot-2",
        supplierId: "s2",
        supplierName: "Mira",
        shareBps: 4000,
        quantityRemaining: 50,
        receivedAt: "2026-02-01T12:00:00.000Z",
      },
    ],
  },
);
const highland = shares.find((row) => row.supplierId === "s1");
const mira = shares.find((row) => row.supplierId === "s2");
assert.equal(highland?.quantity, 100);
assert.equal(highland?.amount, 350_000);
assert.equal(mira?.quantity, 20);
assert.equal(mira?.amount, 80_000);

// 8. Flat-fee tax mode (rate 0, flat fee per trip).
const flat = planShipment(
  [{ resourceId: "a", name: "Ore", quantity: 150, unitPrice: 20_000 }],
  { ...level17, taxRateBps: 0, flatFee: 470_000 },
);
assert.equal(flat.ok, true);
if (flat.ok) assert.equal(flat.plan.tax, 940_000);

// 9. Minimum tax is respected on a light trip.
const minimum = planShipment(
  [{ resourceId: "a", name: "Ore", quantity: 1, unitPrice: 100_000 }],
  { ...level17, taxRateBps: 1000, minTax: 50_000 },
);
assert.equal(minimum.ok, true);
if (minimum.ok) assert.equal(minimum.plan.tax, 50_000);

console.log("All money + packing checks passed.");
