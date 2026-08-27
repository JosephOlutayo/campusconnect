import Link from "next/link";
import type { ReactNode } from "react";

import { getSessionUser } from "@/lib/auth";
import { unreadMessageCount, unreadNotificationCount } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { APP_NAME } from "@/lib/constants";
import { getPlatformFeePercent } from "@/lib/settings";
import { mobileItems, navFor } from "@/lib/nav";
import { Icon } from "@/components/ui/Icon";
import { ButtonLink } from "@/components/ui/Button";
import { AccountMenu } from "@/components/shell/AccountMenu";
import { BottomNav } from "@/components/shell/BottomNav";
import { MobileSidebar } from "@/components/shell/MobileSidebar";
import { SidebarNav, type BadgeCounts } from "@/components/shell/SidebarNav";

type Props = {
  children: ReactNode;
  area?: "app" | "provider" | "admin";
};

export async function AppShell({ children, area = "app" }: Props) {
  const user = await getSessionUser();

  const counts: BadgeCounts = { messages: 0, notifications: 0, pending: 0 };
  if (user) {
    const [messages, notifications, pending] = await Promise.all([
      unreadMessageCount(user.id),
      unreadNotificationCount(user.id),
      user.providerProfile
        ? prisma.appointment.count({
            where: { providerId: user.providerProfile.id, status: "PENDING" },
          })
        : Promise.resolve(0),
    ]);
    counts.messages = messages;
    counts.notifications = notifications;
    counts.pending = pending;
  }

  const groups = navFor(user?.role ?? null, area);
  const tabs = mobileItems(groups);

  const sidebarBody = (
    <>
      <div className="px-4 pt-5 pb-4">
        <Brand area={area} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <SidebarNav groups={groups} counts={counts} />
      </div>
      <div className="space-y-3 border-t border-line px-3 py-4">
        <PromoCard user={user} area={area} />
        {user ? (
          <AccountMenu
            user={{
              id: user.id,
              name: user.name,
              email: user.email,
              avatarSeed: user.avatarSeed,
              role: user.role,
              universityName: user.university?.shortName ?? null,
              hasProviderProfile: Boolean(user.providerProfile),
            }}
          />
        ) : (
          <div className="grid gap-2">
            <ButtonLink href="/signup" size="sm">
              Create account
            </ButtonLink>
            <ButtonLink href="/login" variant="secondary" size="sm">
              Sign in
            </ButtonLink>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-dvh lg:p-5">
      <div className="app-shell mx-auto flex w-full max-w-[1560px] flex-col overflow-hidden md:flex-row lg:min-h-[calc(100dvh-2.5rem)] lg:rounded-[2rem]">
        <aside className="hidden w-[268px] shrink-0 flex-col border-r border-line bg-surface-muted md:flex">
          {sidebarBody}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface/90 px-3 py-2.5 backdrop-blur-lg md:hidden">
            <MobileSidebar>{sidebarBody}</MobileSidebar>
            <Link href="/" className="flex items-center gap-2">
              <Logo />
              <span className="text-base font-bold tracking-tight">{APP_NAME}</span>
            </Link>
            <div className="ml-auto flex items-center gap-1">
              {user ? (
                <Link
                  href="/notifications"
                  aria-label={`Notifications${counts.notifications ? `, ${counts.notifications} unread` : ""}`}
                  className="relative rounded-xl p-2 text-ink-soft hover:bg-surface-sunken"
                >
                  <Icon name="bell" size={21} />
                  {counts.notifications > 0 ? (
                    <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-danger ring-2 ring-surface" />
                  ) : null}
                </Link>
              ) : (
                <ButtonLink href="/login" size="sm" variant="secondary">
                  Sign in
                </ButtonLink>
              )}
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 pt-5 pb-28 sm:px-6 md:px-8 md:pt-7 md:pb-10">
            {children}
          </main>
        </div>
      </div>

      <BottomNav items={tabs} counts={counts} />
    </div>
  );
}

function Logo() {
  return (
    <span
      className="grid size-8 place-items-center rounded-xl text-sm font-black text-white"
      style={{ backgroundImage: "linear-gradient(135deg,#6366f1,#4338ca)" }}
      aria-hidden
    >
      C
    </span>
  );
}

function Brand({ area }: { area: "app" | "provider" | "admin" }) {
  const subtitle =
    area === "provider" ? "Provider workspace" : area === "admin" ? "Admin console" : "Campus services";

  return (
    <Link href={area === "provider" ? "/provider" : area === "admin" ? "/admin" : "/"} className="flex items-center gap-3">
      <Logo />
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-bold tracking-tight text-ink">
          {APP_NAME}
        </span>
        <span className="block truncate text-xs text-ink-muted">{subtitle}</span>
      </span>
    </Link>
  );
}

async function PromoCard({
  user,
  area,
}: {
  user: Awaited<ReturnType<typeof getSessionUser>>;
  area: "app" | "provider" | "admin";
}) {
  if (area === "admin") return null;

  if (!user) {
    return (
      <div className="rounded-2xl bg-feature p-4 text-white">
        <p className="text-sm font-semibold">Book campus services</p>
        <p className="mt-1 text-xs text-white/70">
          Barbers, braiders, tutors and more — all verified students near you.
        </p>
      </div>
    );
  }

  if (user.providerProfile && area === "app") {
    return (
      <Link
        href="/provider"
        className="block rounded-2xl bg-feature p-4 text-white transition-transform hover:-translate-y-0.5"
      >
        <p className="text-sm font-semibold">{user.providerProfile.businessName}</p>
        <p className="mt-1 text-xs text-white/70">Open your provider dashboard →</p>
      </Link>
    );
  }

  if (!user.providerProfile) {
    const feePercent = await getPlatformFeePercent();
    return (
      <div className="rounded-2xl bg-feature p-4 text-white">
        <p className="text-sm font-semibold">Turn your skill into income</p>
        <p className="mt-1 mb-3 text-xs text-white/70">
          Set your prices, your hours, your rules. Keep {100 - feePercent}% of every booking.
        </p>
        <Link
          href="/provider/onboarding"
          className="inline-flex h-8 items-center rounded-lg bg-white px-3 text-xs font-bold text-ink transition-colors hover:bg-white/90"
        >
          Start offering services
        </Link>
      </div>
    );
  }

  return null;
}
