import { prisma } from "@/lib/prisma";
import {
  BLOCKING_STATUSES,
  LOCATION_MODE_LABELS,
  parseLocationModes,
  type LocationMode,
} from "@/lib/constants";
import { addMinutes, formatRelativeDay, formatTime } from "@/lib/time";
import { applyDiscount, formatCents, splitFee } from "@/lib/money";
import { getPlatformFeePercent } from "@/lib/settings";
import { notify } from "@/lib/notifications";
import { authorizePayment, capturePayment, refundPayment } from "@/lib/payments";

export class BookingError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "BookingError";
    this.status = status;
  }
}

/** CC-7F3K2A — short enough to read out loud, long enough not to collide. */
function bookingCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `CC-${out}`;
}

export function resolveLocationLabel(
  mode: LocationMode,
  providerLabel: string,
  customerHint?: string | null,
): string {
  if (mode === "ONLINE") return "Online";
  if (mode === "AT_CUSTOMER") return customerHint?.trim() || "Your location";
  return providerLabel;
}

export function serviceLocationModes(
  serviceModes: string,
  providerModes: string,
): LocationMode[] {
  const own = parseLocationModes(serviceModes);
  return own.length > 0 ? own : parseLocationModes(providerModes);
}

type CreateInput = {
  customerId: string;
  serviceId: string;
  startAt: Date;
  locationMode: LocationMode;
  customerNote?: string | null;
  customerLocationHint?: string | null;
  promoCode?: string | null;
};

/**
 * The single write path for new bookings.
 *
 * DOUBLE-BOOKING PREVENTION
 * The UI only offers free slots, but two students can hit "Confirm" on the same
 * 5:30 within the same second. The authoritative check therefore runs *inside*
 * the transaction, immediately before the insert: any PENDING/CONFIRMED
 * appointment whose [startAt, blockEndAt) overlaps the requested block aborts
 * the whole thing. SQLite serialises writers, so this is airtight here. On
 * Postgres, run the transaction at SERIALIZABLE (or add an exclusion constraint
 * on the tstzrange) to get the same guarantee under real concurrency.
 */
export async function createAppointment(input: CreateInput) {
  const feePercent = await getPlatformFeePercent();

  const service = await prisma.service.findUnique({
    where: { id: input.serviceId },
    include: {
      provider: {
        include: { user: { select: { id: true, name: true } }, university: true },
      },
      category: true,
    },
  });

  if (!service || !service.isActive) throw new BookingError("That service is no longer available.");
  const provider = service.provider;
  if (provider.status !== "ACTIVE") throw new BookingError("This provider is not taking bookings.");
  if (provider.userId === input.customerId) {
    throw new BookingError("You cannot book your own service.");
  }

  const allowedModes = serviceLocationModes(service.locationModes, provider.locationModes);
  if (!allowedModes.includes(input.locationMode)) {
    throw new BookingError("That location option is not offered for this service.");
  }

  const now = new Date();
  const earliest = addMinutes(now, provider.minNoticeMinutes);
  if (input.startAt < earliest) {
    throw new BookingError(
      `${provider.businessName} needs at least ${provider.minNoticeMinutes} minutes notice.`,
    );
  }

  const endAt = addMinutes(input.startAt, service.durationMinutes);
  const blockEndAt = addMinutes(endAt, provider.bufferMinutes);

  // Optional promo code.
  let promotion = null;
  if (input.promoCode) {
    promotion = await prisma.promotion.findFirst({
      where: {
        providerId: provider.id,
        code: input.promoCode.trim().toUpperCase(),
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    });
    if (!promotion) throw new BookingError("That promo code is not valid right now.");
    if (promotion.maxRedemptions && promotion.redemptions >= promotion.maxRedemptions) {
      throw new BookingError("That promo code has been fully redeemed.");
    }
  }

  const priceCents = applyDiscount(service.priceCents, promotion);
  const split = splitFee(priceCents, feePercent);
  const autoConfirm = provider.autoConfirmBookings;

  const appointment = await prisma.$transaction(async (tx) => {
    const clash = await tx.appointment.findFirst({
      where: {
        providerId: provider.id,
        status: { in: BLOCKING_STATUSES },
        startAt: { lt: blockEndAt },
        blockEndAt: { gt: input.startAt },
      },
      select: { id: true },
    });
    if (clash) {
      throw new BookingError("That time was just booked. Please choose another slot.", 409);
    }

    const created = await tx.appointment.create({
      data: {
        code: bookingCode(),
        customerId: input.customerId,
        providerId: provider.id,
        serviceId: service.id,
        startAt: input.startAt,
        endAt,
        blockEndAt,
        status: autoConfirm ? "CONFIRMED" : "PENDING",
        confirmedAt: autoConfirm ? new Date() : null,
        priceCents: split.totalCents,
        platformFeeCents: split.platformFeeCents,
        providerPayoutCents: split.providerPayoutCents,
        promotionId: promotion?.id ?? null,
        locationMode: input.locationMode,
        locationLabel: resolveLocationLabel(
          input.locationMode,
          provider.locationLabel,
          input.customerLocationHint,
        ),
        customerNote: input.customerNote?.trim() || null,
      },
    });

    await authorizePayment(tx, {
      appointmentId: created.id,
      amountCents: split.totalCents,
      feePercent,
      providerStripeAccountId: provider.stripeAccountId,
    });

    await tx.service.update({
      where: { id: service.id },
      data: { bookingCount: { increment: 1 } },
    });

    if (promotion) {
      await tx.promotion.update({
        where: { id: promotion.id },
        data: { redemptions: { increment: 1 } },
      });
    }

    return created;
  });

  const customer = await prisma.user.findUnique({
    where: { id: input.customerId },
    select: { name: true },
  });
  const when = `${formatRelativeDay(appointment.startAt)} at ${formatTime(appointment.startAt)}`;

  await notify([
    {
      userId: provider.userId,
      type: autoConfirm ? "BOOKING_CONFIRMED" : "BOOKING_CREATED",
      title: autoConfirm ? "New booking" : "Booking request",
      body: `${customer?.name ?? "A student"} booked ${service.title} — ${when}.`,
      href: `/provider/bookings/${appointment.id}`,
    },
    {
      userId: input.customerId,
      type: autoConfirm ? "BOOKING_CONFIRMED" : "BOOKING_CREATED",
      title: autoConfirm ? "Booking confirmed" : "Request sent",
      body: autoConfirm
        ? `You are booked with ${provider.businessName} — ${when}.`
        : `${provider.businessName} will confirm your ${when} request shortly.`,
      href: `/appointments/${appointment.id}`,
    },
  ]);

  return appointment;
}

async function loadForAction(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      service: { select: { title: true } },
      provider: { select: { id: true, userId: true, businessName: true, cancellationPolicy: true } },
      customer: { select: { id: true, name: true } },
    },
  });
  if (!appointment) throw new BookingError("Appointment not found.", 404);
  return appointment;
}

