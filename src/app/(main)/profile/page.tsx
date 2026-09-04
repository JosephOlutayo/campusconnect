import type { Metadata } from "next";
import Link from "next/link";

import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/guards";
import type { MeSummary, University } from "@/lib/types";

import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { StatCard } from "@/components/dashboard/StatCard";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Your profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();

  const [universities, summary] = await Promise.all([
    apiGet<University[]>("/api/universities"),
    apiGet<MeSummary>("/api/stats/me"),
  ]);

  return (
    <>
      <PageHeader title="Your profile" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <ProfileForm
            user={{
              name: user.name,
              bio: user.bio,
              phone: user.phone,
              universityId: user.universityId,
            }}
            universities={universities.map((university) => ({
              id: university.id,
              name: university.name,
            }))}
          />
        </div>

        <aside className="space-y-5">
          <section className="card p-5 text-center">
            <Avatar seed={user.avatarSeed} name={user.name} size="2xl" className="mx-auto" />
            <h2 className="mt-3 text-lg font-bold text-ink">{user.name}</h2>
            <p className="text-sm text-ink-muted">{user.email}</p>

            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {user.studentVerified ? (
                <Badge tone="success">
                  <Icon name="check" size={13} /> Verified student
                </Badge>
              ) : (
                <Badge tone="warning">Unverified</Badge>
              )}
              {user.universityShortName ? (
                <Badge tone="neutral">{user.universityShortName}</Badge>
              ) : null}
              {user.role === "ADMIN" ? <Badge tone="dark">Admin</Badge> : null}
            </div>

            {!user.studentVerified ? (
              <p className="mt-4 rounded-2xl bg-warning-soft px-3 py-2.5 text-left text-xs text-warning">
                Sign up with your campus email address to get the verified-student badge. Providers
                see it on every booking you make.
              </p>
            ) : null}
          </section>

          <div className="grid gap-3">
            <StatCard label="Completed bookings" value={summary.completedBookings} icon="check" />
            <StatCard
              label="Reviews written"
              value={summary.reviewsWritten}
              icon="star"
              href="/reviews"
            />
            <StatCard
              label="Saved providers"
              value={summary.savedProviders}
              icon="heart"
              href="/favorites"
            />
          </div>

          {user.providerProfileId ? (
            <section className="card p-5">
              <h2 className="text-base font-semibold text-ink">{user.providerBusinessName}</h2>
              <p className="mt-1 text-sm text-ink-muted">Your provider listing.</p>
              <ButtonLink href="/provider" size="sm" className="mt-3 w-full">
                Provider dashboard
              </ButtonLink>
            </section>
          ) : (
            <section className="card bg-feature p-5 text-white">
              <h2 className="text-base font-semibold">Offer a service</h2>
              <p className="mt-1 text-sm text-white/70">
                Set your own prices and hours. Takes about two minutes to set up.
              </p>
              <Link
                href="/provider/onboarding"
                className="mt-3 inline-flex h-9 items-center rounded-lg bg-white px-4 text-sm font-bold text-ink"
              >
                Get started
              </Link>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
