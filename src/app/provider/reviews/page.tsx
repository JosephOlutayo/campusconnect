import type { Metadata } from "next";

import { apiGet } from "@/lib/api";
import { requireProvider } from "@/lib/guards";
import { formatTimeAgo } from "@/lib/time";
import type { ProviderOwnProfile, Review } from "@/lib/types";

import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Stars } from "@/components/ui/Stars";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/dashboard/StatCard";
import { ReviewResponder } from "@/components/provider/ReviewResponder";

export const metadata: Metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";

export default async function ProviderReviewsPage() {
  await requireProvider();

  const [reviews, profile] = await Promise.all([
    apiGet<Review[]>("/api/provider/reviews"),
    apiGet<ProviderOwnProfile>("/api/provider/profile"),
  ]);

  const awaitingReply = reviews.filter((review) => !review.providerResponse).length;

  return (
    <>
      <PageHeader
        title="Reviews"
        subtitle="Replying publicly is the best way to answer a bad review — future customers read both."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Rating"
          value={profile.ratingAvg > 0 ? profile.ratingAvg.toFixed(1) : "—"}
          icon="star"
        />
        <StatCard label="Total reviews" value={profile.ratingCount} icon="chat" />
        <StatCard
          label="Awaiting reply"
          value={awaitingReply}
          icon="bell"
          hint={awaitingReply > 0 ? "A reply takes a minute" : "All caught up"}
        />
      </div>

      {reviews.length === 0 ? (
        <EmptyState
          icon="⭐"
          title="No reviews yet"
          description="Students can review you once an appointment is marked completed."
        />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <article key={review.id} className="card p-4">
              <div className="flex items-start gap-3">
                <Avatar seed={review.authorAvatarSeed} name={review.authorName} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{review.authorName}</p>
                    {review.authorStudentVerified ? (
                      <Badge tone="success">Verified student</Badge>
                    ) : null}
                    <span className="text-xs text-ink-muted">
                      {review.serviceTitle} · {formatTimeAgo(new Date(review.createdAt))}
                    </span>
                  </div>

                  <Stars rating={review.rating} size="sm" showNumber={false} className="mt-1" />
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{review.body}</p>

                  {review.providerResponse ? (
                    <div className="mt-3 rounded-2xl bg-surface-sunken p-3">
                      <p className="text-xs font-bold text-ink">You replied</p>
                      <p className="mt-1 text-sm text-ink-soft">{review.providerResponse}</p>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <ReviewResponder reviewId={review.id} />
                    </div>
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
