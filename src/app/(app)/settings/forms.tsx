"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  saveLevelsAction,
  updateResourceAction,
  updateWorkspaceAction,
  type FormState,
} from "@/actions/settings";
import {
  Alert,
  Button,
  Field,
  Input,
  Table,
  Td,
  Th,
  Tr,
  cn,
} from "@/components/ui";

export function WorkspaceForm({ name, currency }: { name: string; currency: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateWorkspaceAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <Field label="Workspace name">
        <Input name="name" defaultValue={name} required maxLength={80} />
      </Field>
      <Field label="Currency label" hint="Shown next to every amount, e.g. Credits or Gold.">
        <Input name="currency" defaultValue={currency} required maxLength={20} />
      </Field>

      <Button type="submit" variant="secondary" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save workspace"}
      </Button>
    </form>
  );
}

export function ResourceForm({
  resource,
}: {
  resource: {
    id: string;
    name: string;
    unitLabel: string;
    unitPrice: number;
    lowStockThreshold: number;
  };
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateResourceAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-line bg-surface/70 p-4">
      <input type="hidden" name="id" value={resource.id} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <Field label="Name">
        <Input name="name" defaultValue={resource.name} required maxLength={60} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Unit label">
          <Input name="unitLabel" defaultValue={resource.unitLabel} maxLength={20} />
        </Field>
        <Field label="Default price">
          <Input
            name="unitPrice"
            defaultValue={resource.unitPrice}
            inputMode="numeric"
            className="num"
            required
          />
        </Field>
      </div>

      <Field label="Low-stock threshold" hint="Warn when stock drops to or below this.">
        <Input
          name="lowStockThreshold"
          defaultValue={resource.lowStockThreshold}
          inputMode="numeric"
          className="num"
        />
      </Field>

      <Button type="submit" variant="secondary" size="sm" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save resource"}
      </Button>
    </form>
  );
}

type EditableRow = {
  key: string;
  level: string;
  maxCargoValue: string;
  taxPercent: string;
  flatFee: string;
  minTax: string;
};

export function LevelsEditor({
  levels,
}: {
  levels: {
    level: number;
    maxCargoValue: number;
    taxRateBps: number;
    flatFee: number;
    minTax: number;
  }[];
}) {
  const [rows, setRows] = useState<EditableRow[]>(() =>
    levels.map((level) => ({
      key: `level-${level.level}`,
      level: String(level.level),
      maxCargoValue: String(level.maxCargoValue),
      taxPercent: (level.taxRateBps / 100).toString(),
      flatFee: String(level.flatFee),
      minTax: String(level.minTax),
    })),
  );

  const [state, formAction, pending] = useActionState<FormState, FormData>(saveLevelsAction, {});

  const payload = JSON.stringify(
    rows.map((row) => ({
      level: Number(row.level) || 0,
      maxCargoValue: Number(row.maxCargoValue.replace(/[^\d]/g, "")) || 0,
      taxRateBps: Math.round((Number(row.taxPercent.replace(",", ".")) || 0) * 100),
      flatFee: Number(row.flatFee.replace(/[^\d]/g, "")) || 0,
      minTax: Number(row.minTax.replace(/[^\d]/g, "")) || 0,
    })),
  );

  function update(key: string, field: keyof EditableRow, value: string) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  }

  function addRow() {
    const highest = rows.reduce((max, row) => Math.max(max, Number(row.level) || 0), 0);
    setRows((current) => [
      ...current,
      {
        key: `new-${Date.now()}`,
        level: String(highest + 1),
        maxCargoValue: "",
        taxPercent: "0",
        flatFee: "0",
        minTax: "0",
      },
    ]);
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="rows" value={payload} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <div className="overflow-x-auto rounded-lg border border-line">
        <Table>
          <thead>
            <tr>
              <Th className="w-16">Level</Th>
              <Th align="right">Max cargo value</Th>
              <Th align="right">Tax %</Th>
              <Th align="right">Flat fee</Th>
              <Th align="right">Min tax</Th>
              <Th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={row.key}>
                <Td>
                  <Input
                    value={row.level}
                    onChange={(event) => update(row.key, "level", event.target.value)}
                    inputMode="numeric"
                    className={cn("num h-8 w-14 px-2 text-xs")}
                  />
                </Td>
                <Td>
                  <Input
                    value={row.maxCargoValue}
                    onChange={(event) => update(row.key, "maxCargoValue", event.target.value)}
                    inputMode="numeric"
                    className="num h-8 w-full min-w-28 px-2 text-right text-xs"
                  />
                </Td>
                <Td>
                  <Input
                    value={row.taxPercent}
                    onChange={(event) => update(row.key, "taxPercent", event.target.value)}
                    inputMode="decimal"
                    className="num h-8 w-20 px-2 text-right text-xs"
                  />
                </Td>
                <Td>
                  <Input
                    value={row.flatFee}
                    onChange={(event) => update(row.key, "flatFee", event.target.value)}
                    inputMode="numeric"
                    className="num h-8 w-24 px-2 text-right text-xs"
                  />
                </Td>
                <Td>
                  <Input
                    value={row.minTax}
                    onChange={(event) => update(row.key, "minTax", event.target.value)}
                    inputMode="numeric"
                    className="num h-8 w-24 px-2 text-right text-xs"
                  />
                </Td>
                <Td>
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    title="Remove level"
                    className="grid size-7 place-items-center rounded-md text-faint hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={addRow}>
          <Plus className="size-3.5" />
          Add level
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : `Save ${rows.length} levels`}
        </Button>
      </div>

      <p className="text-[11px] leading-relaxed text-faint">
        Tax per trip = (cargo value × tax %) or the minimum tax, whichever is higher, plus the flat
        fee. Leave the tax % at 0 and use a flat fee for per-trip pricing.
      </p>
    </form>
  );
}
