const REFERENCE_PATTERN = /^SL-(\d+)$/;

export function formatSaleReference(sequence: number): string {
  return `SL-${String(sequence).padStart(4, "0")}`;
}

/**
 * One past the highest sale number already used. Gaps from voided or
 * deleted sales are never reused, and non-matching legacy references are
 * ignored.
 */
export function nextSaleReference(existing: string[]): string {
  const highest = existing.reduce((max, reference) => {
    const match = REFERENCE_PATTERN.exec(reference);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return formatSaleReference(highest + 1);
}