export async function confirmAppointment(appointmentId: string, actingUserId: string) {
  const appointment = await loadForAction(appointmentId);
  if (appointment.provider.userId !== actingUserId) throw new BookingError("Not allowed.", 403);
  if (appointment.status !== "PENDING") {
    throw new BookingError("Only pending requests can be confirmed.");
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });

  await notify({
    userId: appointment.customerId,
    type: "BOOKING_CONFIRMED",
    title: "Booking confirmed",
    body: `${appointment.provider.businessName} confirmed your ${formatRelativeDay(
      appointment.startAt,
    ).toLowerCase()} ${formatTime(appointment.startAt)} appointment.`,
    href: `/appointments/${appointmentId}`,
  });

  return updated;
}

export async function declineAppointment(
  appointmentId: string,
  actingUserId: string,
  reason?: string,
) {
  const appointment = await loadForAction(appointmentId);
  if (appointment.provider.userId !== actingUserId) throw new BookingError("Not allowed.", 403);
  if (appointment.status !== "PENDING") throw new BookingError("Only pending requests can be declined.");

  const updated = await prisma.$transaction(async (tx) => {
    await refundPayment(tx, appointmentId);
    return tx.appointment.update({
      where: { id: appointmentId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledByUserId: actingUserId,
        cancellationReason: reason?.trim() || "Declined by provider",
      },
    });
  });

  await notify({
    userId: appointment.customerId,
    type: "BOOKING_DECLINED",
    title: "Booking declined",
    body: `${appointment.provider.businessName} could not take your ${formatRelativeDay(
      appointment.startAt,
    ).toLowerCase()} appointment.`,
    href: `/appointments/${appointmentId}`,
  });

  return updated;
}

