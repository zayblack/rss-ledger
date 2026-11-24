"use client";

import { useActionState } from "react";
import { createInviteAction, type InviteState } from "@/actions/team";import { CopyButton } from "@/components/copy-button";
import { Alert, Button, Field, Input } from "@/components/ui";

export function InviteForm() {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(
    createInviteAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      {state.link ? (
        <div className="rounded-lg border border-accent/25 bg-accent/[0.06] p-3">
          <p className="text-[10px] uppercase tracking-wider text-accent">Invite link</p>
          <p className="mt-1 break-all text-[11px] leading-relaxed text-muted">{state.link}</p>
          <div className="mt-2">
            <CopyButton value={state.link} />
          </div>
        </div>
      ) : null}

      <Field label="Seller email">
        <Input
          name="email"
          type="email"
          placeholder="seller@example.com"
          required
          autoComplete="off"
        />
      </Field>

      <Field label="Workspace name" hint="Optional — defaults to their name.">
        <Input name="tenantName" placeholder="e.g. North Gate Trading" maxLength={80} />
      </Field>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating…" : "Create invite link"}
      </Button>

      <p className="text-[11px] leading-relaxed text-faint">
        No email is sent. Copy the link and share it directly. Invites expire after 14 days.
      </p>
    </form>
  );
}
