import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { PageHeader } from "@/components/shell/PageHeader";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { SignOutButton } from "@/components/profile/SignOutButton";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();

  const blocked = await prisma.block.findMany({
    where: { blockerId: user.id },
    include: { blocked: { select: { id: true, name: true, avatarSeed: true } } },
  });

  return (
    <>
      <PageHeader title="Settings" />

      <div className="max-w-2xl space-y-5">
        <section className="card p-5">
          <h2 className="text-base font-semibold text-ink">Account</h2>
          <dl className="mt-4 divide-y divide-line text-sm">
            <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
              <dt className="text-ink-muted">Email</dt>
              <dd className="font-medium text-ink">{user.email}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-ink-muted">Campus</dt>
              <dd className="font-medium text-ink">{user.university?.name ?? "Not set"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-ink-muted">Student verification</dt>
              <dd>
                {user.studentVerifiedAt ? (
                  <Badge tone="success">Verified</Badge>
                ) : (
                  <Badge tone="warning">Not verified</Badge>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
              <dt className="text-ink-muted">Role</dt>
              <dd className="font-medium text-ink capitalize">{user.role.toLowerCase()}</dd>
            </div>
          </dl>
          <Link
            href="/profile"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
          >
            Edit profile <Icon name="arrowRight" size={15} />
          </Link>
        </section>

        <section className="card p-5">
          <h2 className="text-base font-semibold text-ink">Notifications</h2>
          <p className="mt-1 text-sm text-ink-muted">
            In-app notifications are on for bookings, messages and reviews. Email, SMS and push are
            built into the notification pipeline but not switched on yet — they need a delivery
            provider configured.
          </p>
          <div className="mt-4 space-y-2">
            {[
              { label: "In-app", state: "On", tone: "success" as const },
              { label: "Email", state: "Needs provider", tone: "neutral" as const },
              { label: "SMS", state: "Needs provider", tone: "neutral" as const },
              { label: "Push", state: "Needs provider", tone: "neutral" as const },
            ].map((channel) => (
              <div
                key={channel.label}
                className="flex items-center justify-between rounded-xl bg-surface-muted px-3.5 py-2.5"
              >
                <span className="text-sm font-medium text-ink">{channel.label}</span>
                <Badge tone={channel.tone}>{channel.state}</Badge>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-base font-semibold text-ink">Blocked accounts</h2>
          {blocked.length === 0 ? (
            <p className="mt-1 text-sm text-ink-muted">
              You have not blocked anyone. Blocking stops messages and hides their listings from
              your search.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {blocked.map((block) => (
                <li
                  key={block.id}
                  className="flex items-center gap-3 rounded-xl bg-surface-muted px-3 py-2.5"
                >
                  <Avatar seed={block.blocked.avatarSeed} name={block.blocked.name} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                    {block.blocked.name}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="text-base font-semibold text-ink">Legal</h2>
          <div className="mt-3 grid gap-2">
            {[
              { href: "/legal/terms" as const, label: "Terms of service" },
              { href: "/legal/privacy" as const, label: "Privacy policy" },
              { href: "/legal/guidelines" as const, label: "Community guidelines" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between rounded-xl bg-surface-muted px-3.5 py-3 text-sm font-medium text-ink transition-colors hover:bg-accent-soft"
              >
                {link.label}
                <Icon name="chevronRight" size={16} className="text-ink-muted" />
              </Link>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-base font-semibold text-ink">Session</h2>
          <p className="mt-1 mb-4 text-sm text-ink-muted">
            Signing out clears your session cookie on this device.
          </p>
          <SignOutButton />
        </section>
      </div>
    </>
  );
}
