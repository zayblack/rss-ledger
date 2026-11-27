/**
 * Regression checks for sale reference numbering.
 * Run with: npm run check
 */
import assert from "node:assert/strict";
import { formatSaleReference, nextSaleReference } from "../src/lib/references";

assert.equal(formatSaleReference(1), "SL-0001");
assert.equal(formatSaleReference(42), "SL-0042");
assert.equal(formatSaleReference(10_000), "SL-10000");

assert.equal(nextSaleReference([]), "SL-0001");
assert.equal(nextSaleReference(["SL-0001"]), "SL-0002");
assert.equal(nextSaleReference(["SL-0002", "SL-0001"]), "SL-0003");

// A voided number is never reused: the gap stays a gap.
assert.equal(nextSaleReference(["SL-0001", "SL-0003"]), "SL-0004");

// Padding is preserved and large numbers keep working.
assert.equal(nextSaleReference(["SL-0009", "SL-0010"]), "SL-0011");
assert.equal(nextSaleReference(["SL-9999"]), "SL-10000");

// Legacy references that do not match the format are ignored.
assert.equal(nextSaleReference(["legacy", "SL-0002", "SL-00x"]), "SL-0003");

console.log("All reference checks passed.");
