import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Package,
  Plus,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toNumber, formatAmount, formatMoney, percentOf } from "@/lib/money";
import { formatDate, formatShortDate, daysAgo, startOfDayUtc } from "@/lib/format";
import { loadDemoDataAction } from "@/actions/settings";
import {
  Alert,
  Badge,
  Button,
  buttonClass,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  ProgressBar,
  Stat,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await requireSession();
  const tenantId = session.tenant.id;
  const currency = session.tenant.currency;

  const since = daysAgo(30);
  const chartStart = startOfDayUtc(13);

  const [
    resources,
    stockRows,
    recentSales,
    postedSales,
    suppliers,
    ledgerRows,
    deliveryCount,
    saleCount,
    levelCount,
  ] = await Promise.all([
    prisma.resource.findMany({
      where: { tenantId, archived: false },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.lot.groupBy({
      by: ["resourceId"],
      where: { tenantId },
      _sum: { quantityRemaining: true },
    }),
    prisma.sale.findMany({
      where: { tenantId },
      orderBy: [{ soldAt: "desc" }, { createdAt: "desc" }],
      take: 6,
    }),
    prisma.sale.findMany({
      where: { tenantId, status: "posted", soldAt: { gte: since } },
      select: {
        soldAt: true,
        grossTotal: true,
        taxTotal: true,
        netTotal: true,
        supplierShareTotal: true,
      },
    }),
    prisma.supplier.findMany({
      where: { tenantId, archived: false },
      orderBy: { name: "asc" },
    }),
    prisma.supplierLedgerEntry.groupBy({
      by: ["supplierId"],
      where: { tenantId },
      _sum: { amount: true },
    }),
    prisma.delivery.count({ where: { tenantId } }),
    prisma.sale.count({ where: { tenantId, status: "posted" } }),
    prisma.tradingPostLevel.count({ where: { tenantId } }),
  ]);

  const stock = new Map(
    stockRows.map((row) => [row.resourceId, toNumber(row._sum.quantityRemaining)]),
  );

  const gross = postedSales.reduce((sum, s) => sum + toNumber(s.grossTotal), 0);
  const tax = postedSales.reduce((sum, s) => sum + toNumber(s.taxTotal), 0);
  const net = postedSales.reduce((sum, s) => sum + toNumber(s.netTotal), 0);
  const supplierShare = postedSales.reduce(
    (sum, s) => sum + toNumber(s.supplierShareTotal),
    0,
  );
  const profit = net - supplierShare;

  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  const balances = ledgerRows
    .map((row) => ({
      supplier: supplierById.get(row.supplierId),
      amount: toNumber(row._sum.amount),
    }))
    .filter((row): row is { supplier: (typeof suppliers)[number]; amount: number } =>
      Boolean(row.supplier && row.amount > 0),
    )
    .sort((a, b) => b.amount - a.amount);
  const totalOwed = balances.reduce((sum, row) => sum + row.amount, 0);

  const stockValue = resources.reduce(
    (sum, resource) => sum + (stock.get(resource.id) ?? 0) * toNumber(resource.unitPrice),
    0,
  );
  const totalUnits = resources.reduce((sum, resource) => sum + (stock.get(resource.id) ?? 0), 0);
  const lowStock = resources.filter((resource) => {
    const threshold = toNumber(resource.lowStockThreshold);
    const quantity = stock.get(resource.id) ?? 0;
    return threshold > 0 && quantity <= threshold && (deliveryCount > 0 || quantity > 0);
  });

  const chartDays = Array.from({ length: 14 }, (_, index) => {
    const date = startOfDayUtc(13 - index);
    return { date, key: date.toISOString().slice(0, 10), net: 0 };
  });
  const chartIndex = new Map(chartDays.map((day) => [day.key, day]));
  for (const sale of postedSales) {
    const key = sale.soldAt.toISOString().slice(0, 10);
    const bucket = chartIndex.get(key);
    if (bucket) bucket.net += toNumber(sale.netTotal);
  }
  const chartMax = Math.max(...chartDays.map((day) => day.net), 1);

  const steps = [
    {
      label: "Name your four resources and set prices",
      done: resources.length > 0,
      href: "/settings",
    },
    {
      label: "Review the trading post level table",
      done: levelCount > 0,
      href: "/settings#levels",
    },
    { label: "Add a supplier", done: suppliers.length > 0, href: "/suppliers" },
    { label: "Record a supplier delivery", done: deliveryCount > 0, href: "/inventory" },
    { label: "Post your first sale", done: saleCount > 0, href: "/sales/new" },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  const showOnboarding = doneCount < steps.length;

  const effectiveTaxRate = percentOf(tax, gross);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="What sold, what is left, what the tax took, and what you owe."
        actions={
          <>
            <Link href="/inventory" className={buttonClass("secondary", "md")}>
              <Package className="size-4" />
              Record delivery
            </Link>
            <Link href="/sales/new" className={buttonClass("primary", "md")}>
              <Plus className="size-4" />
              Plan sale
            </Link>
          </>
        }
      />

      {lowStock.length > 0 ? (
        <Alert tone="warn" className="mb-5 flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Low stock on {lowStock.map((resource) => resource.name).join(", ")}. Record a delivery
            before your next sale.
          </span>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Net revenue · 30d"
          value={formatMoney(net, currency)}
          sub={`Gross ${formatAmount(gross)} · profit ${formatAmount(profit)}`}
          tone="accent"
        />
        <Stat
          label="Transport tax · 30d"
          value={formatMoney(tax, currency)}
          sub={gross > 0 ? `${effectiveTaxRate.toFixed(1)}% of gross` : "No sales yet"}
          tone="warn"
        />
        <Stat
          label="Owed to suppliers"
          value={formatMoney(totalOwed, currency)}
          sub={
            balances.length === 0
              ? "Nothing outstanding"
              : `${balances.length} supplier${balances.length === 1 ? "" : "s"}`
          }
        />
        <Stat
          label="Stock on hand"
          value={formatMoney(stockValue, currency)}
          sub={`${formatAmount(totalUnits)} units across ${resources.length} resources`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader
            title="Net revenue"
            subtitle="Last 14 days, after transport tax"
            action={
              <span className="num text-sm font-medium text-accent">
                {formatMoney(
                  chartDays.reduce((sum, day) => sum + day.net, 0),
                  currency,
                )}
              </span>
            }
          />
          <CardBody>
            <div className="flex h-36 items-end gap-1.5">
              {chartDays.map((day, index) => (
                <div key={day.key} className="group flex h-full flex-1 flex-col justify-end gap-1">
                  <div className="flex flex-1 items-end">
                    <div
                      className={
                        day.net > 0
                          ? "w-full rounded-t-sm bg-accent/35 transition-colors group-hover:bg-accent/60"
                          : "w-full rounded-t-sm bg-white/[0.05]"
                      }
                      style={{ height: `${day.net > 0 ? Math.max(4, (day.net / chartMax) * 100) : 2}%` }}
                      title={`${formatDate(day.date)} — ${formatMoney(day.net, currency)}`}
                    />
                  </div>
                  <span className="h-3 text-center text-[9px] text-faint">
                    {index % 2 === 0 ? formatShortDate(day.date) : ""}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
              <span>
                Supplier share:{" "}
                <span className="num text-ink">{formatMoney(supplierShare, currency)}</span>
              </span>
              <span>
                Your profit:{" "}
                <span className="num font-medium text-accent">
                  {formatMoney(profit, currency)}
                </span>
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Stock on hand"
            subtitle={`${formatMoney(stockValue, currency)} at current prices`}
            action={
              <Link href="/inventory" className="text-xs text-muted hover:text-ink">
                Manage
              </Link>
            }
          />
          <CardBody className="pt-2">
            {resources.length === 0 ? (
              <EmptyState
                title="No resources yet"
                description="Add your four resource types in Settings."
                action={
                  <Link href="/settings" className={buttonClass("secondary", "sm")}>
                    Open settings
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-line/60">
                {resources.map((resource) => {
                  const quantity = stock.get(resource.id) ?? 0;
                  const threshold = toNumber(resource.lowStockThreshold);
                  const isLow =
                    threshold > 0 && quantity <= threshold && (quantity > 0 || deliveryCount > 0);
                  return (
                    <div key={resource.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm text-ink">{resource.name}</span>
                          {isLow ? <Badge tone="warn">Low</Badge> : null}
                        </div>
                        <p className="mt-0.5 text-[11px] text-faint">
                          {formatMoney(toNumber(resource.unitPrice), currency)} each
                          {threshold > 0 ? ` · keep ${formatAmount(threshold)}+` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="num text-sm font-medium text-ink">{formatAmount(quantity)}</p>
                        <p className="text-[10px] text-faint">{resource.unitLabel}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader
            title="Recent sales"
            subtitle="Newest sales first"
            action={
              <Link
                href="/sales"
                className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
              >
                All sales <ArrowRight className="size-3" />
              </Link>
            }
          />
          <div className="mt-3">
            {recentSales.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState
                  icon={<Truck className="size-6" />}
                  title="No sales yet"
                  description="Plan a sale to see revenue, tax and supplier shares before you post it."
                  action={
                    <Link href="/sales/new" className={buttonClass("primary", "sm")}>
                      Plan your first sale
                    </Link>
                  }
                />
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Ref</Th>
                    <Th>Date</Th>
                    <Th>Customer</Th>
                    <Th align="right">Net</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale) => (
                    <Tr key={sale.id}>
                      <Td className="num text-xs text-muted">
                        <Link href={`/sales/${sale.id}`} className="hover:text-ink">
                          {sale.reference}
                        </Link>
                      </Td>
                      <Td className="text-xs text-muted">{formatDate(sale.soldAt)}</Td>
                      <Td className="max-w-[160px] truncate text-xs">{sale.customerName}</Td>
                      <Td align="right" className="num text-xs">
                        {formatAmount(toNumber(sale.netTotal))}
                      </Td>
                      <Td>
                        <Badge
                          tone={
                            sale.status === "posted"
                              ? "success"
                              : sale.status === "void"
                                ? "danger"
                                : "neutral"
                          }
                        >
                          {sale.status}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Supplier payables"
            subtitle="Outstanding balance across all time"
            action={
              <Link href="/suppliers" className="text-xs text-muted hover:text-ink">
                View all
              </Link>
            }
          />
          <CardBody className="pt-2">
            {balances.length === 0 ? (
              <EmptyState
                icon={<Wallet className="size-6" />}
                title="Nothing owed"
                description="Supplier credits appear here when their units are sold."
                action={
                  <Link href="/suppliers" className={buttonClass("secondary", "sm")}>
                    Add a supplier
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-line/60">
                {balances.slice(0, 5).map((row) => (
                  <Link
                    key={row.supplier.id}
                    href={`/suppliers/${row.supplier.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{row.supplier.name}</p>
                      <p className="text-[11px] text-faint">
                        {(row.supplier.shareBps / 100).toFixed(0)}% share
                      </p>
                    </div>
                    <span className="num shrink-0 text-sm font-medium text-warn">
                      {formatMoney(row.amount, currency)}
                    </span>
                  </Link>
                ))}
                <div className="flex items-center justify-between pt-3">
                  <span className="text-xs text-muted">Total outstanding</span>
                  <span className="num text-sm font-semibold text-ink">
                    {formatMoney(totalOwed, currency)}
                  </span>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {showOnboarding ? (
        <Card className="mt-4">
          <CardHeader
            title="Get set up"
            subtitle={`${doneCount} of ${steps.length} steps complete`}
            action={
              suppliers.length === 0 && deliveryCount === 0 ? (
                <form action={loadDemoDataAction}>
                  <Button variant="secondary" size="sm" type="submit">
                    Load sample data
                  </Button>
                </form>
              ) : null
            }
          />
          <CardBody className="pt-3">
            <ProgressBar value={(doneCount / steps.length) * 100} className="mb-4" />
            <ul className="grid gap-2 sm:grid-cols-2">
              {steps.map((step) => (
                <li key={step.label}>
                  <Link
                    href={step.href}
                    className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-xs transition-colors hover:border-line-strong hover:bg-white/[0.03]"
                  >
                    {step.done ? (
                      <CheckCircle2 className="size-4 shrink-0 text-accent" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-faint" />
                    )}
                    <span className={step.done ? "text-muted line-through" : "text-ink"}>
                      {step.label}
                    </span>
                    <ArrowRight className="ml-auto size-3 shrink-0 text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
