"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Package, Sparkles } from "lucide-react";
import { createShipmentAction } from "@/actions/shipments";
import {
  planShipment,
  previewSupplierShares,
  type LevelRule,
  type PlanLine,
  type SupplierLot,
} from "@/lib/calc";
import { formatAmount, formatMoney, percentOf } from "@/lib/money";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  ProgressBar,
  Select,
  Textarea,
  cn,
} from "@/components/ui";

type ResourceOption = {
  id: string;
  name: string;
  unitLabel: string;
  unitPrice: number;
  stock: number;
};

type LevelOption = LevelRule;

type LotOption = {
  id: string;
  supplierId: string;
  supplierName: string;
  shareBps: number;
  quantityRemaining: number;
  receivedAt: string;
};

type Row = { quantity: string; unitPrice: string };

function toInt(value: string): number {
  const cleaned = value.replace(/[^\d]/g, "");
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

function money(value: number, currency: string) {
  return formatMoney(value, currency);
}

export function Planner({
  resources,
  levels,
  lotsByResource,
  currency,
  today,
}: {
  resources: ResourceOption[];
  levels: LevelOption[];
  lotsByResource: Record<string, LotOption[]>;
  currency: string;
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const defaultLevel =
    levels.find((level) => level.level === 17)?.level ?? levels[levels.length - 1]?.level ?? 1;

  const [customerName, setCustomerName] = useState("");
  const [soldAt, setSoldAt] = useState(today);
  const [notes, setNotes] = useState("");
  const [level, setLevel] = useState(defaultLevel);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      resources.map((resource) => [
        resource.id,
        { quantity: "", unitPrice: String(resource.unitPrice) },
      ]),
    ),
  );

  const levelRule = levels.find((entry) => entry.level === level) ?? levels[0];

  const lines: PlanLine[] = useMemo(
    () =>
      resources
        .map((resource) => {
          const row = rows[resource.id] ?? { quantity: "", unitPrice: "0" };
          return {
            resourceId: resource.id,
            name: resource.name,
            quantity: toInt(row.quantity),
            unitPrice: toInt(row.unitPrice),
          };
        })
        .filter((line) => line.quantity > 0),
    [resources, rows],
  );

  const planned = useMemo(() => {
    if (!levelRule) return null;
    return planShipment(lines, levelRule);
  }, [lines, levelRule]);

  const stockProblems = useMemo(
    () =>
      lines
        .map((line) => {
          const resource = resources.find((entry) => entry.id === line.resourceId);
          const available = resource?.stock ?? 0;
          return line.quantity > available
            ? { name: line.name, need: line.quantity, available }
            : null;
        })
        .filter((entry): entry is { name: string; need: number; available: number } => entry !== null),
    [lines, resources],
  );

  const shareRows = useMemo(() => {
    const mapped: Record<string, SupplierLot[]> = {};
    for (const [resourceId, lots] of Object.entries(lotsByResource)) {
      mapped[resourceId] = lots;
    }
    return previewSupplierShares(lines, mapped);
  }, [lines, lotsByResource]);

  const shareTotal = shareRows.reduce((sum, row) => sum + row.amount, 0);
  const plan = planned?.ok ? planned.plan : null;
  const gross = plan?.gross ?? 0;
  const tax = plan?.tax ?? 0;
  const net = plan?.net ?? 0;
  const profit = net - shareTotal;
  const margin = percentOf(profit, gross);
  const taxPlusShares = tax + shareTotal;
  const viability = gross > 0 ? percentOf(taxPlusShares, gross) : 0;

  const canSubmit =
    Boolean(plan) &&
    stockProblems.length === 0 &&
    customerName.trim().length > 0 &&
    soldAt.length === 10 &&
    !pending;

  function updateRow(resourceId: string, field: keyof Row, value: string) {
    setRows((current) => ({
      ...current,
      [resourceId]: {
        ...(current[resourceId] ?? { quantity: "", unitPrice: "0" }),
        [field]: value.replace(/[^\d]/g, ""),
      },
    }));
  }

  function submit() {
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const result = await createShipmentAction({
        customerName: customerName.trim(),
        soldAt,
        notes: notes.trim() || undefined,
        level,
        lines: lines.map((line) => ({
          resourceId: line.resourceId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        })),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/shipments/${result.id}`);
      router.refresh();
    });
  }

  if (levels.length === 0) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm font-medium">No trading post levels configured</p>
          <p className="mt-1 text-xs text-muted">
            Add your level table before planning a shipment.
          </p>
          <Link
            href="/settings#levels"
            className="mt-4 inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-[#052a20]"
          >
            Open the level table
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr] lg:items-start">
      <div className="space-y-4">
        <Card>
          <CardHeader title="Sale details" subtitle="Who bought it and when." />
          <CardBody className="grid gap-4 pt-3 sm:grid-cols-2">
            <Field label="Customer">
              <Input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="e.g. Vantage Guild"
                maxLength={120}
                autoFocus
                data-field="customerName"
              />
            </Field>
            <Field label="Sale date">
              <Input
                type="date"
                value={soldAt}
                onChange={(event) => setSoldAt(event.target.value)}
                data-field="soldAt"
              />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional — delivery window, agreed price, anything worth remembering."
                maxLength={2000}
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Resources"
            subtitle="Enter quantities to sell. Prices default to your saved rates."
            action={
              <span className="text-[11px] text-faint">
                {formatAmount(lines.reduce((sum, line) => sum + line.quantity, 0))} units
              </span>
            }
          />
          <CardBody className="pt-3">
            <div className="space-y-2">
              {resources.map((resource) => {
                const row = rows[resource.id] ?? { quantity: "", unitPrice: "0" };
                const quantity = toInt(row.quantity);
                const price = toInt(row.unitPrice);
                const overStock = quantity > resource.stock;
                const total = quantity * price;
                return (
                  <div
                    key={resource.id}
                    className={cn(
                      "grid grid-cols-2 items-end gap-2 rounded-lg border px-3 py-2.5 sm:grid-cols-[1.2fr_0.8fr_0.8fr_1fr]",
                      quantity > 0 ? "border-line-strong bg-white/[0.02]" : "border-line",
                    )}
                  >
                    <div className="col-span-2 sm:col-span-1">
                      <p className="text-sm font-medium text-ink">{resource.name}</p>
                      <p className={cn("text-[11px]", overStock ? "text-danger" : "text-faint")}>
                        {formatAmount(resource.stock)} {resource.unitLabel} in stock
                      </p>
                    </div>
                    <Field label="Quantity">
                      <Input
                        value={row.quantity}
                        onChange={(event) => updateRow(resource.id, "quantity", event.target.value)}
                        inputMode="numeric"
                        placeholder="0"
                        className={cn("num", overStock && "border-danger/50")}
                        data-resource-id={resource.id}
                        data-field="quantity"
                      />
                    </Field>
                    <Field label={`Price / ${resource.unitLabel}`}>
                      <Input
                        value={row.unitPrice}
                        onChange={(event) => updateRow(resource.id, "unitPrice", event.target.value)}
                        inputMode="numeric"
                        className="num"
                        data-resource-id={resource.id}
                        data-field="unitPrice"
                      />
                    </Field>
                    <div className="col-span-2 flex items-center justify-between sm:col-span-1 sm:block sm:text-right">
                      <span className="text-[10px] uppercase tracking-wider text-faint">Line</span>
                      <p className="num text-sm text-ink">{formatMoney(total, currency)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {resources.length === 0 ? (
              <Alert tone="warn" className="mt-2">
                No resources configured. Add them in Settings first.
              </Alert>
            ) : null}

            {stockProblems.length > 0 ? (
              <Alert tone="danger" className="mt-3">
                Not enough stock:{" "}
                {stockProblems
                  .map((problem) => `${problem.name} needs ${problem.need}, have ${problem.available}`)
                  .join(" · ")}
              </Alert>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Trading post level"
            subtitle="Determines trip capacity and tax rate."
            action={<Badge tone="info">Auto-packs trips</Badge>}
          />
          <CardBody className="pt-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field label="Level">
                <Select value={level} onChange={(event) => setLevel(Number(event.target.value))}>
                  {levels.map((entry) => (
                    <option key={entry.level} value={entry.level}>
                      Level {entry.level} — {formatAmount(entry.maxCargoValue)} cap ·{" "}
                      {(entry.taxRateBps / 100).toFixed(2).replace(/\.?0+$/, "")}% tax
                    </option>
                  ))}
                </Select>
              </Field>
              {levelRule ? (
                <div className="rounded-lg border border-line bg-canvas px-3 py-2 text-right">
                  <p className="text-[10px] uppercase tracking-wider text-faint">Tax on a full trip</p>
                  <p className="num text-sm text-warn">
                    {formatMoney(
                      Math.max(
                        Math.round((levelRule.maxCargoValue * levelRule.taxRateBps) / 10_000),
                        levelRule.minTax,
                      ) + levelRule.flatFee,
                      currency,
                    )}
                  </p>
                </div>
              ) : null}
            </div>
          </CardBody>
        </Card>

        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>

      <div className="space-y-4 lg:sticky lg:top-6">
        <Card className="overflow-hidden">
          <div className="border-b border-line bg-gradient-to-br from-accent/[0.09] to-transparent px-5 py-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-accent">
              Shipment preview
            </p>
            <p className="num mt-1 text-2xl font-semibold text-ink">
              {plan ? money(net, currency) : "—"}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {plan
                ? `${plan.trips.length} trip${plan.trips.length === 1 ? "" : "s"} · net after tax`
                : "Add resources to see the plan"}
            </p>
          </div>

          <CardBody className="space-y-3 pt-4">
            <SummaryRow label="Gross cargo value" value={money(gross, currency)} />
            <SummaryRow label="Transport tax" value={money(tax, currency)} tone="warn" />
            <div className="h-px bg-line" />
            <SummaryRow label="Net to you" value={money(net, currency)} strong />
            <SummaryRow label="Supplier share" value={money(shareTotal, currency)} />
            <SummaryRow
              label="Your profit"
              value={money(profit, currency)}
              tone={profit < 0 ? "danger" : "accent"}
              strong
            />
            {gross > 0 ? (
              <div className="flex items-center justify-between text-[11px] text-faint">
                <span>Margin</span>
                <span className="num">{margin.toFixed(1)}%</span>
              </div>
            ) : null}

            {viability >= 100 ? (
              <Alert tone="danger">
                Tax plus supplier shares exceed the sale price. This shipment loses money — raise
                the price or renegotiate the share.
              </Alert>
            ) : viability >= 90 ? (
              <Alert tone="warn">
                Tax plus supplier shares consume {viability.toFixed(0)}% of the sale. Thin margin.
              </Alert>
            ) : null}

            {shareRows.length > 0 ? (
              <div className="rounded-lg border border-line bg-canvas/60 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-faint">
                  Supplier split
                </p>
                <div className="mt-2 space-y-1.5">
                  {shareRows.map((row) => (
                    <div key={row.supplierId} className="flex items-center justify-between text-xs">
                      <span className="truncate text-muted">{row.supplierName}</span>
                      <span className="num text-ink">{formatMoney(row.amount, currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

              <Button
                type="button"
                size="lg"
                className="w-full"
                disabled={!canSubmit}
                onClick={submit}
                data-action="post-shipment"
              >
              {pending ? "Posting…" : "Confirm & post shipment"}
              {!pending ? <ArrowRight className="size-4" /> : null}
            </Button>
            <p className="text-center text-[10px] leading-relaxed text-faint">
              Stock is reduced, tax is recorded, and supplier balances are credited only when you
              confirm.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Trip manifest"
            subtitle={plan ? `${plan.trips.length} packed trip${plan.trips.length === 1 ? "" : "s"}` : "Nothing packed yet"}
            action={<Sparkles className="size-4 text-faint" />}
          />
          <CardBody className="space-y-2 pt-3">
            {!plan ? (
              <p className="text-xs text-muted">
                {planned && !planned.ok ? planned.error : "Add at least one resource to pack trips."}
              </p>
            ) : (
              plan.trips.map((trip) => {
                const fill = percentOf(trip.cargoValue, trip.capacity);
                return (
                  <div key={trip.seq} className="rounded-lg border border-line bg-canvas/50 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-ink">
                        Trip {trip.seq} · Level {trip.level}
                      </span>
                      <span className="num text-muted">
                        {formatAmount(trip.cargoValue)} / {formatAmount(trip.capacity)}
                      </span>
                    </div>
                    <ProgressBar
                      value={fill}
                      tone={fill > 95 ? "accent" : fill > 60 ? "info" : "warn"}
                      className="mt-2"
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {trip.items.map((item) => {
                        const resource = resources.find((entry) => entry.id === item.resourceId);
                        return (
                          <span
                            key={item.resourceId}
                            className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] text-muted"
                          >
                            {resource?.name ?? "Resource"} × {formatAmount(item.quantity)}
                          </span>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-faint">
                      <span>{fill.toFixed(0)}% full</span>
                      <span className="num">tax {formatMoney(trip.tax, currency)}</span>
                    </div>
                  </div>
                );
              })
            )}

            {plan && plan.warnings.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                {plan.warnings.map((warning) => (
                  <p key={warning} className="flex items-start gap-1.5 text-[11px] text-warn">
                    <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone = "default",
  strong = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "warn" | "accent" | "danger";
  strong?: boolean;
}) {
  const toneClass =
    tone === "warn"
      ? "text-warn"
      : tone === "accent"
        ? "text-accent"
        : tone === "danger"
          ? "text-danger"
          : "text-ink";
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted">{label}</span>
      <span className={cn("num", toneClass, strong ? "text-sm font-semibold" : "text-sm")}>
        {value}
      </span>
    </div>
  );
}
