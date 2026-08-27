import type { Metadata } from "next";
import Link from "next/link";

import { requireProvider } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseLocationModes } from "@/lib/constants";
import { getPlatformFeePercent } from "@/lib/settings";
import { activeGateway } from "@/lib/payments";

import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { BusinessSettingsForm } from "@/components/provider/BusinessSettingsForm";

export const metadata: Metadata = { title: "Business settings" };
export const dynamic = "force-dynamic";

export default async function ProviderSettingsPage() {
  const { user, providerId } = await requireProvider();

  const [profile, feePercent] = await Promise.all([
    prisma.providerProfile.findUniqueOrThrow({
      where: { id: providerId },
      include: { university: { select: { name: true, shortName: true } } },
    }),
    getPlatformFeePercent(),
  ]);

  return (
    <>
      <PageHeader title="Business settings" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <BusinessSettingsForm
            profile={{
              businessName: profile.businessName,
              tagline: profile.tagline,
              bio: profile.bio,
              locationLabel: profile.locationLabel,
              exactAddress: profile.exactAddress,
              locationModes: parseLocationModes(profile.locationModes),
              autoConfirmBookings: profile.autoConfirmBookings,
              bufferMinutes: profile.bufferMinutes,
              minNoticeMinutes: profile.minNoticeMinutes,
              maxAdvanceDays: profile.maxAdvanceDays,
              cancellationPolicy: profile.cancellationPolicy,
              status: profile.status,
            }}
          />
        </div>

        <aside className="space-y-5">
          <section className="card p-5 text-center">
            <Avatar seed={user.avatarSeed} name={profile.businessName} size="2xl" className="mx-auto" />
            <h2 className="mt-3 text-base font-bold text-ink">{profile.businessName}</h2>
            <p className="text-sm text-ink-muted">{profile.university.name}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {profile.isVerified ? <VerifiedBadge /> : <Badge tone="neutral">Unverified</Badge>}
              <Badge tone={profile.status === "ACTIVE" ? "success" : "warning"}>
                {profile.status.toLowerCase()}
              </Badge>
            </div>
            <Link
              href={`/providers/${providerId}`}
              className="mt-4 inline-block text-sm font-semibold text-accent hover:underline"
            >
              View public profile
            </Link>
          </section>

          <section className="card p-5">
            <h2 className="text-base font-semibold text-ink">Verification</h2>
            <p className="mt-1.5 text-sm text-ink-muted">
              {profile.isVerified
                ? "Your identity has been checked by our team. The blue tick shows on every listing."
                : "Verified providers get a blue tick and rank higher in search. Our team reviews providers with a track record of completed bookings and clean reports."}
            </p>
          </section>

          <section className="card p-5">
            <h2 className="text-base font-semibold text-ink">Payouts</h2>
            <p className="mt-1.5 text-sm text-ink-muted">
              You keep {100 - feePercent}% of every completed booking.
            </p>
            <p className="mt-3 rounded-xl bg-surface-sunken px-3 py-2.5 text-xs text-ink-muted">
              {activeGateway() === "MOCK"
                ? "Payments run through the test gateway. Stripe Connect onboarding appears here once a Stripe key is configured."
                : profile.stripeAccountId
                  ? `Connected to Stripe account ${profile.stripeAccountId}`
                  : "Connect your Stripe account to receive payouts."}
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
