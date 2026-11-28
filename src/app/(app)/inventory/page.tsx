import Link from "next/link";
import { Package, Plus, Trash2, Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatAmount, formatMoney, toNumber } from "@/lib/money";
import { formatDate, todayInput } from "@/lib/format";
import { voidDeliveryAction } from "@/actions/inventory";
import {
  Alert,
  Badge,
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
import { DeliveryForm } from "./delivery-form";
import { AdjustmentForm } from "./adjustment-form";

export const metadata = { title: "Inventory" };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string; removed?: string; error?: string; demo?: string }>;
}) {
  const session = await requireSession();
  const tenantId = session.tenant.id;
  const currency = session.tenant.currency;
  const flags = await searchParams;

  const [resources, stockRows, suppliers, lots, deliveries] = await Promise.all([
    prisma.resource.findMany({
      where: { tenantId, archived: false },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.lot.groupBy({
      by: ["resourceId"],
      where: { tenantId },
      _sum: { quantityRemaining: true },
    }),
    prisma.supplier.findMany({
      where: { tenantId, archived: false },
      orderBy: { name: "asc" },
    }),
    prisma.lot.findMany({
      where: { tenantId, quantityRemaining: { gt: 0 } },
      include: { supplier: true, resource: true },
      orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
      take: 60,
    }),
    prisma.delivery.findMany({
      where: { tenantId },
      include: { supplier: true, resource: true, lots: true },
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
      take: 25,
    }),
  ]);

  const stock = new Map(
    stockRows.map((row) => [row.resourceId, toNumber(row._sum.quantityRemaining)]),
  );
  const totalUnits = resources.reduce((sum, resource) => sum + (stock.get(resource.id) ?? 0), 0);
  const stockValue = resources.reduce(
    (sum, resource) => sum + (stock.get(resource.id) ?? 0) * toNumber(resource.unitPrice),
    0,
  );

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock is held in supplier-attributed lots. Sales consume the oldest lots first."
        actions={
          <Link href="/suppliers" className={buttonClass("secondary", "md")}>
            <Users className="size-4" />
            Suppliers
          </Link>
        }
      />

      {flags.added ? <Alert tone="success" className="mb-4">Delivery recorded and added to stock.</Alert> : null}
      {flags.removed ? <Alert tone="success" className="mb-4">Delivery removed.</Alert> : null}
      {flags.demo ? (
        <Alert tone="info" className="mb-4">
          Sample suppliers and deliveries loaded. Plan a sale to see the engine in action.
        </Alert>
      ) : null}
      {flags.error ? <Alert tone="danger" className="mb-4">{flags.error}</Alert> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {resources.map((resource) => {
          const quantity = stock.get(resource.id) ?? 0;
          const threshold = toNumber(resource.lowStockThreshold);
          const isLow =
            threshold > 0 &&
            quantity <= threshold &&
            (quantity > 0 || deliveries.length > 0);
          return (
            <Card key={resource.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium text-muted">{resource.name}</p>
                {isLow ? <Badge tone="warn">Low</Badge> : null}
              </div>
              <p className="num mt-2 text-xl font-semibold text-ink">{formatAmount(quantity)}</p>
              <p className="text-[11px] text-faint">{resource.unitLabel}</p>
              <p className="mt-2 text-[11px] text-muted">
                {formatMoney(quantity * toNumber(resource.unitPrice), currency)}
              </p>
            </Card>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat
          label="Total units on hand"
          value={formatAmount(totalUnits)}
          sub={`Across ${resources.length} resources`}
        />
        <Stat
          label="Stock value"
          value={formatMoney(stockValue, currency)}
          sub="At current unit prices"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.25fr]">
        <Card>
          <CardHeader
            title="Record a delivery"
            subtitle="Increases stock and attributes the units to the supplier."
          />
          <CardBody className="pt-3">
            {suppliers.length === 0 ? (
              <EmptyState
                icon={<Users className="size-6" />}
                title="Add a supplier first"
                description="Deliveries must belong to a supplier so their share can be tracked when units sell."
                action={
                  <Link href="/suppliers" className={buttonClass("primary", "sm")}>
                    <Plus className="size-3.5" />
                    Add supplier
                  </Link>
                }
              />
            ) : resources.length === 0 ? (
              <EmptyState
                icon={<Package className="size-6" />}
                title="No resources configured"
                description="Add resource types in Settings."
                action={
                  <Link href="/settings" className={buttonClass("primary", "sm")}>
                    Open settings
                  </Link>
                }
              />
            ) : (
              <DeliveryForm
                suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }))}
                resources={resources.map((resource) => ({
                  id: resource.id,
                  name: resource.name,
                  unitLabel: resource.unitLabel,
                }))}
                today={todayInput()}
                currency={currency}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Stock adjustment" subtitle="Manual corrections (damage, recount, loss)." />
          <CardBody className="pt-3">
            <AdjustmentForm
              resources={resources.map((r) => ({ id: r.id, name: r.name, unitLabel: r.unitLabel }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Open lots"
            subtitle="Oldest first — this is the order sales consume stock."
          />
          <div className="mt-3">
            {lots.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState
                  icon={<Package className="size-6" />}
                  title="No stock yet"
                  description="Record a delivery to create your first lot."
                />
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Received</Th>
                    <Th>Supplier</Th>
                    <Th>Resource</Th>
                    <Th align="right">Remaining</Th>
                  </tr>
                </thead>
                <tbody>
                  {lots.map((lot) => (
                    <Tr key={lot.id}>
                      <Td className="whitespace-nowrap text-xs text-muted">
                        {formatDate(lot.receivedAt)}
                      </Td>
                      <Td className="max-w-[120px] truncate text-xs">{lot.supplier.name}</Td>
                      <Td className="max-w-[120px] truncate text-xs text-muted">
                        {lot.resource.name}
                      </Td>
                      <Td align="right" className="num text-xs">
                        {formatAmount(toNumber(lot.quantityRemaining))}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Delivery history"
          subtitle="Untouched deliveries can be removed. Once units are sold, void the sale instead."
        />
        <div className="mt-3">
          {deliveries.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState
                icon={<Package className="size-6" />}
                title="No deliveries recorded"
                description="Deliveries are the source of every lot and every supplier balance."
              />
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Supplier</Th>
                  <Th>Resource</Th>
                  <Th align="right">Quantity</Th>
                  <Th align="right">Remaining</Th>
                  <Th>Note</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery) => {
                  const remaining = delivery.lots.reduce(
                    (sum, lot) => sum + toNumber(lot.quantityRemaining),
                    0,
                  );
                  const untouched = delivery.lots.every(
                    (lot) =>
                      toNumber(lot.quantityRemaining) === toNumber(lot.quantityReceived),
                  );
                  return (
                    <Tr key={delivery.id}>
                      <Td className="whitespace-nowrap text-xs text-muted">
                        {formatDate(delivery.receivedAt)}
                      </Td>
                      <Td className="text-xs">{delivery.supplier.name}</Td>
                      <Td className="text-xs text-muted">{delivery.resource.name}</Td>
                      <Td align="right" className="num text-xs">
                        {formatAmount(toNumber(delivery.quantity))}
                      </Td>
                      <Td align="right" className="num text-xs text-muted">
                        {formatAmount(remaining)}
                      </Td>
                      <Td className="max-w-[160px] truncate text-xs text-faint">
                        {delivery.note ?? "—"}
                      </Td>
                      <Td align="right">
                        {untouched ? (
                          <form action={voidDeliveryAction}>
                            <input type="hidden" name="deliveryId" value={delivery.id} />
                            <button
                              type="submit"
                              title="Remove delivery"
                              className="grid size-7 place-items-center rounded-md text-faint transition-colors hover:bg-danger/10 hover:text-danger"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </form>
                        ) : (
                          <span className="text-[10px] text-faint">in use</span>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </div>
      </Card>
    </>
  );
}
