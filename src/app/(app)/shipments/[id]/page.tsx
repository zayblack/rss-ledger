import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, RotateCcw, Truck } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatAmount, formatMoney, percentOf, toNumber } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/format";
import { deleteDraftAction, voidShipmentAction } from "@/actions/shipments";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  PageHeader,
  ProgressBar,
  Stat,
  Table,
  Td,
  Th,
  Tr,
  buttonClass,
} from "@/components/ui";

export const metadata = { title: "Shipment" };

export default async function ShipmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  const tenantId = session.tenant.id;
  const currency = session.tenant.currency;
  const { id } = await params;
  const { error } = await searchParams;

  const shipment = await prisma.shipment.findFirst({
    where: { id, tenantId },
    include: {
      lines: { include: { resource: true }, orderBy: { id: "asc" } },
      trips: {
        include: { items: { include: { resource: true } } },
        orderBy: { seq: "asc" },
      },
      consumptions: { include: { supplier: true } },
    },
  });

  if (!shipment) notFound();

  const ledger = await prisma.supplierLedgerEntry.findMany({
    where: { tenantId, refType: "shipment", refId: shipment.id },
    include: { supplier: true },
    orderBy: { createdAt: "asc" },
  });

  const bySupplier = new Map<
    string,
    { name: string; shareBps: number; units: number; gross: number; share: number }
  >();
  for (const consumption of shipment.consumptions) {
    const current = bySupplier.get(consumption.supplierId) ?? {
      name: consumption.supplier.name,
      shareBps: consumption.shareBps,
      units: 0,
      gross: 0,
      share: 0,
    };
    current.units += toNumber(consumption.quantity);
    current.gross += toNumber(consumption.quantity) * toNumber(consumption.unitPrice);
    current.share += toNumber(consumption.shareAmount);
    bySupplier.set(consumption.supplierId, current);
  }

  const gross = toNumber(shipment.grossTotal);
  const tax = toNumber(shipment.taxTotal);
  const net = toNumber(shipment.netTotal);
  const supplierShare = toNumber(shipment.supplierShareTotal);
  const profit = net - supplierShare;
  const totalUnits = shipment.lines.reduce((sum, line) => sum + toNumber(line.quantity), 0);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="num">{shipment.reference}</span>
            <Badge
              tone={
                shipment.status === "posted"
                  ? "success"
                  : shipment.status === "void"
                    ? "danger"
                    : "neutral"
              }
            >
              {shipment.status}
            </Badge>
          </span>
        }
        description={`${shipment.customerName} · ${formatDate(shipment.soldAt)} · ${formatAmount(
          totalUnits,
        )} units`}
        actions={
          <Link href="/shipments" className={buttonClass("ghost", "md")}>
            <ArrowLeft className="size-4" />
            All shipments
          </Link>
        }
      />

      {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}

      {shipment.status === "void" ? (
        <Alert tone="danger" className="mb-4">
          Voided {shipment.voidedAt ? formatDateTime(shipment.voidedAt) : ""}
          {shipment.voidReason ? ` — ${shipment.voidReason}` : ""}. Stock was restored and supplier
          credits were reversed.
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Gross" value={formatMoney(gross, currency)} sub="Cargo value" />
        <Stat label="Transport tax" value={formatMoney(tax, currency)} tone="warn" sub={`${percentOf(tax, gross).toFixed(1)}% of gross`} />
        <Stat label="Net to you" value={formatMoney(net, currency)} tone="accent" sub="After tax" />
        <Stat
          label="Your profit"
          value={formatMoney(profit, currency)}
          tone={profit < 0 ? "danger" : "default"}
          sub={`Supplier share ${formatAmount(supplierShare)}`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader
            title="Trip manifest"
            subtitle={`${shipment.trips.length} trip${shipment.trips.length === 1 ? "" : "s"} · ${
              shipment.trips[0] ? `level ${shipment.trips[0].level}` : "—"
            }`}
            action={<Truck className="size-4 text-faint" />}
          />
          <CardBody className="space-y-2 pt-3">
            {shipment.trips.map((trip) => {
              const capacity = toNumber(trip.capacity);
              const cargo = toNumber(trip.cargoValue);
              const fill = percentOf(cargo, capacity);
              return (
                <div key={trip.id} className="rounded-lg border border-line bg-canvas/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-ink">
                      Trip {trip.seq} · Level {trip.level}
                    </span>
                    <span className="num text-muted">
                      {formatAmount(cargo)} / {formatAmount(capacity)} · tax{" "}
                      <span className="text-warn">{formatAmount(toNumber(trip.tax))}</span>
                    </span>
                  </div>
                  <ProgressBar value={fill} tone={fill > 95 ? "accent" : "info"} className="mt-2" />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {trip.items.map((item) => (
                      <span
                        key={item.id}
                        className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] text-muted"
                      >
                        {item.resource.name} × {formatAmount(toNumber(item.quantity))}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-faint">{fill.toFixed(0)}% of capacity used</p>
                </div>
              );
            })}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Supplier credits" subtitle="Created when this shipment posted" />
            <CardBody className="pt-3">
              {bySupplier.size === 0 ? (
                <p className="text-xs text-muted">No supplier attribution recorded.</p>
              ) : (
                <div className="space-y-2">
                  {[...bySupplier.entries()].map(([supplierId, row]) => (
                    <Link
                      key={supplierId}
                      href={`/suppliers/${supplierId}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 hover:border-line-strong"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-ink">{row.name}</p>
                        <p className="text-[10px] text-faint">
                          {formatAmount(row.units)} units · {row.shareBps / 100}% share
                        </p>
                      </div>
                      <span className="num shrink-0 text-xs text-warn">
                        {formatMoney(row.share, currency)}
                      </span>
                    </Link>
                  ))}
                  <div className="flex items-center justify-between border-t border-line pt-2 text-xs">
                    <span className="text-muted">Total credited</span>
                    <span className="num font-semibold text-ink">
                      {formatMoney(supplierShare, currency)}
                    </span>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Actions" subtitle="Posted sales are immutable." />
            <CardBody className="space-y-3 pt-3">
              {shipment.status === "posted" ? (
                <details className="rounded-lg border border-danger/20 bg-danger/[0.03] p-3">
                  <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-danger">
                    <RotateCcw className="size-3.5" />
                    Void this shipment
                  </summary>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted">
                    Restores the sold units to stock, reverses every supplier credit, and keeps the
                    record for your history.
                  </p>
                  <form action={voidShipmentAction} className="mt-3 space-y-2">
                    <input type="hidden" name="id" value={shipment.id} />
                    <Input name="reason" placeholder="Reason (required)" required minLength={3} />
                    <Button type="submit" variant="danger" size="sm" className="w-full">
                      Void and reverse
                    </Button>
                  </form>
                </details>
              ) : shipment.status === "draft" ? (
                <form action={deleteDraftAction}>
                  <input type="hidden" name="id" value={shipment.id} />
                  <Button type="submit" variant="danger" size="sm" className="w-full">
                    Delete draft
                  </Button>
                </form>
              ) : (
                <p className="text-xs text-muted">
                  This shipment was voided and can no longer be changed.
                </p>
              )}

              {shipment.notes ? (
                <div className="rounded-lg border border-line bg-canvas/50 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-faint">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted">
                    {shipment.notes}
                  </p>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader title="Sale lines" subtitle="Prices are snapshotted at posting time." />
        <div className="mt-3">
          <Table>
            <thead>
              <tr>
                <Th>Resource</Th>
                <Th align="right">Quantity</Th>
                <Th align="right">Unit price</Th>
                <Th align="right">Line total</Th>
              </tr>
            </thead>
            <tbody>
              {shipment.lines.map((line) => (
                <Tr key={line.id}>
                  <Td className="text-xs">{line.resource.name}</Td>
                  <Td align="right" className="num text-xs">
                    {formatAmount(toNumber(line.quantity))} {line.resource.unitLabel}
                  </Td>
                  <Td align="right" className="num text-xs text-muted">
                    {formatAmount(toNumber(line.unitPrice))}
                  </Td>
                  <Td align="right" className="num text-xs font-medium">
                    {formatAmount(toNumber(line.lineTotal))}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Ledger entries"
          subtitle="Credits and any reversals created by this shipment"
        />
        <div className="mt-3">
          <Table>
            <thead>
              <tr>
                <Th>Supplier</Th>
                <Th>Type</Th>
                <Th>Date</Th>
                <Th align="right">Amount</Th>
                <Th>Note</Th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry) => (
                <Tr key={entry.id}>
                  <Td className="text-xs">{entry.supplier.name}</Td>
                  <Td>
                    <Badge tone={entry.type === "reversal" ? "danger" : "success"}>
                      {entry.type}
                    </Badge>
                  </Td>
                  <Td className="text-xs text-muted">{formatDate(entry.occurredAt)}</Td>
                  <Td
                    align="right"
                    className={`num text-xs ${
                      toNumber(entry.amount) < 0 ? "text-danger" : "text-ink"
                    }`}
                  >
                    {toNumber(entry.amount) > 0 ? "+" : ""}
                    {formatAmount(toNumber(entry.amount))}
                  </Td>
                  <Td className="max-w-[220px] truncate text-xs text-faint">{entry.note}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </>
  );
}
