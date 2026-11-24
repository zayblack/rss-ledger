import Link from "next/link";
import { Package } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { todayInput } from "@/lib/format";
import { PageHeader, buttonClass, EmptyState } from "@/components/ui";
import { Planner } from "./planner";

export const metadata = { title: "Plan shipment" };

export default async function NewShipmentPage() {
  const session = await requireSession();
  const tenantId = session.tenant.id;

  const [resources, levels, lots, stockRows] = await Promise.all([
    prisma.resource.findMany({
      where: { tenantId, archived: false },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.tradingPostLevel.findMany({ where: { tenantId }, orderBy: { level: "asc" } }),
    prisma.lot.findMany({
      where: { tenantId, quantityRemaining: { gt: 0 } },
      include: { supplier: true },
      orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
    }),
    prisma.lot.groupBy({
      by: ["resourceId"],
      where: { tenantId },
      _sum: { quantityRemaining: true },
    }),
  ]);

  const stock = new Map(
    stockRows.map((row) => [row.resourceId, toNumber(row._sum.quantityRemaining)]),
  );

  const lotsByResource: Record<
    string,
    {
      id: string;
      supplierId: string;
      supplierName: string;
      shareBps: number;
      quantityRemaining: number;
      receivedAt: string;
    }[]
  > = {};

  for (const lot of lots) {
    const entry = {
      id: lot.id,
      supplierId: lot.supplierId,
      supplierName: lot.supplier.name,
      shareBps: lot.supplier.shareBps,
      quantityRemaining: toNumber(lot.quantityRemaining),
      receivedAt: lot.receivedAt.toISOString(),
    };
    (lotsByResource[lot.resourceId] ??= []).push(entry);
  }

  const totalStock = [...stock.values()].reduce((sum, value) => sum + value, 0);

  return (
    <>
      <PageHeader
        title="Plan shipment"
        description="Build the sale, pack it into trips, and see tax and supplier shares before posting."
        actions={
          <Link href="/shipments" className={buttonClass("ghost", "md")}>
            Cancel
          </Link>
        }
      />

      {resources.length === 0 ? (
        <EmptyState
          icon={<Package className="size-6" />}
          title="No resources configured"
          description="Add your resource types and prices in Settings before planning a shipment."
          action={
            <Link href="/settings" className={buttonClass("primary", "sm")}>
              Open settings
            </Link>
          }
        />
      ) : totalStock === 0 ? (
        <EmptyState
          icon={<Package className="size-6" />}
          title="No stock on hand"
          description="Record a supplier delivery first — the planner draws from real lots so it can credit the right supplier."
          action={
            <Link href="/inventory" className={buttonClass("primary", "sm")}>
              Record a delivery
            </Link>
          }
        />
      ) : (
        <Planner
          resources={resources.map((resource) => ({
            id: resource.id,
            name: resource.name,
            unitLabel: resource.unitLabel,
            unitPrice: toNumber(resource.unitPrice),
            stock: stock.get(resource.id) ?? 0,
          }))}
          levels={levels.map((level) => ({
            level: level.level,
            maxCargoValue: toNumber(level.maxCargoValue),
            taxRateBps: level.taxRateBps,
            flatFee: toNumber(level.flatFee),
            minTax: toNumber(level.minTax),
          }))}
          lotsByResource={lotsByResource}
          currency={session.tenant.currency}
          today={todayInput()}
        />
      )}
    </>
  );
}
