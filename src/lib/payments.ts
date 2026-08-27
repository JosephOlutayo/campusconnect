import type { Prisma, PrismaClient } from "@prisma/client";

import { splitFee } from "@/lib/money";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * PAYMENTS ARCHITECTURE
 *
 * The money model is Stripe Connect "destination charges":
 *
 *   customer card  ->  platform Stripe account  ->  transfer to provider
 *                          (keeps application_fee_amount)
 *
 * Every field this app records (amount, application fee, transfer amount,
 * external id, capture/refund timestamps) maps 1:1 onto a Stripe PaymentIntent,
 * so switching gateways is a matter of implementing the same three functions
 * against the Stripe SDK — no schema change, no caller change.
 *
 * Until STRIPE_SECRET_KEY exists, the MOCK gateway runs the identical state
 * machine in the database. Nothing here fabricates a production credential.
 */

export type Gateway = "MOCK" | "STRIPE";

export function activeGateway(): Gateway {
  return process.env.STRIPE_SECRET_KEY ? "STRIPE" : "MOCK";
}

export type AuthorizeInput = {
  appointmentId: string;
  amountCents: number;
  feePercent: number;
  /** Null until the provider completes Connect onboarding. */
  providerStripeAccountId?: string | null;
};

/**
 * Authorises (does not capture) the customer's payment when a booking is made.
 * Real Stripe: stripe.paymentIntents.create({ capture_method: "manual",
 * application_fee_amount, transfer_data: { destination } }).
 */
export async function authorizePayment(db: Db, input: AuthorizeInput) {
  const split = splitFee(input.amountCents, input.feePercent);
  const gateway = activeGateway();

  if (gateway === "STRIPE") {
    // Intentionally not implemented: requires live credentials. Wire the SDK
    // call here and assign externalId from the returned PaymentIntent id.
    throw new Error(
      "Stripe gateway selected but the Stripe SDK is not wired up yet. See src/lib/payments.ts.",
    );
  }

  return db.payment.create({
    data: {
      appointmentId: input.appointmentId,
      amountCents: split.totalCents,
      platformFeeCents: split.platformFeeCents,
      providerAmountCents: split.providerPayoutCents,
      status: "REQUIRES_CAPTURE",
      gateway,
      externalId: `mock_pi_${Math.random().toString(36).slice(2, 12)}`,
    },
  });
}

/** Capture happens when the appointment is marked complete. */
export async function capturePayment(db: Db, appointmentId: string) {
  const payment = await db.payment.findUnique({ where: { appointmentId } });
  if (!payment || payment.status !== "REQUIRES_CAPTURE") return payment;

  return db.payment.update({
    where: { id: payment.id },
    data: { status: "SUCCEEDED", capturedAt: new Date() },
  });
}

/** Cancellation inside the free window releases the authorisation. */
export async function refundPayment(db: Db, appointmentId: string) {
  const payment = await db.payment.findUnique({ where: { appointmentId } });
  if (!payment || payment.status === "REFUNDED") return payment;

  return db.payment.update({
    where: { id: payment.id },
    data: { status: "REFUNDED", refundedAt: new Date() },
  });
}

/** Human-readable summary for the checkout screen. */
export function feeBreakdown(amountCents: number, feePercent: number) {
  const split = splitFee(amountCents, feePercent);
  return {
    ...split,
    feePercent,
    gateway: activeGateway(),
  };
}
