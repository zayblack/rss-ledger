import Link from "next/link";
import { Boxes, Clock, XCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { AcceptInviteForm } from "./accept-form";

export const metadata = { title: "Accept invite" };

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { tenant: true },
  });

  const valid =
    invite !== null && invite.status === "pending" && invite.expiresAt.getTime() > Date.now();

  return (
    <div className="grain flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg border border-accent/30 bg-accent/15 text-accent">
            <Boxes className="size-5" />
          </span>
          <span className="text-sm font-semibold tracking-tight">StockLedger</span>
        </div>

        <div className="rounded-2xl border border-line bg-surface/80 p-6 shadow-2xl shadow-black/40">
          {valid && invite ? (
            <>
              <h1 className="text-xl font-semibold tracking-tight">
                You are invited to your own workspace
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                <span className="text-ink">{invite.tenant.name}</span> invited you. You will get a
                private workspace with the same resource list and trading post table — and none of
                their data.
              </p>
              <AcceptInviteForm
                token={invite.token}
                email={invite.email}
                defaultWorkspace={invite.tenantName ?? ""}
              />
            </>
          ) : (
            <div className="text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-full border border-danger/25 bg-danger/10 text-danger">
                {invite?.status === "accepted" ? (
                  <Clock className="size-5" />
                ) : (
                  <XCircle className="size-5" />
                )}
              </span>
              <h1 className="mt-4 text-lg font-semibold">This invite is not available</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {invite?.status === "accepted"
                  ? "This invite has already been used. Sign in with the account you created."
                  : "The link may have expired or been revoked. Ask the workspace owner for a fresh invite."}
              </p>
              <Link
                href="/login"
                className="mt-5 inline-flex h-9 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-[#052a20] hover:bg-[#4ee3b0]"
              >
                Go to sign in
              </Link>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-faint">
          Every workspace is isolated. You will never see another seller&apos;s sales or suppliers.
        </p>
      </div>
    </div>
  );
}
