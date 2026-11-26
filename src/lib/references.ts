const REFERENCE_PATTERN = /^S-(\d+)$/;

export function formatShipmentReference(sequence: number): string {
  return `S-${String(sequence).padStart(4, "0")}`;
}

/**
 * One past the highest shipment number already used. Gaps from voided or
 * deleted shipments are never reused, and non-matching legacy references are
 * ignored.
 */
export function nextShipmentReference(existing: string[]): string {
  const highest = existing.reduce((max, reference) => {
    const match = REFERENCE_PATTERN.exec(reference);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return formatShipmentReference(highest + 1);
}
