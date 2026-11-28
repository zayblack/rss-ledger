import { redirect } from "next/navigation";
import { Boxes, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="grain relative hidden flex-col justify-between border-r border-line bg-surface/40 p-12 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg border border-accent/30 bg-accent/15 text-accent">
            <Boxes className="size-5" />
          </span>
          <span className="text-sm font-semibold tracking-tight">StockLedger</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-ink">
            Every unit.
            <br />
            Every tax.
            <br />
            <span className="text-accent">Every payout.</span>
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-muted">
            A private ledger for in-game resource sellers. Pack sales into trips, see the
            transport tax before you send, and know exactly what each supplier is owed.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-muted">
            <li className="flex items-start gap-3">
              <TrendingUp className="mt-0.5 size-4 shrink-0 text-accent" />
              Profit net of tax, per sale and per period.
            </li>
            <li className="flex items-start gap-3">
              <Users className="mt-0.5 size-4 shrink-0 text-accent" />
              Supplier balances backed by unit-level FIFO attribution.
            </li>
            <li className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
              Every workspace is fully isolated. Your data stays yours.
            </li>
          </ul>
        </div>

        <p className="text-[11px] text-faint">
          Built for traders who would rather not reconcile a spreadsheet at 2am.
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-lg border border-accent/30 bg-accent/15 text-accent">
              <Boxes className="size-5" />
            </span>
            <span className="text-sm font-semibold tracking-tight">StockLedger</span>
          </div>

          <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted">Welcome back to your trading desk.</p>

          <LoginForm />

          <p className="mt-6 text-xs leading-relaxed text-faint">
            Access is invite-only. Ask the workspace owner for an invite link if you need an
            account.
          </p>
        </div>
      </section>
    </div>
  );
}
