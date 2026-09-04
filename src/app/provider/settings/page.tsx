import type { Metadata } from "next";
import Link from "next/link";

import { apiGet } from "@/lib/api";
import { requireProvider } from "@/lib/guards";
import type { ProviderOwnProfile } from "@/lib/types";

import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { BusinessSettingsForm } from "@/components/provider/BusinessSettingsForm";

export const metadata: Metadata = { title: "Business settings" };
export const dynamic = "force-dynamic";

export default async function ProviderSettingsPage() {
  const user = await requireProvider();

  const [profile, settings] = await Promise.all([
    apiGet<ProviderOwnProfile>("/api/provider/profile"),
    apiGet<{ platformFeePercent: number; paymentGateway: string }>("/api/stats/settings"),
  ]);

  return (
    <>
      <PageHeader title="Business settings" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <BusinessSettingsForm
            profile={{
              businessName: profile.businessName,
              tagline: profile.tagline || null,
              bio: profile.bio,
              locationLabel: profile.locationLabel,
              exactAddress: profile.exactAddress || null,
              locationModes: profile.locationModes,
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
            <Avatar
              seed={user.avatarSeed}
              name={profile.businessName}
              size="2xl"
              className="mx-auto"
            />
            <h2 className="mt-3 text-lg font-bold text-ink">{profile.businessName}</h2>
            <p className="text-sm text-ink-muted">{profile.universityShortName}</p>

            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {profile.verified ? <VerifiedBadge /> : <Badge tone="neutral">Unverified</Badge>}
              <Badge tone={profile.status === "ACTIVE" ? "success" : "warning"}>
                {profile.status.toLowerCase()}
              </Badge>
            </div>

            <Link
              href={`/providers/${profile.id}`}
              className="mt-4 inline-flex text-sm font-semibold text-accent hover:underline"
            >
              View public profile
            </Link>
          </section>

          <section className="card p-5">
            <h2 className="text-base font-semibold text-ink">Marketplace fee</h2>
            <p className="mt-1 text-sm text-ink-muted">
              CampusConnect keeps {settings.platformFeePercent}% of each completed booking. The rate
              is locked in on every booking at the moment it is made, so a change never affects
              money you have already earned.
            </p>
            <p className="mt-3 rounded-xl bg-surface-sunken px-3 py-2 text-xs text-ink-muted">
              Payments are running on the{" "}
              {settings.paymentGateway === "MOCK" ? "test gateway — no real cards" : "Stripe"}{" "}
              gateway.
            </p>
          </section>

          <section className="card p-5">
            <h2 className="text-base font-semibold text-ink">Verification</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {profile.verified
                ? "Your identity has been checked. The badge shows on your profile and search cards."
                : "Verification is granted by an admin. It is not something you can switch on yourself."}
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
