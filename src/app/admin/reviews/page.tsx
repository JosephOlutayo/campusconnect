import type { Metadata } from "next";

import { apiGet } from "@/lib/api";
import { formatTimeAgo } from "@/lib/time";

import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Stars } from "@/components/ui/Stars";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActionMenu } from "@/components/admin/ActionMenu";

export const metadata: Metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";

type ReviewRow = {
  id: string;
  rating: number;
  body: string;
  hidden: boolean;
  authorName: string;
  providerName: string;
  createdAt: string;
};

export default async function AdminReviewsPage() {
  const reviews = await apiGet<ReviewRow[]>("/api/admin/reviews");

  return (
    <>
      <PageHeader
        title="Reviews"
        subtitle="Hiding a review removes it from the provider's public average immediately."
      />

      {reviews.length === 0 ? (
        <EmptyState icon="⭐" title="No reviews yet" />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <article key={review.id} className="card p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars rating={review.rating} size="sm" showNumber={false} />
                    <span className="text-sm font-semibold text-ink">{review.authorName}</span>
                    <span className="text-xs text-ink-muted">on {review.providerName}</span>
                    <span className="text-xs text-ink-muted">
                      {formatTimeAgo(new Date(review.createdAt))}
                    </span>
                    {review.hidden ? <Badge tone="danger">Hidden</Badge> : null}
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">{review.body}</p>
                </div>

                <ActionMenu
                  endpoint={`/api/admin/reviews/${review.id}`}
                  actions={
                    review.hidden
                      ? [{ action: "unhide", label: "Restore review", variant: "success" }]
                      : [{ action: "hide", label: "Hide review", variant: "danger" }]
                  }
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
