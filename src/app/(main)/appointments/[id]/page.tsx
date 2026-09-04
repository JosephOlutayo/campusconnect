import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { apiGetOptional } from "@/lib/api";
import { requireUser } from "@/lib/guards";
import { formatCents } from "@/lib/money";
import { LOCATION_MODE_LABELS, type Booking } from "@/lib/types";
import { durationLabel, formatFullDate, formatRelativeDay, formatTimeRange } from "@/lib/time";

import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Stars } from "@/components/ui/Stars";
import { ButtonLink } from "@/components/ui/Button";
import { AppointmentActions } from "@/components/appointments/AppointmentActions";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { ReportButton } from "@/components/providers/ReportButton";

export const metadata: Metadata = { title: "Appointment" };
export const dynamic = "force-dynamic";

export default async function AppointmentPage({
  params,
  searchParams,
}: PageProps<"/appointments/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser();

  const { data: booking } = await apiGetOptional<Booking>(`/api/bookings/${id}`);
  if (!booking) notFound();

  const isCustomer = booking.customerId === user.id;
  const isProvider = !isCustomer;

  const startAt = new Date(booking.startAt);
  const endAt = new Date(booking.endAt);
  const canReview = isCustomer && booking.status === "COMPLETED" && !booking.reviewed;

  return (
    <>
      {query.new ? (
        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-success-soft px-4 py-3.5 text-sm font-medium text-success">
          <Icon name="check" size={18} />
          {booking.status === "CONFIRMED"
            ? "You are booked. We sent the provider a notification."
            : "Request sent. You will hear back shortly."}
        </div>
      ) : null}

      <PageHeader
        eyebrow={`Booking ${booking.code}`}
        title={booking.serviceTitle}
        subtitle={`${formatFullDate(startAt)} · ${formatTimeRange(startAt, endAt)}`}
        actions={<StatusBadge status={booking.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <section className="card p-5">
            <h2 className="mb-4 text-base font-semibold text-ink">Details</h2>
            <dl className="divide-y divide-line">
              <Row icon="calendar" label="When">
                {/* formatFullDate already names the weekday, so the relative
                    prefix is only added when it says something different. */}
                <span className="font-semibold text-ink">
                  {["Today", "Tomorrow", "Yesterday"].includes(formatRelativeDay(startAt))
                    ? `${formatRelativeDay(startAt)}, ${formatFullDate(startAt)}`
                    : formatFullDate(startAt)}
                </span>
                <br />
                {formatTimeRange(startAt, endAt)} · {durationLabel(booking.durationMinutes)}
              </Row>

              <Row icon="pin" label="Where">
                <span className="font-semibold text-ink">
                  {LOCATION_MODE_LABELS[booking.locationMode] ?? booking.locationMode}
                </span>
                <br />
                {booking.exactAddress ? (
                  <>
                    {booking.exactAddress}
                    <Badge tone="success" className="ml-2">
                      Address unlocked
                    </Badge>
                  </>
                ) : (
                  <>
                    {booking.locationLabel}
                    {booking.locationMode === "AT_PROVIDER" && booking.status === "PENDING" ? (
                      <span className="mt-1 block text-xs text-ink-muted">
                        The exact address appears here once the provider confirms.
                      </span>
                    ) : null}
                  </>
                )}
              </Row>

              <Row icon="money" label="Price">
                <span className="text-lg font-bold text-ink">{formatCents(booking.priceCents)}</span>
                {isProvider ? (
                  <span className="mt-1 block text-xs text-ink-muted">
                    You receive {formatCents(booking.providerPayoutCents)} after the{" "}
                    {formatCents(booking.platformFeeCents)} platform fee.
                  </span>
                ) : null}
              </Row>

              {booking.customerNote ? (
                <Row icon="chat" label="Note from customer">
                  {booking.customerNote}
                </Row>
              ) : null}

              {booking.cancellationReason ? (
                <Row icon="ban" label="Cancellation reason">
                  {booking.cancellationReason}
                </Row>
              ) : null}
            </dl>
          </section>

          {canReview ? (
            <ReviewForm
              bookingId={booking.id}
              providerName={booking.providerName}
              defaultOpen={Boolean(query.review)}
            />
          ) : null}

          {booking.reviewed ? (
            <section className="card p-5">
              <h2 className="mb-2 text-base font-semibold text-ink">Your review</h2>
              <Stars rating={booking.reviewRating ?? 0} size="sm" showNumber={false} />
              <p className="mt-2 text-sm text-ink-muted">
                Thanks for reviewing — it shows on {booking.providerName}&apos;s profile.
              </p>
            </section>
          ) : null}

          <section className="card p-5">
            <h2 className="mb-3 text-base font-semibold text-ink">Manage</h2>
            <AppointmentActions
              bookingId={booking.id}
              serviceId={booking.serviceId}
              status={booking.status}
              role={isProvider ? "provider" : "customer"}
              cancellationPolicy={booking.cancellationPolicy}
            />
            <p className="mt-3 text-xs text-ink-muted">{booking.cancellationPolicy}</p>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-4 text-base font-semibold text-ink">
              {isProvider ? "Customer" : "Provider"}
            </h2>
            <div className="flex items-center gap-3">
              <Avatar
                seed={isProvider ? booking.customerAvatarSeed : booking.providerAvatarSeed}
                name={isProvider ? booking.customerName : booking.providerName}
                size="lg"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">
                  {isProvider ? booking.customerName : booking.providerName}
                </p>
                {!isProvider ? (
                  <Stars
                    rating={booking.providerRating}
                    count={booking.providerRatingCount}
                    size="sm"
                  />
                ) : (
                  <p className="text-xs text-ink-muted">Booked {booking.code}</p>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <ButtonLink href="/messages" variant="secondary" size="sm">
                <Icon name="chat" size={16} />
                Messages
              </ButtonLink>
              {!isProvider ? (
                <ButtonLink href={`/providers/${booking.providerId}`} variant="ghost" size="sm">
                  View profile
                </ButtonLink>
              ) : null}
            </div>

            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
              Phone numbers are never shared. Keep everything in the app so we can help if something
              goes wrong.
            </p>
          </section>

          {booking.payment ? (
            <section className="card p-5">
              <h2 className="mb-3 text-base font-semibold text-ink">Payment</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Service</dt>
                  <dd className="font-medium text-ink">
                    {formatCents(booking.payment.amountCents)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Platform fee</dt>
                  <dd className="font-medium text-ink">
                    {formatCents(booking.payment.platformFeeCents)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-line pt-2">
                  <dt className="text-ink-muted">Provider receives</dt>
                  <dd className="font-bold text-ink">
                    {formatCents(booking.payment.providerAmountCents)}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 rounded-xl bg-surface-sunken px-3 py-2 text-xs text-ink-muted">
                Status: {booking.payment.status.replace(/_/g, " ").toLowerCase()} ·{" "}
                {booking.payment.gateway === "MOCK"
                  ? "Test gateway — no real card is charged."
                  : "Stripe"}
              </p>
            </section>
          ) : null}

          <div className="px-1">
            <ReportButton
              targetType="USER"
              targetId={isProvider ? booking.customerId : booking.providerId}
              label="Report a problem with this booking"
            />
          </div>
        </aside>
      </div>

      <p className="mt-8 text-center text-sm">
        <Link href="/appointments" className="font-semibold text-accent hover:underline">
          ← All appointments
        </Link>
      </p>
    </>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <Icon name={icon} size={18} className="mt-0.5 shrink-0 text-ink-muted" />
      <div className="min-w-0">
        <dt className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{label}</dt>
        <dd className="mt-1 text-sm text-ink-soft">{children}</dd>
      </div>
    </div>
  );
}
