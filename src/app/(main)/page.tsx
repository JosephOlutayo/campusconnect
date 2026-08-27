import Link from "next/link";

import { getSessionUser } from "@/lib/auth";
import { searchProviders } from "@/lib/search";
import {
  getCampusActivity,
  getCampusStats,
  getCategories,
  getFavoriteIds,
  getUpcomingAppointments,
} from "@/lib/queries";
import { APP_NAME } from "@/lib/constants";

import { PageHeader, greeting } from "@/components/shell/PageHeader";
import { SearchBar } from "@/components/search/SearchBar";
import { CategoryRail } from "@/components/categories/CategoryRail";
import { FeatureChart } from "@/components/dashboard/FeatureChart";
import { StatCard } from "@/components/dashboard/StatCard";
import { ProviderCard } from "@/components/providers/ProviderCard";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { SectionHeading, EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Stars } from "@/components/ui/Stars";
import { Icon } from "@/components/ui/Icon";
import { formatCents } from "@/lib/money";

// Availability changes minute to minute, so the home page is always fresh.
export const dynamic = "force-dynamic";

const QUICK_SEARCHES = [
  { label: "Find a barber", query: "barber" },
  { label: "Find a braider", query: "braids" },
  { label: "Find a tutor", query: "tutor" },
  { label: "Find a photographer", query: "photography" },
  { label: "Find a nail tech", query: "nails" },
];

