"use client";

import { useActionState } from "react";
import { importResourcesAction, type FormState } from "@/actions/import";
import { Alert, Button, Textarea } from "@/components/ui";

export function ImportForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(importResourcesAction, {});
  return (
    <form action={action} className="space-y-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <Textarea
        name="csv"
        rows={8}
        placeholder={"Iron Ore,units,18000,100\nRaw Silk,units,25000,80"}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Importing…" : "Import"}
      </Button>
    </form>
  );
}