import Link from "next/link";

import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { SeedImage } from "@/components/ui/SeedImage";
import { Stars } from "@/components/ui/Stars";
import { Icon } from "@/components/ui/Icon";
import { FavoriteButton } from "@/components/providers/FavoriteButton";
import { formatCents } from "@/lib/money";
import { formatDistance } from "@/lib/geo";
import { durationLabel, formatRelativeDay, formatTime } from "@/lib/time";
import { LOCATION_MODE_SHORT } from "@/lib/constants";
import type { ProviderCard as Card } from "@/lib/search";

type Props = {
  card: Card;
  isFavorite?: boolean;
  showFavorite?: boolean;
};

export function ProviderCard({ card, isFavorite = false, showFavorite = true }: Props) {
  const cover = card.portfolioSeeds[0] ?? `${card.providerId}-cover`;

  return (
    <article className="card card-hover group relative flex flex-col overflow-hidden">
      <Link href={`/providers/${card.providerId}`} className="block">
        <div className="relative">
          <SeedImage seed={cover} className="h-40 w-full" alt={`${card.businessName} work sample`} />
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
            <Avatar seed={card.avatarSeed} name={card.businessName} size="md" ring />
            <span className="pill bg-white/95 text-ink shadow-[var(--shadow-soft)]">
              {card.headlineService.categoryIcon} {card.headlineService.categoryName}
            </span>
          </div>
        </div>
      </Link>

      {showFavorite ? (
        <div className="absolute top-3 right-3">
          <FavoriteButton providerId={card.providerId} initial={isFavorite} />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-[15px] font-bold text-ink">
            <Link href={`/providers/${card.providerId}`} className="hover:text-accent">
              {card.businessName}
            </Link>
          </h3>
          {card.isVerified ? <VerifiedBadge label="" /> : null}
        </div>

        <p className="mt-0.5 truncate text-[13px] text-ink-muted">
          {card.headlineService.title} · {durationLabel(card.headlineService.durationMinutes)}
        </p>

        <div className="mt-2.5 flex items-center gap-2">
          <Stars rating={card.ratingAvg} count={card.ratingCount} size="sm" />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">
            <Icon name="pin" size={13} /> {card.universityShortName}
          </Badge>
          {card.distanceMiles !== null ? (
            <Badge tone="neutral">{formatDistance(card.distanceMiles)}</Badge>
          ) : null}
          {card.locationModes.slice(0, 1).map((mode) => (
            <Badge key={mode} tone="neutral">
              {LOCATION_MODE_SHORT[mode]}
            </Badge>
          ))}
        </div>

        <div className="mt-auto pt-4">
          <div className="flex items-end justify-between gap-3 border-t border-line pt-3">
            <div className="min-w-0">
              <p className="text-lg leading-none font-bold text-ink">
                {card.serviceCount > 1 ? (
                  <span className="text-xs font-medium text-ink-muted">from </span>
                ) : null}
                {formatCents(card.fromPriceCents)}
              </p>
              <p className="mt-1.5 truncate text-xs font-medium">
                {card.nextAvailable ? (
                  <span className="text-success">
                    Next: {formatRelativeDay(card.nextAvailable)} {formatTime(card.nextAvailable)}
                  </span>
                ) : (
                  <span className="text-ink-muted">No openings this week</span>
                )}
              </p>
            </div>
            <Link
              href={`/providers/${card.providerId}#book`}
              className="inline-flex h-9 shrink-0 items-center rounded-xl bg-accent px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              Book now
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export function ProviderCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton h-40 w-full" />
      <div className="space-y-2.5 p-4">
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-3 w-1/3 rounded" />
        <div className="skeleton mt-4 h-9 w-full rounded-xl" />
      </div>
    </div>
  );
}
