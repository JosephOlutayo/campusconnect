import type { Metadata } from "next";

import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/guards";
import type { ProviderCard as Card } from "@/lib/types";

import { PageHeader } from "@/components/shell/PageHeader";
import { ProviderCard } from "@/components/providers/ProviderCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Saved providers" };
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  await requireUser();
  const cards = await apiGet<Card[]>("/api/favorites/cards");

  return (
    <>
      <PageHeader
        title="Saved providers"
        subtitle={`${cards.length} provider${cards.length === 1 ? "" : "s"} you have saved`}
      />

      {cards.length === 0 ? (
        <EmptyState
          icon="❤️"
          title="Nothing saved yet"
          description="Tap the heart on any provider to keep them here for later."
          action={<ButtonLink href="/explore">Browse providers</ButtonLink>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <ProviderCard key={card.providerId} card={card} isFavorite />
          ))}
        </div>
      )}
    </>
  );
}
