import type { Metadata } from "next";

import { requireProvider } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatTimeAgo } from "@/lib/time";

import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Stars } from "@/components/ui/Stars";
import { Badge } from "@/components/ui/Badge";
import { SeedImage } from "@/components/ui/SeedImage";
import { StatCard } from "@/components/dashboard/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReviewResponder } from "@/components/provider/ReviewResponder";

export const metadata: Metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";

export default async function ProviderReviewsPage() {
  const { providerId } = await requireProvider();

  const [reviews, profile] = await Promise.all([
    prisma.review.findMany({
      where: { providerId },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { name: true, avatarSeed: true, studentVerifiedAt: true } },
        images: true,
        appointment: { select: { service: { select: { title: true } } } },
      },
    }),
    prisma.providerProfile.findUniqueOrThrow({
      where: { id: providerId },
      select: { ratingAvg: true, ratingCount: true },
    }),
  ]);

  const visible = reviews.filter((review) => !review.isHidden);
  const awaitingReply = visible.filter((review) => !review.providerResponse).length;
  const breakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: visible.filter((review) => review.rating === star).length,
  }));

  return (
    <>
      <PageHeader
        title="Reviews"
        subtitle="Only students who completed an appointment with you can leave one."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Rating"
          value={profile.ratingAvg > 0 ? profile.ratingAvg.toFixed(1) : "—"}
          icon="star"
          hint={`${profile.ratingCount} review${profile.ratingCount === 1 ? "" : "s"}`}
        />
        <StatCard label="Awaiting your reply" value={awaitingReply} icon="chat" />
        <StatCard
          label="5-star reviews"
          value={breakdown[0].count}
          icon="check"
          hint={
            visible.length > 0
              ? `${Math.round((breakdown[0].count / visible.length) * 100)}% of all reviews`
              : undefined
          }
        />
      </div>

      {visible.length > 0 ? (
        <section className="card mb-6 p-5">
          <h2 className="mb-3 text-base font-semibold text-ink">Breakdown</h2>
          <div className="space-y-1.5">
            {breakdown.map((row) => (
              <div key={row.star} className="flex items-center gap-2.5">
                <span className="w-3 text-xs font-semibold text-ink-muted">{row.star}</span>
                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                  <span
                    className="block h-full rounded-full bg-[#F5A524]"
                    style={{ width: `${(row.count / visible.length) * 100}%` }}
                  />
                </span>
                <span className="w-6 text-right text-xs text-ink-muted">{row.count}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {reviews.length === 0 ? (
        <EmptyState
          icon="⭐"
          title="No reviews yet"
          description="Complete a few appointments and reviews will start landing here."
        />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <article key={review.id} className="card p-4">
              <div className="flex items-start gap-3">
                <Avatar seed={review.author.avatarSeed} name={review.author.name} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{review.author.name}</p>
                    {review.author.studentVerifiedAt ? (
                      <Badge tone="success">Verified student</Badge>
                    ) : null}
                    {review.isHidden ? (
                      <Badge tone="danger">Hidden by moderation</Badge>
                    ) : null}
                    <span className="text-xs text-ink-muted">
                      {formatTimeAgo(review.createdAt)}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center gap-2">
                    <Stars rating={review.rating} size="sm" showNumber={false} />
                    <span className="text-xs text-ink-muted">
                      {review.appointment.service.title}
                    </span>
                  </div>

                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{review.body}</p>

                  {review.images.length > 0 ? (
                    <div className="mt-3 flex gap-2">
                      {review.images.map((image) => (
                        <SeedImage
                          key={image.id}
                          seed={image.seed}
                          url={image.url}
                          alt="Review photo"
                          className="size-16 rounded-xl"
                        />
                      ))}
                    </div>
                  ) : null}

                  {review.providerResponse ? (
                    <div className="mt-3 rounded-2xl bg-surface-sunken p-3">
                      <p className="text-xs font-bold text-ink">Your reply</p>
                      <p className="mt-1 text-sm text-ink-soft">{review.providerResponse}</p>
                    </div>
                  ) : (
                    <ReviewResponder reviewId={review.id} />
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
