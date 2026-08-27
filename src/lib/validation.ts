import { z } from "zod";

import { LOCATION_MODES, REPORT_REASONS } from "@/lib/constants";

export const emailSchema = z
  .string()
  .trim()
  .min(3, "Enter your email.")
  .email("That does not look like a valid email.")
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "Passwords need at least 8 characters.")
  .max(200);

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name.").max(80),
  email: emailSchema,
  password: passwordSchema,
  universityId: z.string().min(1, "Pick your university."),
  intent: z.enum(["STUDENT", "PROVIDER"]).default("STUDENT"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  bio: z.string().trim().max(500).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  universityId: z.string().min(1),
});

export const providerOnboardingSchema = z.object({
  businessName: z.string().trim().min(2, "Give your business a name.").max(80),
  tagline: z.string().trim().max(120).optional().nullable(),
  bio: z.string().trim().min(20, "Write at least a sentence or two about your work.").max(2000),
  locationLabel: z.string().trim().min(3, "Where do you work from?").max(120),
  exactAddress: z.string().trim().max(200).optional().nullable(),
  locationModes: z.array(z.enum(LOCATION_MODES)).min(1, "Pick at least one location option."),
  categoryId: z.string().min(1, "Pick your main category."),
  serviceTitle: z.string().trim().min(2, "Name your first service.").max(90),
  serviceDescription: z.string().trim().min(10, "Describe the service.").max(1000),
  priceDollars: z.coerce.number().min(1, "Set a price.").max(5000),
  durationMinutes: z.coerce.number().int().min(10, "Minimum 10 minutes.").max(600),
});

export const providerSettingsSchema = z.object({
  businessName: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(120).optional().nullable(),
  bio: z.string().trim().min(10).max(2000),
  locationLabel: z.string().trim().min(3).max(120),
  exactAddress: z.string().trim().max(200).optional().nullable(),
  locationModes: z.array(z.enum(LOCATION_MODES)).min(1),
  autoConfirmBookings: z.boolean(),
  bufferMinutes: z.coerce.number().int().min(0).max(240),
  minNoticeMinutes: z.coerce.number().int().min(0).max(10080),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365),
  cancellationPolicy: z.string().trim().min(5).max(500),
  status: z.enum(["ACTIVE", "PAUSED"]),
});

export const serviceSchema = z.object({
  title: z.string().trim().min(2, "Name the service.").max(90),
  description: z.string().trim().min(10, "Add a short description.").max(1000),
  categoryId: z.string().min(1, "Pick a category."),
  priceDollars: z.coerce.number().min(1).max(5000),
  durationMinutes: z.coerce.number().int().min(10).max(600),
  locationModes: z.array(z.enum(LOCATION_MODES)).default([]),
  isActive: z.boolean().default(true),
});

export const availabilitySchema = z.object({
  rules: z
    .array(
      z.object({
        weekday: z.coerce.number().int().min(0).max(6),
        startMinute: z.coerce.number().int().min(0).max(1440),
        endMinute: z.coerce.number().int().min(0).max(1440),
      }),
    )
    .max(60)
    .refine(
      (rules) => rules.every((rule) => rule.endMinute > rule.startMinute),
      "Each window must end after it starts.",
    ),
});

export const timeOffSchema = z.object({
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  reason: z.string().trim().max(120).optional().nullable(),
});

export const bookingSchema = z.object({
  serviceId: z.string().min(1),
  startAt: z.coerce.date(),
  locationMode: z.enum(LOCATION_MODES),
  customerNote: z.string().trim().max(500).optional().nullable(),
  customerLocationHint: z.string().trim().max(200).optional().nullable(),
  promoCode: z.string().trim().max(30).optional().nullable(),
});

export const rescheduleSchema = z.object({
  startAt: z.coerce.date(),
});

export const cancelSchema = z.object({
  reason: z.string().trim().max(300).optional().nullable(),
});

export const reviewSchema = z.object({
  appointmentId: z.string().min(1),
  rating: z.coerce.number().int().min(1, "Pick a rating.").max(5),
  body: z.string().trim().min(5, "Say a little about your experience.").max(1500),
  imageSeeds: z.array(z.string()).max(4).optional(),
});

export const reviewResponseSchema = z.object({
  response: z.string().trim().min(2).max(800),
});

export const messageSchema = z.object({
  body: z.string().trim().min(1, "Write a message.").max(2000),
  appointmentId: z.string().optional().nullable(),
  imageSeed: z.string().optional().nullable(),
});

export const startConversationSchema = z.object({
  providerId: z.string().min(1),
  body: z.string().trim().min(1).max(2000),
});

export const reportSchema = z.object({
  targetType: z.enum(["USER", "PROVIDER", "SERVICE", "REVIEW", "MESSAGE"]),
  targetId: z.string().min(1),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).optional().nullable(),
});

export const promotionSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .regex(/^[A-Za-z0-9]+$/, "Letters and numbers only.")
    .transform((value) => value.toUpperCase()),
  description: z.string().trim().min(3).max(140),
  discountType: z.enum(["PERCENT", "AMOUNT"]),
  discountValue: z.coerce.number().int().min(1),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  maxRedemptions: z.coerce.number().int().min(1).optional().nullable(),
});

export const adminSettingsSchema = z.object({
  platformFeePercent: z.coerce.number().min(0).max(50),
  providerAutoApprove: z.boolean(),
});

export const universitySchema = z.object({
  name: z.string().trim().min(3).max(120),
  shortName: z.string().trim().min(2).max(20),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only."),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(40),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  color: z.string().trim().max(20).default("#4F46E5"),
  emailDomains: z.string().trim().max(400).default(""),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only."),
  icon: z.string().trim().min(1).max(8),
  description: z.string().trim().min(3).max(200),
  keywords: z.string().trim().max(400).default(""),
  color: z.string().trim().max(20).default("#4F46E5"),
});
