import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getFavoriteIds } from "@/lib/queries";
import { parseLocationModes, LOCATION_MODE_LABELS } from "@/lib/constants";
import { serviceLocationModes } from "@/lib/booking";
import { formatCents } from "@/lib/money";
import { distanceMiles, formatDistance } from "@/lib/geo";
import {
  durationLabel,
  formatMinutes,
  formatTimeAgo,
  WEEKDAY_NAMES,
} from "@/lib/time";
import { getNextAvailable } from "@/lib/availability";

import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { Stars } from "@/components/ui/Stars";
import { Icon } from "@/components/ui/Icon";
import { SeedImage } from "@/components/ui/SeedImage";
import { SectionHeading } from "@/components/ui/EmptyState";
import { FavoriteButton } from "@/components/providers/FavoriteButton";
import { MessageProviderButton } from "@/components/providers/MessageProviderButton";
import { PortfolioGallery } from "@/components/providers/PortfolioGallery";
import { ReportButton } from "@/components/providers/ReportButton";
import { BookingWidget, type BookableService } from "@/components/booking/BookingWidget";

export const dynamic = "force-dynamic";

async function loadProvider(id: string) {
  return prisma.providerProfile.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, avatarSeed: true, studentVerifiedAt: true, createdAt: true } },
      university: true,
      services: {
        where: { isActive: true },
        include: { category: { select: { name: true, icon: true, slug: true } } },
        orderBy: { priceCents: "asc" },
      },
      portfolio: { orderBy: { sortOrder: "asc" } },
      availability: { orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] },
      promotions: {
        where: { isActive: true, startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
      },
      reviews: {
        where: { isHidden: false },
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          author: { select: { name: true, avatarSeed: true, studentVerifiedAt: true } },
          images: true,
          appointment: { select: { service: { select: { title: true } } } },
        },
      },
      _count: { select: { reviews: { where: { isHidden: false } } } },
    },
  });
}

export async function generateMetadata({
  params,
}: PageProps<"/providers/[id]">): Promise<Metadata> {
  const { id } = await params;
  const provider = await prisma.providerProfile.findUnique({
    where: { id },
    select: { businessName: true, tagline: true },
  });
  if (!provider) return { title: "Provider not found" };
  return { title: provider.businessName, description: provider.tagline ?? undefined };
}

