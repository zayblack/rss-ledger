import { requireSession } from "@/lib/auth";
import { Shell } from "@/components/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <Shell
      tenantName={session.tenant.name}
      currency={session.tenant.currency}
      userName={session.user.name}
      userEmail={session.user.email}
      role={session.membership.role}
      theme={session.tenant.theme}
      themeAccent={session.tenant.themeAccent}
    >
      {children}
    </Shell>
  );
}
