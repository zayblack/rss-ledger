"use client";

import { useActionState } from "react";
import { recordAdjustmentAction, type FormState } from "@/actions/adjustments";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

type Resource = { id: string; name: string; unitLabel: string };

export function AdjustmentForm({ resources }: { resources: Resource[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    recordAdjustmentAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <Field label="Resource">
        <Select name="resourceId" required>
          <option value="">Choose…</option>
          {resources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Field label="Sign">
          <Select name="sign" defaultValue="+">
            <option value="+">Add (+)</option>
            <option value="-">Remove (−)</option>
          </Select>
        </Field>
        <Field label="Quantity">
          <Input name="delta" inputMode="numeric" placeholder="0" required className="num" />
        </Field>
      </div>

      <Field label="Date">
        <Input name="occurredAt" type="date" required />
      </Field>

      <Field label="Reason">
        <Input name="reason" placeholder="Damaged, recount, lost…" maxLength={200} />
      </Field>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Recording…" : "Record adjustment"}
      </Button>
    </form>
  );
}