export async function cancelAppointment(
  appointmentId: string,
  actingUserId: string,
  reason?: string,
) {
  const appointment = await loadForAction(appointmentId);
  const isCustomer = appointment.customerId === actingUserId;
  const isProvider = appointment.provider.userId === actingUserId;
  if (!isCustomer && !isProvider) throw new BookingError("Not allowed.", 403);
  if (appointment.status === "CANCELLED") throw new BookingError("Already cancelled.");
  if (appointment.status === "COMPLETED") throw new BookingError("Completed appointments cannot be cancelled.");

  const updated = await prisma.$transaction(async (tx) => {
    await refundPayment(tx, appointmentId);
    return tx.appointment.update({
      where: { id: appointmentId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledByUserId: actingUserId,
        cancellationReason: reason?.trim() || null,
      },
    });
  });

  const otherUserId = isCustomer ? appointment.provider.userId : appointment.customerId;
  const who = isCustomer ? appointment.customer.name : appointment.provider.businessName;
  await notify({
    userId: otherUserId,
    type: "BOOKING_CANCELLED",
    title: "Appointment cancelled",
    body: `${who} cancelled ${appointment.service.title} on ${formatRelativeDay(
      appointment.startAt,
    ).toLowerCase()}.`,
    href: isCustomer ? `/provider/bookings/${appointmentId}` : `/appointments/${appointmentId}`,
  });

  return updated;
}

export async function rescheduleAppointment(
  appointmentId: string,
  actingUserId: string,
  newStartAt: Date,
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      service: { select: { title: true, durationMinutes: true } },
      provider: { select: { id: true, userId: true, businessName: true, bufferMinutes: true } },
      customer: { select: { name: true } },
    },
  });
  if (!appointment) throw new BookingError("Appointment not found.", 404);

  const isCustomer = appointment.customerId === actingUserId;
  const isProvider = appointment.provider.userId === actingUserId;
  if (!isCustomer && !isProvider) throw new BookingError("Not allowed.", 403);
  if (!["PENDING", "CONFIRMED"].includes(appointment.status)) {
    throw new BookingError("Only upcoming appointments can be rescheduled.");
  }

  const endAt = addMinutes(newStartAt, appointment.service.durationMinutes);
  const blockEndAt = addMinutes(endAt, appointment.provider.bufferMinutes);

  const updated = await prisma.$transaction(async (tx) => {
    const clash = await tx.appointment.findFirst({
      where: {
        providerId: appointment.providerId,
        id: { not: appointmentId },
        status: { in: BLOCKING_STATUSES },
        startAt: { lt: blockEndAt },
        blockEndAt: { gt: newStartAt },
      },
      select: { id: true },
    });
    if (clash) throw new BookingError("That time is already taken.", 409);

    return tx.appointment.update({
      where: { id: appointmentId },
      data: { startAt: newStartAt, endAt, blockEndAt },
    });
  });

  const otherUserId = isCustomer ? appointment.provider.userId : appointment.customerId;
  await notify({
    userId: otherUserId,
    type: "BOOKING_RESCHEDULED",
    title: "Appointment moved",
    body: `${appointment.service.title} is now ${formatRelativeDay(newStartAt).toLowerCase()} at ${formatTime(newStartAt)}.`,
    href: isCustomer ? `/provider/bookings/${appointmentId}` : `/appointments/${appointmentId}`,
  });

  return updated;
}

export async function completeAppointment(appointmentId: string, actingUserId: string) {
  const appointment = await loadForAction(appointmentId);
  if (appointment.provider.userId !== actingUserId) throw new BookingError("Not allowed.", 403);
  if (appointment.status !== "CONFIRMED") {
    throw new BookingError("Only confirmed appointments can be completed.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await capturePayment(tx, appointmentId);
    await tx.providerProfile.update({
      where: { id: appointment.providerId },
      data: { completedBookings: { increment: 1 } },
    });
    return tx.appointment.update({
      where: { id: appointmentId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  });

  await notify({
    userId: appointment.customerId,
    type: "BOOKING_COMPLETED",
    title: "How did it go?",
    body: `Leave ${appointment.provider.businessName} a review — it takes 20 seconds.`,
    href: `/appointments/${appointmentId}?review=1`,
  });

  return updated;
}

export async function markNoShow(appointmentId: string, actingUserId: string) {
  const appointment = await loadForAction(appointmentId);
  if (appointment.provider.userId !== actingUserId) throw new BookingError("Not allowed.", 403);
  if (!["CONFIRMED", "PENDING"].includes(appointment.status)) {
    throw new BookingError("Only upcoming appointments can be marked as a no-show.");
  }

  return prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "NO_SHOW", completedAt: new Date() },
  });
}

export function locationSummary(mode: string, label: string): string {
  const known = LOCATION_MODE_LABELS[mode as LocationMode];
  return known ? `${label} · ${known}` : label;
}

export function priceSummary(cents: number): string {
  return formatCents(cents);
}
