import type { Metadata } from "next";

import { apiGet } from "@/lib/api";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { PlatformSettingsForm } from "@/components/admin/PlatformSettingsForm";

export const metadata: Metadata = { title: "Marketplace settings" };
export const dynamic = "force-dynamic";

type Overview = {
  platformFeePercent: number;
  providerAutoApprove: boolean;
  paymentGateway: string;
};

export default async function AdminSettingsPage() {
  const stats = await apiGet<Overview>("/api/admin/overview");

  return (
    <>
      <PageHeader title="Marketplace settings" />

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface-muted px-4 py-3">
        <span className="text-sm font-semibold text-ink">Payment gateway</span>
        <Badge tone={stats.paymentGateway === "STRIPE" ? "success" : "warning"}>
          {stats.paymentGateway === "STRIPE" ? "Stripe" : "Mock (test mode)"}
        </Badge>
        <span className="text-xs text-ink-muted">
          {stats.paymentGateway === "STRIPE"
            ? "Live Stripe Connect payments are enabled."
            : "Set STRIPE_SECRET_KEY in the API environment to switch the same flow to live payments."}
        </span>
      </div>

      <PlatformSettingsForm
        platformFeePercent={stats.platformFeePercent}
        providerAutoApprove={stats.providerAutoApprove}
      />
    </>
  );
}
