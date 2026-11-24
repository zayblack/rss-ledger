# Resource Ledger

A private, multi-tenant web app for sellers of in-game resources: track stock in
supplier-attributed lots, plan and post shipments with transport tax, attribute
sales to suppliers, and settle supplier payables. Built to later be sold to other
sellers — each gets a fully isolated workspace.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Prisma 6 + SQLite locally (Postgres-ready; see below)
- Tailwind CSS 4, bcryptjs, zod, lucide-react

## Getting started

```bash
npm install
cp .env.example .env          # DATABASE_URL="file:./dev.db"
npm run db:push               # create the SQLite database
npm run db:seed               # seed the owner + placeholder data
npm run dev                   # http://localhost:3000
```

Sign in with the seeded owner:

- Email: `owner@example.com`
- Password: `ledger123`

**Change these in Settings → or re-run the seed with a new owner before onboarding.**

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build (runs TypeScript) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | Regression checks for the money + packing engine |
| `npm run db:push` | Push the Prisma schema to the database |
| `npm run db:seed` | Seed owner, resources, trading post levels, demo data |
| `npm run db:studio` | Open Prisma Studio |

## Switching to Postgres

The schema uses only portable Prisma features. To move to Postgres:

1. In `prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`.
2. Set `DATABASE_URL` in `.env` to your Postgres connection string.
3. Run `npm run db:push` (or `prisma migrate dev`) and `npm run db:seed`.

No code changes required.

## How the money works

- **Gross** = sum of quantity × unit price on the sale.
- **Tax** is calculated **per packed trip** from the trading post level table
  (cargo cap + tax rate). Packing is automatic: highest-value units first, no
  splitting of units, multiple trips when needed.
- **Net revenue** = gross − tax.
- **Supplier share** = a percentage of the **gross sale price** of the exact
  units they supplied, frozen at posting time. Units are consumed **FIFO** from
  supplier-attributed lots.
- **Profit** = net revenue − supplier shares.
- Money is stored as whole units (`BigInt`), never floats. Percentages use
  basis points (`bps`) with half-up rounding for tax and floor for supplier
  shares (so you never overpay a fraction).

## Correcting mistakes

Posted shipments are **immutable**. To correct one, void it from its detail
page — stock is restored, supplier credits are reversed, and the reversal is
recorded in the ledger. Then rebook a new shipment.

## Multi-tenancy

- The first user (seeded owner) is an **owner**. Owners can create invite links
  (no email sending — copy and share directly).
- Accepting an invite creates a **new, empty tenant** seeded with a copy of the
  inviter's resource list and trading post table. No sales, stock, suppliers or
  payments are copied.
- Tenants are fully isolated: every query is scoped by `tenantId`, and
  `requireSession` / `requireOwner` enforce access.
- Each invited seller becomes the owner of their own workspace and can in turn
  invite others.

## Productization notes

- Supplier share basis is stored as `shareBasis` (default `gross`) so the basis
  can be switched later without rewriting history.
- Audit log (`AuditLog`) records every mutation.
- `Resource`, `TradingPostLevel`, `Supplier`, etc. are all per-tenant.
- No customer checkout — sales are logged manually by the seller.
- Suppliers do not log in; they are records managed by the seller.

## Project layout

```
prisma/          schema + seed
src/app/         routes (Next.js App Router)
src/actions/     server actions (mutations)
src/lib/         db, money, calc, format, auth, audit, defaults
src/components/  UI primitives + shell
scripts/         check-calc.ts (regression checks)
```
EOF
echo written