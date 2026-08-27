import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { pendingReviews } from "@/lib/reviews";
import { formatTimeAgo } from "@/lib/time";

import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Stars } from "@/components/ui/Stars";
import { SectionHeading, EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Your reviews" };
export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const user = await requireUser();

  const [written, awaiting] = await Promise.all([
    prisma.review.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        provider: {
          select: { id: true, businessName: true, user: { select: { avatarSeed: true } } },
        },
        appointment: { select: { service: { select: { title: true } } } },
      },
    }),
    pendingReviews(user.id),
  ]);

  return (
    <>
      <PageHeader
        title="Your reviews"
        subtitle="You can only review providers you actually booked and completed."
      />

      {awaiting.length > 0 ? (
        <section className="mb-8">
          <SectionHeading title="Waiting on you" subtitle={`${awaiting.length} to write`} />
          <div className="grid gap-3 sm:grid-cols-2">
            {awaiting.map((appointment) => (
              <div key={appointment.id} className="card flex items-center gap-3 p-4">
                <Avatar
                  seed={appointment.provider.user.avatarSeed}
                  name={appointment.provider.businessName}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {appointment.provider.businessName}
                  </p>
                  <p className="truncate text-xs text-ink-muted">{appointment.service.title}</p>
                </div>
                <ButtonLink href={`/appointments/${appointment.id}?review=1`} size="sm">
                  Write
                </ButtonLink>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeading title="Published" subtitle={`${written.length} review${written.length === 1 ? "" : "s"}`} />
        {written.length === 0 ? (
          <EmptyState
            icon="⭐"
            title="No reviews yet"
            description="Once you complete an appointment you can leave a rating and a few words."
            action={<ButtonLink href="/explore">Book a service</ButtonLink>}
          />
        ) : (
          <div className="space-y-3">
            {written.map((review) => (
              <article key={review.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <Avatar
                    seed={review.provider.user.avatarSeed}
                    name={review.provider.businessName}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/providers/${review.provider.id}`}
                        className="text-sm font-semibold text-ink hover:text-accent"
                      >
                        {review.provider.businessName}
                      </Link>
                      <span className="text-xs text-ink-muted">
                        {review.appointment.service.title} · {formatTimeAgo(review.createdAt)}
                      </span>
                      {review.isHidden ? (
                        <span className="pill bg-danger-soft text-danger">Hidden by moderation</span>
                      ) : null}
                    </div>
                    <Stars rating={review.rating} size="sm" showNumber={false} className="mt-1" />
                    <p className="mt-2 text-sm text-ink-soft">{review.body}</p>
                    {review.providerResponse ? (
                      <div className="mt-3 rounded-2xl bg-surface-sunken p-3">
                        <p className="text-xs font-bold text-ink">
                          {review.provider.businessName} replied
                        </p>
                        <p className="mt-1 text-sm text-ink-soft">{review.providerResponse}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
