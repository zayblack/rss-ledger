/**
 * Regression checks for shipment reference numbering.
 * Run with: npm run check
 */
import assert from "node:assert/strict";
import { formatShipmentReference, nextShipmentReference } from "../src/lib/references";

assert.equal(formatShipmentReference(1), "S-0001");
assert.equal(formatShipmentReference(42), "S-0042");
assert.equal(formatShipmentReference(10_000), "S-10000");

assert.equal(nextShipmentReference([]), "S-0001");
assert.equal(nextShipmentReference(["S-0001"]), "S-0002");
assert.equal(nextShipmentReference(["S-0002", "S-0001"]), "S-0003");

// A voided number is never reused: the gap stays a gap.
assert.equal(nextShipmentReference(["S-0001", "S-0003"]), "S-0004");

// Padding is preserved and large numbers keep working.
assert.equal(nextShipmentReference(["S-0009", "S-0010"]), "S-0011");
assert.equal(nextShipmentReference(["S-9999"]), "S-10000");

// Legacy references that do not match the format are ignored.
assert.equal(nextShipmentReference(["legacy", "S-0002", "S-00x"]), "S-0003");

console.log("All reference checks passed.");
