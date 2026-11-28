import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/actions/notifications";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  buttonClass,
} from "@/components/ui";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await requireSession();
  const tenantId = session.tenant.id;

  const notifications = await prisma.notification.findMany({
    where: { tenantId, OR: [{ userId: session.user.id }, { userId: null }] },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Low stock and system alerts for this workspace."
        actions={
          <div className="flex gap-2">
            {unread > 0 ? (
              <form action={markAllNotificationsReadAction}>
                <Button type="submit" variant="secondary" size="sm">
                  Mark all read
                </Button>
              </form>
            ) : null}
            <Link href="/" className={buttonClass("ghost", "md")}>
              <ArrowLeft className="size-4" />
              Dashboard
            </Link>
          </div>
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-5" />}
          title="No notifications"
          description="Low-stock alerts and other events will appear here."
        />
      ) : (
        <Card>
          <div className="divide-y divide-line">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start gap-3 px-5 py-3">
                <div className={`mt-1 size-2 rounded-full ${n.readAt ? "bg-transparent" : "bg-accent"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{n.title}</p>
                  {n.body ? <p className="text-xs text-muted">{n.body}</p> : null}
                  <p className="mt-1 text-[10px] text-faint">{formatDateTime(n.createdAt)}</p>
                </div>
                {!n.readAt ? (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="id" value={n.id} />
                    <button type="submit" className="text-xs text-accent hover:underline">
                      Mark read
                    </button>
                  </form>
                ) : (
                  <Badge tone="neutral">Read</Badge>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}