export default async function ProviderPage({ params, searchParams }: PageProps<"/providers/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const provider = await loadProvider(id);
  if (!provider) notFound();

  const user = await getSessionUser();
  const favoriteIds = await getFavoriteIds(user?.id);
  const isOwner = user?.id === provider.userId;

  // A paused or unapproved listing is only visible to its owner and admins.
  const publiclyVisible = provider.status === "ACTIVE";
  if (!publiclyVisible && !isOwner && user?.role !== "ADMIN") notFound();

  const cheapest = provider.services[0];
  const nextAvailable = cheapest
    ? await getNextAvailable(provider.id, cheapest.durationMinutes)
    : null;

  const bookableServices: BookableService[] = provider.services.map((service) => ({
    id: service.id,
    title: service.title,
    description: service.description,
    priceCents: service.priceCents,
    durationMinutes: service.durationMinutes,
    categoryName: service.category.name,
    categoryIcon: service.category.icon,
    locationModes: serviceLocationModes(service.locationModes, provider.locationModes),
  }));

  const requestedService =
    typeof query.service === "string" &&
    bookableServices.some((service) => service.id === query.service)
      ? query.service
      : undefined;

  const miles = distanceMiles(
    { latitude: provider.university.latitude, longitude: provider.university.longitude },
    { latitude: provider.latitude, longitude: provider.longitude },
  );

  const hoursByDay = new Map<number, Array<{ startMinute: number; endMinute: number }>>();
  for (const rule of provider.availability) {
    const list = hoursByDay.get(rule.weekday) ?? [];
    list.push(rule);
    hoursByDay.set(rule.weekday, list);
  }

  // Counted across every visible review, not just the twelve rendered below —
  // otherwise the bars silently disagree with the total beside them.
  const distribution = await prisma.review.groupBy({
    by: ["rating"],
    where: { providerId: provider.id, isHidden: false },
    _count: { _all: true },
  });
  const ratingBreakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: distribution.find((row) => row.rating === star)?._count._all ?? 0,
  }));

  return (
    <>
      {!publiclyVisible ? (
        <div className="mb-5 rounded-2xl bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
          This listing is {provider.status.toLowerCase()} — only you and admins can see it.
        </div>
      ) : null}

      {/* Cover strip built from the portfolio. */}
      <div className="relative mb-16 overflow-hidden rounded-[var(--radius-card)] sm:mb-14">
        <div className="grid h-40 grid-cols-3 gap-1 sm:h-52">
          {(provider.portfolio.length > 0
            ? provider.portfolio.slice(0, 3)
            : [{ id: "a", seed: `${provider.id}-1`, url: null }, { id: "b", seed: `${provider.id}-2`, url: null }, { id: "c", seed: `${provider.id}-3`, url: null }]
          ).map((image) => (
            <SeedImage
              key={image.id}
              seed={image.seed}
              url={"url" in image ? image.url : null}
              alt=""
              className="h-full w-full"
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        <div className="absolute top-3 right-3">
          <FavoriteButton
            providerId={provider.id}
            initial={favoriteIds.has(provider.id)}
            withLabel
          />
        </div>
        <div className="absolute -bottom-12 left-5 sm:-bottom-10">
          <Avatar
            seed={provider.user.avatarSeed}
            name={provider.businessName}
            size="2xl"
            ring
            className="shadow-[var(--shadow-lift)]"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-8">
          {/* Identity */}
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-ink sm:text-[2rem]">
                {provider.businessName}
              </h1>
              {provider.isVerified ? <VerifiedBadge /> : null}
              {provider.user.studentVerifiedAt ? (
                <Badge tone="success">
                  <Icon name="check" size={13} /> Verified student
                </Badge>
              ) : null}
            </div>

            {provider.tagline ? (
              <p className="mt-1.5 text-[15px] text-ink-soft">{provider.tagline}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <Stars rating={provider.ratingAvg} count={provider._count.reviews} size="md" />
              <span className="inline-flex items-center gap-1.5 text-ink-muted">
                <Icon name="pin" size={15} />
                {provider.locationLabel}
              </span>
              <Link
                href={`/campuses/${provider.university.slug}`}
                className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline"
              >
                {provider.university.shortName}
              </Link>
              <span className="text-ink-muted">{formatDistance(miles)} from campus</span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {parseLocationModes(provider.locationModes).map((mode) => (
                <Badge key={mode} tone="neutral">
                  {LOCATION_MODE_LABELS[mode]}
                </Badge>
              ))}
              <Badge tone="neutral">
                <Icon name="check" size={13} /> {provider.completedBookings} completed
              </Badge>
              {provider.autoConfirmBookings ? (
                <Badge tone="success">Instant booking</Badge>
              ) : (
                <Badge tone="warning">Requests reviewed first</Badge>
              )}
            </div>

            {!isOwner ? (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <MessageProviderButton
                  providerId={provider.id}
                  providerName={provider.businessName}
                  isSignedIn={Boolean(user)}
                />
                <Link
                  href="#book"
                  className="inline-flex h-11 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover lg:hidden"
                >
                  Book now
                </Link>
              </div>
            ) : (
              <div className="mt-5">
                <Link
                  href="/provider/settings"
                  className="inline-flex h-11 items-center rounded-xl border border-line-strong px-5 text-sm font-semibold text-ink transition-colors hover:bg-surface-muted"
                >
                  Edit your profile
                </Link>
              </div>
            )}
          </header>

          {provider.promotions.length > 0 ? (
            <section className="rounded-2xl border border-accent bg-accent-soft p-4">
              <p className="text-sm font-bold text-accent">Active offer</p>
              {provider.promotions.map((promotion) => (
                <p key={promotion.id} className="mt-1 text-sm text-ink">
                  <span className="font-mono font-bold">{promotion.code}</span> — {promotion.description}
                </p>
              ))}
            </section>
          ) : null}

          <section>
            <SectionHeading title="About" />
            <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink-soft">
              {provider.bio}
            </p>
          </section>

          <section>
            <SectionHeading
              title="Services"
              subtitle={`${provider.services.length} bookable service${provider.services.length === 1 ? "" : "s"}`}
            />
            <div className="space-y-3">
              {provider.services.map((service) => (
                <article key={service.id} className="card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{service.category.icon}</span>
                        <h3 className="text-[15px] font-bold text-ink">{service.title}</h3>
                      </div>
                      <p className="mt-1.5 text-sm text-ink-soft">{service.description}</p>
                      <p className="mt-2 text-xs text-ink-muted">
                        {durationLabel(service.durationMinutes)} · {service.category.name}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold text-ink">{formatCents(service.priceCents)}</p>
                      <Link
                        href={`/providers/${provider.id}?service=${service.id}#book`}
                        className="mt-2 inline-flex h-10 items-center rounded-lg bg-surface-sunken px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-accent hover:text-white"
                      >
                        Book
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section>
            <SectionHeading title="Portfolio" subtitle="Recent work" />
            <PortfolioGallery images={provider.portfolio} name={provider.businessName} />
          </section>

          <section>
            <SectionHeading
              title="Reviews"
              subtitle={`${provider._count.reviews} review${provider._count.reviews === 1 ? "" : "s"} from completed appointments`}
            />

            {provider._count.reviews === 0 ? (
              <p className="rounded-2xl bg-surface-sunken px-4 py-6 text-center text-sm text-ink-muted">
                No reviews yet. Reviews can only be left by students who completed an appointment.
              </p>
            ) : (
              <>
                <div className="card mb-4 flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
                  <div className="text-center sm:w-32">
                    <p className="text-[2.75rem] leading-none font-bold text-ink">
                      {provider.ratingAvg.toFixed(1)}
                    </p>
                    <Stars
                      rating={provider.ratingAvg}
                      size="sm"
                      showNumber={false}
                      className="mt-2 justify-center"
                    />
                    <p className="mt-1 text-xs text-ink-muted">{provider._count.reviews} reviews</p>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {ratingBreakdown.map((row) => {
                      const total = provider._count.reviews || 1;
                      return (
                        <div key={row.star} className="flex items-center gap-2.5">
                          <span className="w-3 text-xs font-semibold text-ink-muted">{row.star}</span>
                          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                            <span
                              className="block h-full rounded-full bg-[#F5A524]"
                              style={{ width: `${(row.count / total) * 100}%` }}
                            />
                          </span>
                          <span className="w-6 text-right text-xs text-ink-muted">{row.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  {provider.reviews.map((review) => (
                    <article key={review.id} className="card p-4">
                      <div className="flex items-start gap-3">
                        <Avatar
                          seed={review.author.avatarSeed}
                          name={review.author.name}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-ink">{review.author.name}</p>
                            {review.author.studentVerifiedAt ? (
                              <Badge tone="success">Verified student</Badge>
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
                              <p className="text-xs font-bold text-ink">
                                {provider.businessName} replied
                              </p>
                              <p className="mt-1 text-sm text-ink-soft">{review.providerResponse}</p>
                            </div>
                          ) : null}

                          <div className="mt-2">
                            <ReportButton targetType="REVIEW" targetId={review.id} label="Report review" />
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        {/* Booking rail. Sticky on desktop, inline below the fold on phones. */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {nextAvailable ? (
            <p className="rounded-2xl bg-success-soft px-4 py-2.5 text-sm font-semibold text-success">
              Next available: {nextAvailable.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}{" "}
              at {nextAvailable.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </p>
          ) : null}

          {isOwner ? (
            <div className="card p-5 text-sm text-ink-muted">
              This is how students see your listing. You cannot book yourself.
            </div>
          ) : (
            <BookingWidget
              providerName={provider.businessName}
              services={bookableServices}
              autoConfirm={provider.autoConfirmBookings}
              cancellationPolicy={provider.cancellationPolicy}
              locationLabel={provider.locationLabel}
              minNoticeMinutes={provider.minNoticeMinutes}
              isSignedIn={Boolean(user)}
              initialServiceId={requestedService}
            />
          )}

          <section className="card p-5">
            <h2 className="mb-3 text-base font-semibold text-ink">Business hours</h2>
            <dl className="space-y-1.5 text-sm">
              {WEEKDAY_NAMES.map((day, index) => {
                const windows = hoursByDay.get(index) ?? [];
                return (
                  <div key={day} className="flex items-center justify-between gap-3">
                    <dt className="text-ink-muted">{day}</dt>
                    <dd className={windows.length > 0 ? "font-medium text-ink" : "text-ink-faint"}>
                      {windows.length === 0
                        ? "Closed"
                        : windows
                            .map(
                              (window) =>
                                `${formatMinutes(window.startMinute)} – ${formatMinutes(window.endMinute)}`,
                            )
                            .join(", ")}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="mb-2 text-base font-semibold text-ink">Good to know</h2>
            <ul className="space-y-2 text-sm text-ink-soft">
              <li className="flex gap-2">
                <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-ink-muted" />
                {provider.cancellationPolicy}
              </li>
              <li className="flex gap-2">
                <Icon name="pin" size={16} className="mt-0.5 shrink-0 text-ink-muted" />
                Exact address is shared only after a booking is confirmed.
              </li>
              <li className="flex gap-2">
                <Icon name="clock" size={16} className="mt-0.5 shrink-0 text-ink-muted" />
                Book at least{" "}
                {provider.minNoticeMinutes >= 60
                  ? `${Math.round(provider.minNoticeMinutes / 60)} hours`
                  : `${provider.minNoticeMinutes} minutes`}{" "}
                ahead, up to {provider.maxAdvanceDays} days out.
              </li>
            </ul>
            <div className="mt-4 border-t border-line pt-3">
              <ReportButton targetType="PROVIDER" targetId={provider.id} label="Report this provider" />
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
