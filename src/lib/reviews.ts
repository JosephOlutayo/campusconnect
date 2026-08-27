import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";

export class ReviewError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ReviewError";
    this.status = status;
  }
}

/**
 * Recomputes the denormalised rating columns from visible reviews.
 * Called after every write that can change them (create, hide, unhide, delete)
 * so ProviderProfile.ratingAvg is always derivable, never drifting.
 */
export async function recomputeProviderRating(providerId: string): Promise<void> {
  const aggregate = await prisma.review.aggregate({
    where: { providerId, isHidden: false },
    _avg: { rating: true },
    _count: { _all: true },
  });

  await prisma.providerProfile.update({
    where: { id: providerId },
    data: {
      ratingAvg: Math.round((aggregate._avg.rating ?? 0) * 100) / 100,
      ratingCount: aggregate._count._all,
    },
  });
}

type CreateReviewInput = {
  appointmentId: string;
  authorId: string;
  rating: number;
  body: string;
  imageSeeds?: string[];
};

/**
 * Reviews are earned, not posted. The only way in is a COMPLETED appointment
 * that belongs to the author and has not been reviewed yet — enforced here and
 * by the unique constraint on Review.appointmentId.
 */
export async function createReview(input: CreateReviewInput) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: input.appointmentId },
    include: {
      review: { select: { id: true } },
      provider: { select: { id: true, userId: true, businessName: true } },
      customer: { select: { name: true } },
    },
  });

  if (!appointment) throw new ReviewError("Appointment not found.", 404);
  if (appointment.customerId !== input.authorId) {
    throw new ReviewError("You can only review your own appointments.", 403);
  }
  if (appointment.status !== "COMPLETED") {
    throw new ReviewError("You can review a provider once your appointment is completed.");
  }
  if (appointment.review) throw new ReviewError("You already reviewed this appointment.");
  if (input.rating < 1 || input.rating > 5) throw new ReviewError("Rating must be 1 to 5 stars.");

  const review = await prisma.review.create({
    data: {
      appointmentId: appointment.id,
      providerId: appointment.providerId,
      authorId: input.authorId,
      rating: Math.round(input.rating),
      body: input.body.trim(),
      images: input.imageSeeds?.length
        ? { create: input.imageSeeds.map((seed) => ({ seed })) }
        : undefined,
    },
  });

  await recomputeProviderRating(appointment.providerId);

  await notify({
    userId: appointment.provider.userId,
    type: "REVIEW_RECEIVED",
    title: `${input.rating}-star review`,
    body: `${appointment.customer.name} reviewed your work.`,
    href: `/provider/reviews`,
  });

  return review;
}

export async function respondToReview(reviewId: string, providerUserId: string, response: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { provider: { select: { userId: true, businessName: true } } },
  });
  if (!review) throw new ReviewError("Review not found.", 404);
  if (review.provider.userId !== providerUserId) throw new ReviewError("Not allowed.", 403);

  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: { providerResponse: response.trim(), providerRespondedAt: new Date() },
  });

  await notify({
    userId: review.authorId,
    type: "REVIEW_REPLY",
    title: "Provider replied",
    body: `${review.provider.businessName} responded to your review.`,
    href: `/providers/${review.providerId}`,
  });

  return updated;
}

/** Appointments the signed-in student can still review. */
export async function pendingReviews(userId: string) {
  return prisma.appointment.findMany({
    where: { customerId: userId, status: "COMPLETED", review: null },
    include: {
      service: { select: { title: true } },
      provider: {
        select: { id: true, businessName: true, user: { select: { avatarSeed: true } } },
      },
    },
    orderBy: { completedAt: "desc" },
  });
}
