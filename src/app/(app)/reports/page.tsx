import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canUse } from "@/lib/entitlements";
import { toNumber, formatMoney, formatAmount } from "@/lib/money";
import { formatDate, startOfDayUtc } from "@/lib/format";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
  Tr,
  buttonClass,
} from "@/components/ui";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const session = await requireSession();
  const tenantId = session.tenant.id;
  const currency = session.tenant.currency;

  if (!canUse(session.tenant.plan, "advancedReports")) {
    return (
      <>
        <PageHeader title="Advanced reports" description="Profit by resource, supplier, and level." />
        <Card>
          <CardBody>
            <EmptyState
              icon={<BarChart3 className="size-5" />}
              title="Advanced reports require Mid plan or higher"
              description="Upgrade to unlock profit-by-resource, supplier profitability, and tax-by-level breakdowns."
            />
            <div className="mt-4 text-center">
              <Link href="/settings/billing" className={buttonClass("primary", "md")}>
                View plans
              </Link>
            </div>
          </CardBody>
        </Card>
      </>
    );
  }

  const [resources, consumptions, trips, postedSales] = await Promise.all([
    prisma.resource.findMany({ where: { tenantId } }),
    prisma.lotConsumption.findMany({
      where: { sale: { tenantId, status: "posted" } },
      include: { supplier: true },
    }),
    prisma.trip.findMany({ where: { sale: { tenantId, status: "posted" } } }),
    prisma.sale.findMany({
      where: { tenantId, status: "posted" },
      select: { soldAt: true, grossTotal: true, taxTotal: true, netTotal: true, supplierShareTotal: true },
    }),
  ]);

  const resourceMap = new Map(resources.map((r) => [r.id, r]));

  // Profit by resource (from sale lines)
  const saleLines = await prisma.saleLine.findMany({
    where: { sale: { tenantId, status: "posted" } },
  });
  const byResource = new Map<string, { qty: number; gross: number }>();
  for (const line of saleLines) {
    const cur = byResource.get(line.resourceId) ?? { qty: 0, gross: 0 };
    cur.qty += toNumber(line.quantity);
    cur.gross += toNumber(line.lineTotal);
    byResource.set(line.resourceId, cur);
  }

  // Supplier profitability
  const bySupplier = new Map<string, { name: string; qty: number; gross: number; share: number }>();
  for (const c of consumptions) {
    const cur = bySupplier.get(c.supplierId) ?? { name: c.supplier.name, qty: 0, gross: 0, share: 0 };
    cur.qty += toNumber(c.quantity);
    cur.gross += toNumber(c.quantity) * toNumber(c.unitPrice);
    cur.share += toNumber(c.shareAmount);
    bySupplier.set(c.supplierId, cur);
  }

  // Tax by level
  const byLevel = new Map<number, { cargo: number; tax: number; trips: number }>();
  for (const t of trips) {
    const cur = byLevel.get(t.level) ?? { cargo: 0, tax: 0, trips: 0 };
    cur.cargo += toNumber(t.cargoValue);
    cur.tax += toNumber(t.tax);
    cur.trips += 1;
    byLevel.set(t.level, cur);
  }

  // 14-day trend
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = startOfDayUtc(13 - i);
    return { key: d.toISOString().slice(0, 10), label: formatDate(d), gross: 0, tax: 0, net: 0, profit: 0 };
  });
  const dayIndex = new Map(days.map((d) => [d.key, d]));
  for (const s of postedSales) {
    const key = s.soldAt.toISOString().slice(0, 10);
    const b = dayIndex.get(key);
    if (b) {
      b.gross += toNumber(s.grossTotal);
      b.tax += toNumber(s.taxTotal);
      b.net += toNumber(s.netTotal);
      b.profit += toNumber(s.netTotal) - toNumber(s.supplierShareTotal);
    }
  }

  return (
    <>
      <PageHeader title="Advanced reports" description="Where your money comes from and where it goes." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profit by resource" subtitle="Gross revenue per resource." />
          <CardBody className="pt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Resource</Th>
                  <Th align="right">Units</Th>
                  <Th align="right">Gross</Th>
                </tr>
              </thead>
              <tbody>
                {[...byResource.entries()].map(([rid, v]) => (
                  <Tr key={rid}>
                    <Td className="text-xs">{resourceMap.get(rid)?.name ?? rid}</Td>
                    <Td align="right" className="num text-xs">{formatAmount(v.qty)}</Td>
                    <Td align="right" className="num text-xs">{formatMoney(v.gross, currency)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Supplier profitability" subtitle="Gross attributed vs. share paid." />
          <CardBody className="pt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Supplier</Th>
                  <Th align="right">Units</Th>
                  <Th align="right">Gross</Th>
                  <Th align="right">Share</Th>
                </tr>
              </thead>
              <tbody>
                {[...bySupplier.values()]
                  .sort((a, b) => b.gross - a.gross)
                  .map((v) => (
                    <Tr key={v.name}>
                      <Td className="text-xs">{v.name}</Td>
                      <Td align="right" className="num text-xs">{formatAmount(v.qty)}</Td>
                      <Td align="right" className="num text-xs">{formatMoney(v.gross, currency)}</Td>
                      <Td align="right" className="num text-xs">{formatMoney(v.share, currency)}</Td>
                    </Tr>
                  ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Tax by level" subtitle="Transport tax per trading-post level." />
          <CardBody className="pt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Level</Th>
                  <Th align="right">Trips</Th>
                  <Th align="right">Cargo</Th>
                  <Th align="right">Tax</Th>
                </tr>
              </thead>
              <tbody>
                {[...byLevel.entries()]
                  .sort((a, b) => a[0] - b[0])
                  .map(([level, v]) => (
                    <Tr key={level}>
                      <Td className="text-xs">Level {level}</Td>
                      <Td align="right" className="num text-xs">{v.trips}</Td>
                      <Td align="right" className="num text-xs">{formatMoney(v.cargo, currency)}</Td>
                      <Td align="right" className="num text-xs">{formatMoney(v.tax, currency)}</Td>
                    </Tr>
                  ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="14-day trend" subtitle="Net revenue and profit by day." />
          <CardBody className="pt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Day</Th>
                  <Th align="right">Gross</Th>
                  <Th align="right">Tax</Th>
                  <Th align="right">Profit</Th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <Tr key={d.key}>
                    <Td className="text-xs">{d.label}</Td>
                    <Td align="right" className="num text-xs">{formatMoney(d.gross, currency)}</Td>
                    <Td align="right" className="num text-xs">{formatMoney(d.tax, currency)}</Td>
                    <Td align="right" className="num text-xs">{formatMoney(d.profit, currency)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      </div>
    </>
  );
}