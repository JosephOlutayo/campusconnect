import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { formatTimeAgo } from "@/lib/time";

import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Stars } from "@/components/ui/Stars";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActionMenu } from "@/components/admin/ActionMenu";

export const metadata: Metadata = { title: "Review moderation" };
export const dynamic = "force-dynamic";

export default async function AdminReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  const query = await searchParams;
  const filter = typeof query.filter === "string" ? query.filter : "low";

  const where =
    filter === "hidden"
      ? { isHidden: true }
      : filter === "low"
        ? { rating: { lte: 3 }, isHidden: false }
        : {};

  const reviews = await prisma.review.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      author: { select: { name: true, avatarSeed: true } },
      provider: { select: { id: true, businessName: true } },
      appointment: { select: { code: true, service: { select: { title: true } } } },
    },
  });

  const filters = [
    { value: "low", label: "Low ratings" },
    { value: "hidden", label: "Hidden" },
    { value: "all", label: "All" },
  ];

  return (
    <>
      <PageHeader
        title="Review moderation"
        subtitle="Hiding a review recalculates the provider's public average immediately."
      />

      <nav className="rail mb-5 -mx-1 flex gap-2 px-1">
        {filters.map((option) => (
          <Link
            key={option.value}
            href={`/admin/reviews?filter=${option.value}`}
            aria-current={filter === option.value ? "page" : undefined}
            className={`pill shrink-0 border transition-colors ${
              filter === option.value
                ? "border-accent bg-accent text-white"
                : "border-line-strong bg-surface text-ink-soft hover:border-accent hover:text-accent"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      {reviews.length === 0 ? (
        <EmptyState icon="⭐" title="Nothing to moderate here" />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <article key={review.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Avatar seed={review.author.avatarSeed} name={review.author.name} size="xs" />
                    <span className="text-sm font-semibold text-ink">{review.author.name}</span>
                    <span className="text-xs text-ink-muted">on</span>
                    <Link
                      href={`/providers/${review.provider.id}`}
                      className="text-sm font-semibold text-accent hover:underline"
                    >
                      {review.provider.businessName}
                    </Link>
                    {review.isHidden ? <Badge tone="danger">Hidden</Badge> : null}
                    <span className="text-xs text-ink-muted">
                      {formatTimeAgo(review.createdAt)}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center gap-2">
                    <Stars rating={review.rating} size="sm" showNumber={false} />
                    <span className="font-mono text-xs text-ink-faint">
                      {review.appointment.code} · {review.appointment.service.title}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-ink-soft">{review.body}</p>

                  {review.providerResponse ? (
                    <p className="mt-2 rounded-xl bg-surface-sunken px-3 py-2 text-xs text-ink-soft">
                      <strong>Provider reply:</strong> {review.providerResponse}
                    </p>
                  ) : null}
                </div>

                <ActionMenu
                  endpoint={`/api/admin/reviews/${review.id}`}
                  actions={
                    review.isHidden
                      ? [{ action: "unhide", label: "Unhide", variant: "success" }]
                      : [
                          {
                            action: "hide",
                            label: "Hide review",
                            variant: "danger",
                            confirm: "Hide this review? It stops counting toward the rating.",
                          },
                        ]
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
