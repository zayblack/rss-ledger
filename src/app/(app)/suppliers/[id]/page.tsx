import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Archive, ArchiveRestore, Wallet } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatAmount, formatMoney, toNumber } from "@/lib/money";
import { formatDate, todayInput } from "@/lib/format";
import { toggleSupplierArchiveAction, voidPaymentAction } from "@/actions/suppliers";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
  Tr,
  buttonClass,
} from "@/components/ui";
import { EditSupplierForm, PaymentForm } from "../forms";

export const metadata = { title: "Supplier" };

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const tenantId = session.tenant.id;
  const currency = session.tenant.currency;
  const { id } = await params;

  const supplier = await prisma.supplier.findFirst({ where: { id, tenantId } });
  if (!supplier) notFound();

  const [deliveries, ledger, consumptions, payments] = await Promise.all([
    prisma.delivery.findMany({
      where: { tenantId, supplierId: id },
      include: { resource: true },
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
      take: 50,
    }),
    prisma.supplierLedgerEntry.findMany({
      where: { tenantId, supplierId: id },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.lotConsumption.findMany({
      where: { supplierId: id, shipment: { tenantId, status: "posted" } },
      include: { shipment: true },
    }),
    prisma.payment.findMany({
      where: { tenantId, supplierId: id },
      select: { id: true, voidedAt: true },
    }),
  ]);

  const voidedPayments = new Set(
    payments.filter((payment) => payment.voidedAt).map((payment) => payment.id),
  );

  let earned = 0;
  let paid = 0;
  let balance = 0;
  for (const entry of ledger) {
    const amount = toNumber(entry.amount);
    balance += amount;
    if (entry.type === "credit") earned += amount;
    else if (entry.type === "reversal" && entry.refType === "shipment") earned += amount;
    else if (entry.type === "payment") paid += -amount;
    else if (entry.type === "reversal" && entry.refType === "payment") paid -= amount;
  }

  const unitsDelivered = deliveries.reduce((sum, delivery) => sum + toNumber(delivery.quantity), 0);
  const unitsSold = consumptions.reduce((sum, row) => sum + toNumber(row.quantity), 0);
  const grossAttributed = consumptions.reduce(
    (sum, row) => sum + toNumber(row.quantity) * toNumber(row.unitPrice),
    0,
  );

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {supplier.name}
            {supplier.archived ? <Badge tone="neutral">archived</Badge> : null}
          </span>
        }
        description={`${(supplier.shareBps / 100).toFixed(2).replace(/\.?0+$/, "")}% of gross sale price${
          supplier.contact ? ` · ${supplier.contact}` : ""
        }`}
        actions={
          <>
            <Link href="/suppliers" className={buttonClass("ghost", "md")}>
              <ArrowLeft className="size-4" />
              Suppliers
            </Link>
            <form action={toggleSupplierArchiveAction}>
              <input type="hidden" name="id" value={supplier.id} />
              <Button type="submit" variant="secondary" size="md">
                {supplier.archived ? (
                  <>
                    <ArchiveRestore className="size-4" />
                    Unarchive
                  </>
                ) : (
                  <>
                    <Archive className="size-4" />
                    Archive
                  </>
                )}
              </Button>
            </form>
          </>
        }
      />

      {balance < 0 ? (
        <Alert tone="danger" className="mb-4">
          This supplier has a negative balance of {formatMoney(Math.abs(balance), currency)} — they
          have been paid more than they earned, usually after a voided shipment.
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Outstanding balance"
          value={formatMoney(balance, currency)}
          tone={balance > 0 ? "warn" : "default"}
          sub={balance > 0 ? "Owed to this supplier" : balance < 0 ? "Overpaid" : "Settled"}
        />
        <Stat label="Lifetime earned" value={formatMoney(earned, currency)} sub="Share of sales" />
        <Stat label="Paid to date" value={formatMoney(paid, currency)} sub="Recorded payments" />
        <Stat
          label="Units sold"
          value={formatAmount(unitsSold)}
          sub={`${formatAmount(unitsDelivered)} delivered`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Statement"
              subtitle="All time · share basis: gross sale price"
            />
            <CardBody className="pt-3">
              <dl className="divide-y divide-line/60 text-xs">
                <StatementRow label="Units delivered" value={formatAmount(unitsDelivered)} />
                <StatementRow label="Units sold" value={formatAmount(unitsSold)} />
                <StatementRow
                  label="Gross value of units sold"
                  value={formatMoney(grossAttributed, currency)}
                />
                <StatementRow label="Share earned" value={formatMoney(earned, currency)} />
                <StatementRow label="Payments made" value={`− ${formatMoney(paid, currency)}`} />
                <div className="flex items-center justify-between pt-3">
                  <dt className="text-sm font-medium text-ink">Balance</dt>
                  <dd className="num text-sm font-semibold text-warn">
                    {formatMoney(balance, currency)}
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Ledger activity"
              subtitle="Credits, payments and reversals in one running record"
            />
            <div className="mt-3">
              {ledger.length === 0 ? (
                <div className="px-5 pb-5">
                  <EmptyState
                    icon={<Wallet className="size-6" />}
                    title="No activity yet"
                    description="Credits appear here when this supplier's units are sold."
                  />
                </div>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Type</Th>
                      <Th>Note</Th>
                      <Th align="right">Amount</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((entry) => {
                      const amount = toNumber(entry.amount);
                      const isPaymentVoidable =
                        entry.type === "payment" &&
                        entry.refId &&
                        !voidedPayments.has(entry.refId);
                      return (
                        <Tr key={entry.id}>
                          <Td className="whitespace-nowrap text-xs text-muted">
                            {formatDate(entry.occurredAt)}
                          </Td>
                          <Td>
                            <Badge
                              tone={
                                entry.type === "credit"
                                  ? "success"
                                  : entry.type === "payment"
                                    ? "info"
                                    : "danger"
                              }
                            >
                              {entry.type}
                            </Badge>
                          </Td>
                          <Td className="max-w-[220px] truncate text-xs text-faint">
                            {entry.note ?? "—"}
                          </Td>
                          <Td
                            align="right"
                            className={`num text-xs ${amount < 0 ? "text-danger" : "text-ink"}`}
                          >
                            {amount > 0 ? "+" : ""}
                            {formatAmount(amount)}
                          </Td>
                          <Td align="right">
                            {isPaymentVoidable ? (
                              <form action={voidPaymentAction}>
                                <input type="hidden" name="id" value={entry.refId ?? ""} />
                                <input type="hidden" name="supplierId" value={supplier.id} />
                                <button
                                  type="submit"
                                  className="text-[10px] text-faint hover:text-danger"
                                >
                                  void
                                </button>
                              </form>
                            ) : null}
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Record a payment" subtitle="Reduces the outstanding balance." />
            <CardBody className="pt-3">
              {balance > 0 ? (
                <PaymentForm
                  supplierId={supplier.id}
                  balance={balance}
                  currency={currency}
                  today={todayInput()}
                />
              ) : (
                <Alert tone="info">
                  Nothing outstanding. Payments become available when this supplier has a positive
                  balance.
                </Alert>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Supplier details" subtitle="Share changes apply to future sales." />
            <CardBody className="pt-3">
              <EditSupplierForm
                supplier={{
                  id: supplier.id,
                  name: supplier.name,
                  shareBps: supplier.shareBps,
                  contact: supplier.contact,
                  notes: supplier.notes,
                }}
              />
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Deliveries"
          subtitle={`${deliveries.length} most recent · ${formatAmount(unitsDelivered)} units total`}
          action={
            <Link href="/inventory" className="text-xs text-muted hover:text-ink">
              Record delivery
            </Link>
          }
        />
        <div className="mt-3">
          {deliveries.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState
                title="No deliveries from this supplier"
                description="Record a delivery in Inventory to create their first lot."
              />
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Resource</Th>
                  <Th align="right">Quantity</Th>
                  <Th align="right">Unit cost</Th>
                  <Th>Note</Th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery) => (
                  <Tr key={delivery.id}>
                    <Td className="whitespace-nowrap text-xs text-muted">
                      {formatDate(delivery.receivedAt)}
                    </Td>
                    <Td className="text-xs">{delivery.resource.name}</Td>
                    <Td align="right" className="num text-xs">
                      {formatAmount(toNumber(delivery.quantity))}
                    </Td>
                    <Td align="right" className="num text-xs text-muted">
                      {toNumber(delivery.unitCost) > 0
                        ? formatAmount(toNumber(delivery.unitCost))
                        : "—"}
                    </Td>
                    <Td className="max-w-[220px] truncate text-xs text-faint">
                      {delivery.note ?? "—"}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      {consumptions.length > 0 ? (
        <Card className="mt-4">
          <CardHeader
            title="Units sold from this supplier"
            subtitle="Every lot consumption, newest shipment first"
          />
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Shipment</Th>
                  <Th>Date</Th>
                  <Th align="right">Units</Th>
                  <Th align="right">Unit price</Th>
                  <Th align="right">Gross</Th>
                  <Th align="right">Share</Th>
                </tr>
              </thead>
              <tbody>
                {[...consumptions]
                  .sort(
                    (a, b) => b.shipment.soldAt.getTime() - a.shipment.soldAt.getTime(),
                  )
                  .slice(0, 30)
                  .map((row) => (
                    <Tr key={row.id}>
                      <Td>
                        <Link
                          href={`/shipments/${row.shipmentId}`}
                          className="num text-xs text-accent hover:underline"
                        >
                          {row.shipment.reference}
                        </Link>
                      </Td>
                      <Td className="text-xs text-muted">{formatDate(row.shipment.soldAt)}</Td>
                      <Td align="right" className="num text-xs">
                        {formatAmount(toNumber(row.quantity))}
                      </Td>
                      <Td align="right" className="num text-xs text-muted">
                        {formatAmount(toNumber(row.unitPrice))}
                      </Td>
                      <Td align="right" className="num text-xs text-muted">
                        {formatAmount(toNumber(row.quantity) * toNumber(row.unitPrice))}
                      </Td>
                      <Td align="right" className="num text-xs">
                        {formatAmount(toNumber(row.shareAmount))}
                      </Td>
                    </Tr>
                  ))}
              </tbody>
            </Table>
          </div>
        </Card>
      ) : null}
    </>
  );
}

function StatementRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="num text-ink">{value}</dd>
    </div>
  );
}
