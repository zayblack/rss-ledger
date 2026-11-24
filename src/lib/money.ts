/**
 * Money helpers.
 *
 * All amounts are whole in-game currency units stored as BigInt in the database.
 * We convert to Number at the UI boundary. Number is exact for integers below
 * 2^53 (~9 quadrillion), which is far beyond any realistic ledger here.
 */

export const BPS = 10_000;

export function toNumber(value: bigint | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

/** Parse a user-entered whole amount: "2,000,000" -> 2000000. */
export function parseAmountInput(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/[,\s_]/g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isSafeInteger(value)) return null;
  return value;
}

/** Parse a percentage like "23.5" or "23.5%" -> basis points 2350. */
export function parsePercentInput(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/%/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const bps = Math.round(Number(cleaned) * 100);
  if (!Number.isSafeInteger(bps) || bps < 0 || bps > BPS) return null;
  return bps;
}

export function formatAmount(value: number | bigint): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    typeof value === "bigint" ? Number(value) : Math.round(value),
  );
}

export function formatMoney(value: number | bigint, currency?: string): string {
  const amount = formatAmount(value);
  return currency ? `${amount} ${currency}` : amount;
}

export function formatBps(bps: number): string {
  const pct = bps / 100;
  if (Number.isInteger(pct)) return `${pct}%`;
  return `${pct.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

export function bpsFromPercentString(value: string): number | null {
  return parsePercentInput(value);
}

/** Round a basis-point share of an amount down, so we never overpay a supplier. */
export function floorBps(amount: number, bps: number): number {
  return Math.floor((amount * bps) / BPS);
}

/** Standard half-up rounding for tax. */
export function roundBps(amount: number, bps: number): number {
  return Math.round((amount * bps) / BPS);
}

export function percentOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return (part / whole) * 100;
}
