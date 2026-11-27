import Link from "next/link";
import { CreditCard, Sparkles } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/money";
import {
  entitlementsFor,
  nextPlan,
  planLabel,
  PLAN_LIMITS,
  PLAN_FEATURES,
} from "@/lib/entitlements";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  ProgressBar,
  buttonClass,
} from "@/components/ui";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const session = await requireSession();
  const tenantId = session.tenant.id;

  const [tenant, resourceCount, supplierCount, memberCount, saleCount] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.resource.count({ where: { tenantId, archived: false } }),
    prisma.supplier.count({ where: { tenantId, archived: false } }),
    prisma.membership.count({ where: { tenantId } }),
    prisma.sale.count({ where: { tenantId } }),
  ]);

  if (!tenant) return null;

  const ent = entitlementsFor(tenant.plan);
  const next = nextPlan(tenant.plan);

  const usage: { label: string; current: number; limit: number }[] = [
    { label: "Resources", current: resourceCount, limit: ent.limits.resources },
    { label: "Suppliers", current: supplierCount, limit: ent.limits.suppliers },
    { label: "Members", current: memberCount, limit: ent.limits.members },
    { label: "Sales (all time)", current: saleCount, limit: ent.limits.salesPerMonth },
  ];

  const featureList = Object.entries(PLAN_FEATURES[ent.plan]) as [string, boolean][];

  return (
    <>
      <PageHeader
        title="Billing & plan"
        description="Your current plan, usage, and upgrade options."
        actions={
          <Link href="/settings" className={buttonClass("ghost", "md")}>
            Back to settings
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Current plan"
            subtitle="Controls features and limits for this workspace."
            action={<Badge tone="info">{planLabel(tenant.plan)}</Badge>}
          />
          <CardBody className="space-y-3 pt-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">{planLabel(tenant.plan)} plan</p>
                <p className="text-xs text-muted">
                  Status: <span className="capitalize">{tenant.subscriptionStatus}</span>
                  {tenant.subscriptionExpiresAt
                    ? ` · renews ${tenant.subscriptionExpiresAt.toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              {next ? (
                <Button variant="primary" size="sm">
                  <Sparkles className="size-3.5" /> Upgrade to {planLabel(next)}
                </Button>
              ) : (
                <Badge tone="success">Top tier</Badge>
              )}
            </div>

            <div className="rounded-lg border border-line bg-canvas/50 p-3">
              <p className="text-[10px] uppercase tracking-wider text-faint">Provider</p>
              <p className="mt-1 text-xs text-muted">
                {tenant.billingProvider
                  ? `${tenant.billingProvider} · ${tenant.billingCustomerId ?? "—"}`
                  : "No billing provider connected yet (Phase 2)."}
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Usage" subtitle="Against your plan's limits." />
          <CardBody className="space-y-3 pt-3">
            {usage.map((row) => {
              const unlimited = !Number.isFinite(row.limit);
              const pct = unlimited ? 0 : Math.min(100, (row.current / row.limit) * 100);
              return (
                <div key={row.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">{row.label}</span>
                    <span className="num text-ink">
                      {row.current} / {unlimited ? "∞" : row.limit}
                    </span>
                  </div>
                  {!unlimited ? <ProgressBar value={pct} className="mt-1.5" /> : null}
                </div>
              );
            })}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Features" subtitle="What your plan unlocks." />
        <CardBody className="pt-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {featureList.map(([feature, enabled]) => (
              <div
                key={feature}
                className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs"
              >
                <span
                  className={
                    enabled ? "text-accent" : "text-faint"
                  }
                >
                  {enabled ? "✓" : "—"}
                </span>
                <span className={enabled ? "text-ink" : "text-muted"}>{feature}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Plans" subtitle="Upgrade anytime. Downgrade keeps data locked for 90 days." />
        <CardBody className="pt-3">
          <div className="grid gap-3 md:grid-cols-3">
            {(["basic", "mid", "premium"] as const).map((p) => {
              const limits = PLAN_LIMITS[p];
              const isCurrent = p === tenant.plan;
              return (
                <div
                  key={p}
                  className={`rounded-lg border p-4 ${
                    isCurrent ? "border-accent/40 bg-accent/[0.04]" : "border-line"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink">{planLabel(p)}</p>
                    {isCurrent ? <Badge tone="success">Current</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {p === "basic" ? "Free forever" : p === "mid" ? "$12 / month" : "$39 / month"}
                  </p>
                  <ul className="mt-3 space-y-1 text-[11px] text-muted">
                    <li>{limits.resources === Infinity ? "Unlimited" : limits.resources} resources</li>
                    <li>{limits.suppliers === Infinity ? "Unlimited" : limits.suppliers} suppliers</li>
                    <li>{limits.members === Infinity ? "Unlimited" : limits.members} members</li>
                    <li>
                      {limits.salesPerMonth === Infinity ? "Unlimited" : limits.salesPerMonth} sales/mo
                    </li>
                  </ul>
                  {!isCurrent && p !== "basic" ? (
                    <Button variant="secondary" size="sm" className="mt-3 w-full">
                      <CreditCard className="size-3.5" /> Choose {planLabel(p)}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </>
  );
}