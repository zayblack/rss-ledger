import { headers } from "next/headers";
import { ShieldCheck, UserPlus } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, initials } from "@/lib/format";
import { revokeInviteAction } from "@/actions/team";
import { CopyButton } from "@/components/copy-button";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { InviteForm } from "./invite-form";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const session = await requireOwner();
  const tenantId = session.tenant.id;

  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto =
    headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const [members, invites] = await Promise.all([
    prisma.membership.findMany({
      where: { tenantId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invite.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const pending = invites.filter(
    (invite) => invite.status === "pending" && invite.expiresAt.getTime() > Date.now(),
  );

  return (
    <>
      <PageHeader
        title="Team"
        description="Invite other sellers. Each one gets a private, fully isolated workspace."
      />

      <Alert tone="info" className="mb-4 flex items-start gap-2">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <span>
          Invited sellers receive a copy of your resource list and trading post table, but none of
          your sales, stock, suppliers or payments. You cannot see their workspace either.
        </span>
      </Alert>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Members"
              subtitle={`${members.length} member${members.length === 1 ? "" : "s"} in this workspace`}
            />
            <div className="mt-3">
              <Table>
                <thead>
                  <tr>
                    <Th>Person</Th>
                    <Th>Role</Th>
                    <Th>Joined</Th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <Tr key={member.id}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <span className="grid size-7 place-items-center rounded-full border border-line-strong bg-canvas text-[10px] font-semibold text-muted">
                            {initials(member.user.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-ink">
                              {member.user.name}
                            </p>
                            <p className="truncate text-[10px] text-faint">{member.user.email}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <Badge tone={member.role === "owner" ? "accent" : "neutral"}>
                          {member.role}
                        </Badge>
                      </Td>
                      <Td className="text-xs text-muted">{formatDate(member.createdAt)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Invites"
              subtitle={`${pending.length} pending · ${invites.length} total`}
            />
            <div className="mt-3">
              {invites.length === 0 ? (
                <div className="px-5 pb-5">
                  <EmptyState
                    icon={<UserPlus className="size-6" />}
                    title="No invites yet"
                    description="Create a link and send it to a seller you trust. They will set their own password."
                  />
                </div>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Email</Th>
                      <Th>Status</Th>
                      <Th>Created</Th>
                      <Th>Link</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((invite) => {
                      const expired =
                        invite.status === "pending" && invite.expiresAt.getTime() <= Date.now();
                      const status = expired ? "expired" : invite.status;
                      return (
                        <Tr key={invite.id}>
                          <Td className="max-w-[200px] truncate text-xs">{invite.email}</Td>
                          <Td>
                            <Badge
                              tone={
                                status === "accepted"
                                  ? "success"
                                  : status === "pending"
                                    ? "info"
                                    : "neutral"
                              }
                            >
                              {status}
                            </Badge>
                          </Td>
                          <Td className="whitespace-nowrap text-xs text-muted">
                            {formatDate(invite.createdAt)}
                          </Td>
                          <Td>
                            {status === "pending" ? (
                              <CopyButton
                                value={`${origin}/accept-invite/${invite.token}`}
                                label="Copy"
                              />
                            ) : (
                              <span className="text-[10px] text-faint">—</span>
                            )}
                          </Td>
                          <Td align="right">
                            {status === "pending" ? (
                              <form action={revokeInviteAction}>
                                <input type="hidden" name="id" value={invite.id} />
                                <button
                                  type="submit"
                                  className="text-[10px] text-faint hover:text-danger"
                                >
                                  revoke
                                </button>
                              </form>
                            ) : null}
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Invite a seller"
            subtitle="They create their own account and workspace."
          />
          <CardBody className="pt-3">
            <InviteForm />
          </CardBody>
        </Card>
      </div>

      <p className="mt-8 text-[11px] leading-relaxed text-faint">
        Need to remove access? Invites can be revoked before acceptance. Deactivating an active
        seller is not yet supported — plan for it before onboarding strangers.
      </p>
    </>
  );
}
