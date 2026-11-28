import Link from "next/link";
import { Package } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { todayInput } from "@/lib/format";
import { PageHeader, buttonClass, EmptyState } from "@/components/ui";
import { QuickSaleForm } from "./quick-form";

export const metadata = { title: "Quick sale" };

export default async function QuickSalePage() {
  const session = await requireSession();
  const tenantId = session.tenant.id;

  const [resources, levels, stockRows] = await Promise.all([
    prisma.resource.findMany({ where: { tenantId, archived: false }, orderBy: { sortOrder: "asc" } }),
    prisma.tradingPostLevel.findMany({ where: { tenantId }, orderBy: { level: "asc" } }),
    prisma.lot.groupBy({ by: ["resourceId"], where: { tenantId }, _sum: { quantityRemaining: true } }),
  ]);

  const stock = new Map(stockRows.map((r) => [r.resourceId, toNumber(r._sum.quantityRemaining)]));
  const totalStock = [...stock.values()].reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Quick sale"
        description="Fast entry for posting a sale from your phone."
        actions={<Link href="/sales" className={buttonClass("ghost", "md")}>Cancel</Link>}
      />
      {resources.length === 0 ? (
        <EmptyState icon={<Package className="size-6" />} title="No resources configured" description="Add resources in Settings." />
      ) : totalStock === 0 ? (
        <EmptyState icon={<Package className="size-6" />} title="No stock on hand" description="Record a delivery first." />
      ) : (
        <QuickSaleForm
          resources={resources.map((r) => ({
            id: r.id,
            name: r.name,
            unitLabel: r.unitLabel,
            unitPrice: toNumber(r.unitPrice),
            stock: stock.get(r.id) ?? 0,
          }))}
          levels={levels.map((l) => ({ level: l.level }))}
          currency={session.tenant.currency}
          today={todayInput()}
        />
      )}
    </>
  );
}