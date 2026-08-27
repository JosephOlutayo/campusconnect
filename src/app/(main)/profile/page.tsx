import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { getUniversities } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/time";

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
  const universities = await getUniversities();

  const [completed, reviewsWritten, favorites] = await Promise.all([
    prisma.appointment.count({ where: { customerId: user.id, status: "COMPLETED" } }),
    prisma.review.count({ where: { authorId: user.id } }),
    prisma.favorite.count({ where: { userId: user.id } }),
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
              {user.studentVerifiedAt ? (
                <Badge tone="success">
                  <Icon name="check" size={13} /> Verified student
                </Badge>
              ) : (
                <Badge tone="warning">Unverified</Badge>
              )}
              {user.university ? <Badge tone="neutral">{user.university.shortName}</Badge> : null}
              {user.role === "ADMIN" ? <Badge tone="dark">Admin</Badge> : null}
            </div>

            <p className="mt-3 text-xs text-ink-muted">
              Member since {formatDate(user.createdAt, { month: "long", year: "numeric" })}
            </p>

            {!user.studentVerifiedAt ? (
              <p className="mt-4 rounded-2xl bg-warning-soft px-3 py-2.5 text-left text-xs text-warning">
                Sign up with your campus email address to get the verified-student badge. Providers
                see it on every booking you make.
              </p>
            ) : null}
          </section>

          <div className="grid gap-3">
            <StatCard label="Completed bookings" value={completed} icon="check" />
            <StatCard label="Reviews written" value={reviewsWritten} icon="star" href="/reviews" />
            <StatCard label="Saved providers" value={favorites} icon="heart" href="/favorites" />
          </div>

          {user.providerProfile ? (
            <section className="card p-5">
              <h2 className="text-base font-semibold text-ink">
                {user.providerProfile.businessName}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Your provider listing is {user.providerProfile.status.toLowerCase()}.
              </p>
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
