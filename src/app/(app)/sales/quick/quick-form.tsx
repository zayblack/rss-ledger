"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSaleAction } from "@/actions/sales";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Select } from "@/components/ui";

type Resource = { id: string; name: string; unitLabel: string; unitPrice: number; stock: number };

export function QuickSaleForm({
  resources,
  levels,
  currency,
  today,
}: {
  resources: Resource[];
  levels: { level: number }[];
  currency: string;
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [customer, setCustomer] = useState("");
  const [soldAt, setSoldAt] = useState(today);
  const [level, setLevel] = useState(levels[0]?.level ?? 1);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [price, setPrice] = useState<Record<string, string>>(
    Object.fromEntries(resources.map((r) => [r.id, String(r.unitPrice)])),
  );

  function submit() {
    const lines = resources
      .map((r) => ({ resourceId: r.id, quantity: Number(qty[r.id] || 0), unitPrice: Number(price[r.id] || r.unitPrice) }))
      .filter((l) => l.quantity > 0);
    if (lines.length === 0) {
      setError("Add at least one quantity.");
      return;
    }
    if (!customer.trim()) {
      setError("Enter a customer name.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createSaleAction({
        customerName: customer.trim(),
        soldAt,
        level,
        lines,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/sales/${result.id}`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader title="Sale details" />
      <CardBody className="space-y-4 pt-3">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Field label="Customer">
          <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer" />
        </Field>
        <Field label="Date">
          <Input type="date" value={soldAt} onChange={(e) => setSoldAt(e.target.value)} />
        </Field>
        <Field label="Level">
          <Select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            {levels.map((l) => (
              <option key={l.level} value={l.level}>
                Level {l.level}
              </option>
            ))}
          </Select>
        </Field>

        <div className="space-y-2">
          {resources.map((r) => (
            <div key={r.id} className="grid grid-cols-[1fr_0.7fr_0.7fr] items-end gap-2 rounded-lg border border-line px-3 py-2">
              <div>
                <p className="text-sm font-medium text-ink">{r.name}</p>
                <p className="text-[11px] text-faint">
                  {r.stock} in stock
                </p>
              </div>
              <Field label="Qty">
                <Input
                  value={qty[r.id] ?? ""}
                  onChange={(e) => setQty((c) => ({ ...c, [r.id]: e.target.value.replace(/[^0-9]/g, "") }))}
                  inputMode="numeric"
                  placeholder="0"
                  className="num"
                />
              </Field>
              <Field label="Price">
                <Input
                  value={price[r.id] ?? ""}
                  onChange={(e) => setPrice((c) => ({ ...c, [r.id]: e.target.value.replace(/[^0-9]/g, "") }))}
                  inputMode="numeric"
                  className="num"
                />
              </Field>
            </div>
          ))}
        </div>

        <Button type="button" size="lg" className="w-full" disabled={pending} onClick={submit}>
          {pending ? "Posting…" : "Post sale"}
        </Button>
      </CardBody>
    </Card>
  );
}