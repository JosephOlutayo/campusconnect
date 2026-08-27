import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { LOCATION_MODE_LABELS, type LocationMode } from "@/lib/constants";
import { durationLabel, formatFullDate, formatTimeRange, formatRelativeDay } from "@/lib/time";

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

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      service: { select: { id: true, title: true, description: true, durationMinutes: true } },
      customer: { select: { id: true, name: true, avatarSeed: true, phone: true } },
      provider: {
        select: {
          id: true,
          userId: true,
          businessName: true,
          locationLabel: true,
          exactAddress: true,
          cancellationPolicy: true,
          ratingAvg: true,
          ratingCount: true,
          user: { select: { avatarSeed: true } },
        },
      },
      review: { select: { id: true, rating: true, body: true } },
      payment: true,
      promotion: { select: { code: true, description: true } },
    },
  });

  if (!appointment) notFound();

  const isCustomer = appointment.customerId === user.id;
  const isProvider = appointment.provider.userId === user.id;
  if (!isCustomer && !isProvider) notFound();

  // The doorstep is revealed only once the booking is actually confirmed, and
  // only to the customer who booked it.
  const showExactAddress =
    isCustomer &&
    appointment.locationMode === "AT_PROVIDER" &&
    ["CONFIRMED", "COMPLETED"].includes(appointment.status) &&
    Boolean(appointment.provider.exactAddress);

  const canReview =
    isCustomer && appointment.status === "COMPLETED" && !appointment.review;

  const conversation = await prisma.conversation.findUnique({
    where: {
      customerId_providerId: {
        customerId: appointment.customerId,
        providerId: appointment.providerId,
      },
    },
    select: { id: true },
  });

  return (
    <>
      {query.new ? (
        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-success-soft px-4 py-3.5 text-sm font-medium text-success">
          <Icon name="check" size={18} />
          {appointment.status === "CONFIRMED"
            ? "You are booked. We sent the provider a notification."
            : "Request sent. You will hear back shortly."}
        </div>
      ) : null}

      <PageHeader
        eyebrow={`Booking ${appointment.code}`}
        title={appointment.service.title}
        subtitle={`${formatFullDate(appointment.startAt)} · ${formatTimeRange(appointment.startAt, appointment.endAt)}`}
        actions={<StatusBadge status={appointment.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <section className="card p-5">
            <h2 className="mb-4 text-base font-semibold text-ink">Details</h2>
            <dl className="divide-y divide-line">
              <Row icon="calendar" label="When">
                <span className="font-semibold text-ink">
                  {formatRelativeDay(appointment.startAt)}, {formatFullDate(appointment.startAt)}
                </span>
                <br />
                {formatTimeRange(appointment.startAt, appointment.endAt)} ·{" "}
                {durationLabel(appointment.service.durationMinutes)}
              </Row>

              <Row icon="pin" label="Where">
                <span className="font-semibold text-ink">
                  {LOCATION_MODE_LABELS[appointment.locationMode as LocationMode] ??
                    appointment.locationMode}
                </span>
                <br />
                {showExactAddress ? (
                  <>
                    {appointment.provider.exactAddress}
                    <Badge tone="success" className="ml-2">
                      Address unlocked
                    </Badge>
                  </>
                ) : (
                  <>
                    {appointment.locationLabel}
                    {appointment.locationMode === "AT_PROVIDER" &&
                    appointment.status === "PENDING" ? (
                      <span className="mt-1 block text-xs text-ink-muted">
                        The exact address appears here once the provider confirms.
                      </span>
                    ) : null}
                  </>
                )}
              </Row>

              <Row icon="money" label="Price">
                <span className="text-lg font-bold text-ink">
                  {formatCents(appointment.priceCents)}
                </span>
                {appointment.promotion ? (
                  <span className="ml-2 text-xs font-semibold text-accent">
                    {appointment.promotion.code} applied
                  </span>
                ) : null}
                {isProvider ? (
                  <span className="mt-1 block text-xs text-ink-muted">
                    You receive {formatCents(appointment.providerPayoutCents)} after the{" "}
                    {formatCents(appointment.platformFeeCents)} platform fee.
                  </span>
                ) : null}
              </Row>

              {appointment.customerNote ? (
                <Row icon="chat" label="Note from customer">
                  {appointment.customerNote}
                </Row>
              ) : null}

              {appointment.cancellationReason ? (
                <Row icon="ban" label="Cancellation reason">
                  {appointment.cancellationReason}
                </Row>
              ) : null}
            </dl>
          </section>

          {canReview ? (
            <ReviewForm
              appointmentId={appointment.id}
              providerName={appointment.provider.businessName}
              defaultOpen={Boolean(query.review)}
            />
          ) : null}

          {appointment.review ? (
            <section className="card p-5">
              <h2 className="mb-2 text-base font-semibold text-ink">Your review</h2>
              <Stars rating={appointment.review.rating} size="sm" showNumber={false} />
              <p className="mt-2 text-sm text-ink-soft">{appointment.review.body}</p>
            </section>
          ) : null}

          <section className="card p-5">
            <h2 className="mb-3 text-base font-semibold text-ink">Manage</h2>
            <AppointmentActions
              appointmentId={appointment.id}
              serviceId={appointment.service.id}
              status={appointment.status}
              role={isProvider ? "provider" : "customer"}
              cancellationPolicy={appointment.provider.cancellationPolicy}
            />
            <p className="mt-3 text-xs text-ink-muted">
              {appointment.provider.cancellationPolicy}
            </p>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-4 text-base font-semibold text-ink">
              {isProvider ? "Customer" : "Provider"}
            </h2>
            <div className="flex items-center gap-3">
              <Avatar
                seed={
                  isProvider
                    ? appointment.customer.avatarSeed
                    : appointment.provider.user.avatarSeed
                }
                name={
                  isProvider ? appointment.customer.name : appointment.provider.businessName
                }
                size="lg"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">
                  {isProvider ? appointment.customer.name : appointment.provider.businessName}
                </p>
                {!isProvider ? (
                  <Stars
                    rating={appointment.provider.ratingAvg}
                    count={appointment.provider.ratingCount}
                    size="sm"
                  />
                ) : (
                  <p className="text-xs text-ink-muted">Booked {appointment.code}</p>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {conversation ? (
                <ButtonLink href={`/messages/${conversation.id}`} variant="secondary" size="sm">
                  <Icon name="chat" size={16} />
                  Open messages
                </ButtonLink>
              ) : (
                <ButtonLink href="/messages" variant="secondary" size="sm">
                  <Icon name="chat" size={16} />
                  Messages
                </ButtonLink>
              )}
              {!isProvider ? (
                <ButtonLink
                  href={`/providers/${appointment.provider.id}`}
                  variant="ghost"
                  size="sm"
                >
                  View profile
                </ButtonLink>
              ) : null}
            </div>

            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
              Phone numbers are never shared. Keep everything in the app so we can help if
              something goes wrong.
            </p>
          </section>

          {appointment.payment ? (
            <section className="card p-5">
              <h2 className="mb-3 text-base font-semibold text-ink">Payment</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Service</dt>
                  <dd className="font-medium text-ink">
                    {formatCents(appointment.payment.amountCents)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Platform fee</dt>
                  <dd className="font-medium text-ink">
                    {formatCents(appointment.payment.platformFeeCents)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-line pt-2">
                  <dt className="text-ink-muted">Provider receives</dt>
                  <dd className="font-bold text-ink">
                    {formatCents(appointment.payment.providerAmountCents)}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 rounded-xl bg-surface-sunken px-3 py-2 text-xs text-ink-muted">
                Status: {appointment.payment.status.replace(/_/g, " ").toLowerCase()} ·{" "}
                {appointment.payment.gateway === "MOCK"
                  ? "Test gateway — no real card is charged."
                  : "Stripe"}
              </p>
            </section>
          ) : null}

          <div className="px-1">
            <ReportButton
              targetType="USER"
              targetId={isProvider ? appointment.customer.id : appointment.provider.userId}
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