export default async function HomePage() {
  const user = await getSessionUser();
  const universityId = user?.universityId ?? null;

  const [categories, activity, stats, favoriteIds, recommended, topRated, newest] =
    await Promise.all([
      getCategories(),
      getCampusActivity(universityId),
      getCampusStats(universityId),
      getFavoriteIds(user?.id),
      searchProviders({
        universityId: universityId ?? undefined,
        sort: "recommended",
        perPage: 6,
      }),
      searchProviders({ universityId: universityId ?? undefined, sort: "rating", perPage: 4 }),
      searchProviders({ universityId: universityId ?? undefined, sort: "newest", perPage: 3 }),
    ]);

  const upcoming = user ? await getUpcomingAppointments(user.id, 3) : [];
  const campusName = user?.university?.shortName ?? "your campus";

  // Do not repeat a provider that already appeared in the recommended grid.
  const shown = new Set(recommended.cards.map((card) => card.providerId));
  const newArrivals = newest.cards.filter((card) => !shown.has(card.providerId));

  const bars = activity.ranked.slice(0, 4).map((entry, index) => ({
    label: entry.name.split(" ")[0],
    value: entry.count,
    highlight: index === 0,
  }));

  return (
    <>
      <PageHeader
        showDate
        title={user ? `${greeting()}, ${user.name.split(" ")[0]}` : "Find someone on campus who can do it"}
        subtitle={
          user
            ? undefined
            : `Barbers, braiders, tutors, photographers and more — booked from students and pros around ${campusName}.`
        }
        actions={
          <>
            <SearchBar className="hidden w-72 lg:block" />
            <ButtonLink href="/explore" size="md">
              <Icon name="search" size={16} />
              Explore services
            </ButtonLink>
          </>
        }
      />

      {/* Hero search — the single most important control on the page. */}
      <section className="mb-6">
        <SearchBar size="lg" autoFocus={false} />
        <div className="rail mt-3 -mx-1 flex gap-2 px-1">
          {QUICK_SEARCHES.map((item) => (
            <Link
              key={item.query}
              href={`/explore?q=${item.query}`}
              className="pill shrink-0 border border-line bg-surface text-ink-soft transition-colors hover:border-accent hover:text-accent"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-8">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <FeatureChart
              caption={`Booked on ${campusName} this month`}
              headline={String(activity.total)}
              delta={
                stats.newThisWeek > 0
                  ? { value: `${stats.newThisWeek} new providers`, positive: true }
                  : undefined
              }
              bars={
                bars.length > 0
                  ? bars
                  : [{ label: "Quiet", value: 1, highlight: true }]
              }
              footer={
                activity.ranked[0]
                  ? `${activity.ranked[0].icon} ${activity.ranked[0].name} is leading right now`
                  : "Be the first booking this month"
              }
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <StatCard
                label="Providers near you"
                value={stats.providerCount}
                icon="users"
                hint={`${stats.serviceCount} services listed on ${campusName}`}
                href="/explore"
              />
              <StatCard
                label="Average rating"
                value={stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "—"}
                icon="star"
                hint="Across every reviewed provider"
              />
            </div>
          </div>

          <section>
            <SectionHeading
              title="Browse by category"
              subtitle="Sixteen kinds of work, all within walking distance"
              action={
                <Link href="/categories" className="text-sm font-semibold text-accent hover:underline">
                  See all
                </Link>
              }
            />
            <CategoryRail categories={categories.slice(0, 10)} />
          </section>

          <section>
            <SectionHeading
              title={user ? "Recommended for you" : "Popular on campus"}
              subtitle="Ranked by rating, reviews and how often they get booked"
              action={
                <Link href="/explore" className="text-sm font-semibold text-accent hover:underline">
                  See all
                </Link>
              }
            />
            {recommended.cards.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="No providers here yet"
                description="Nobody is offering services on this campus yet. Be the first."
                action={<ButtonLink href="/provider/onboarding">Offer a service</ButtonLink>}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recommended.cards.map((card) => (
                  <ProviderCard
                    key={card.providerId}
                    card={card}
                    isFavorite={favoriteIds.has(card.providerId)}
                  />
                ))}
              </div>
            )}
          </section>

          {newArrivals.length > 0 ? (
            <section>
              <SectionHeading
                title="New on campus"
                subtitle="Just started taking bookings"
              />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {newArrivals.map((card) => (
                  <ProviderCard
                    key={card.providerId}
                    card={card}
                    isFavorite={favoriteIds.has(card.providerId)}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {/* Right rail: what is happening for this specific person. */}
        <aside className="space-y-5">
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">Your schedule</h2>
              {user ? (
                <Link href="/appointments" className="text-xs font-semibold text-accent hover:underline">
                  All
                </Link>
              ) : null}
            </div>

            {!user ? (
              <div className="text-center">
                <p className="text-sm text-ink-muted">
                  Sign in to see your upcoming appointments.
                </p>
                <ButtonLink href="/login" size="sm" className="mt-3 w-full">
                  Sign in
                </ButtonLink>
              </div>
            ) : upcoming.length === 0 ? (
              <EmptyState
                compact
                icon="📅"
                title="Nothing booked yet"
                description="Find someone nearby and grab a slot."
                action={
                  <ButtonLink href="/explore" size="sm">
                    Browse providers
                  </ButtonLink>
                }
              />
            ) : (
              <div className="space-y-3">
                {upcoming.map((appointment) => (
                  <AppointmentCard key={appointment.id} appointment={appointment} compact />
                ))}
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-4 text-base font-semibold text-ink">Top rated</h2>
            <ul className="space-y-1">
              {topRated.cards.map((card, index) => (
                <li key={card.providerId}>
                  <Link
                    href={`/providers/${card.providerId}`}
                    className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-surface-muted"
                  >
                    <span className="w-4 text-center text-xs font-bold text-ink-faint">
                      {index + 1}
                    </span>
                    <Avatar seed={card.avatarSeed} name={card.businessName} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {card.businessName}
                      </span>
                      <Stars rating={card.ratingAvg} size="sm" count={card.ratingCount} />
                    </span>
                    <span className="shrink-0 text-sm font-bold text-ink">
                      {formatCents(card.fromPriceCents)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="card overflow-hidden">
            <div className="bg-feature p-5 text-white">
              <p className="text-sm font-semibold">How {APP_NAME} keeps things safe</p>
              <ul className="mt-3 space-y-2 text-xs text-white/70">
                <li className="flex gap-2">
                  <Icon name="check" size={14} className="mt-0.5 shrink-0 text-success" />
                  Student status verified through campus email
                </li>
                <li className="flex gap-2">
                  <Icon name="check" size={14} className="mt-0.5 shrink-0 text-success" />
                  Reviews only from people who completed a booking
                </li>
                <li className="flex gap-2">
                  <Icon name="check" size={14} className="mt-0.5 shrink-0 text-success" />
                  Addresses stay hidden until a booking is confirmed
                </li>
              </ul>
              <Link
                href="/legal/guidelines"
                className="mt-4 inline-flex text-xs font-semibold text-white underline underline-offset-2"
              >
                Community guidelines
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
