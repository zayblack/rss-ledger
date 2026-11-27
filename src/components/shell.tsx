"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Truck,
  UserCog,
  Users,
} from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { cn } from "./ui";
import { initials } from "@/lib/format";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  ownerOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sales", label: "Sales", icon: Truck },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/suppliers", label: "Suppliers", icon: Users },
  { href: "/team", label: "Team", icon: UserCog, ownerOnly: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand({ tenantName }: { tenantName: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-accent/30 bg-accent/15 text-accent">
        <Boxes className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold tracking-tight text-ink">
          Resource Ledger
        </span>
        <span className="block truncate text-[11px] text-faint">{tenantName}</span>
      </span>
    </Link>
  );
}

export function Shell({
  tenantName,
  currency,
  userName,
  userEmail,
  role,
  children,
}: {
  tenantName: string;
  currency: string;
  userName: string;
  userEmail: string;
  role: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const nav = NAV.filter((item) => !item.ownerOnly || role === "owner");

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface/50 px-3 py-5 lg:flex">
        <div className="px-2">
          <Brand tenantName={tenantName} />
        </div>

        <nav className="mt-7 flex-1 space-y-0.5">
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent/10 font-medium text-accent"
                    : "text-muted hover:bg-white/[0.04] hover:text-ink",
                )}
              >
                <Icon className={cn("size-4", active ? "text-accent" : "text-faint")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 rounded-lg border border-line bg-surface-2/60 p-2.5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line-strong bg-canvas text-[11px] font-semibold text-muted">
              {initials(userName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink">{userName}</p>
              <p className="truncate text-[10px] text-faint">{userEmail}</p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                title="Sign out"
                className="grid size-7 place-items-center rounded-md text-faint transition-colors hover:bg-white/[0.06] hover:text-danger"
              >
                <LogOut className="size-3.5" />
              </button>
            </form>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-[10px] text-faint">
            <span className="capitalize">{role}</span>
            <span>{currency}</span>
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Brand tenantName={tenantName} />
            <form action={logoutAction}>
              <button
                type="submit"
                className="grid size-8 place-items-center rounded-md text-faint hover:text-danger"
                title="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            {nav.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                    active
                      ? "bg-accent/10 font-medium text-accent"
                      : "text-muted hover:bg-white/[0.04] hover:text-ink",
                  )}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-[1220px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
