import type { Metadata } from "next";

import { getPlatformFeePercent, getProviderAutoApprove } from "@/lib/settings";
import { activeGateway } from "@/lib/payments";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { PlatformSettingsForm } from "@/components/admin/PlatformSettingsForm";

export const metadata: Metadata = { title: "Marketplace settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [feePercent, autoApprove] = await Promise.all([
    getPlatformFeePercent(),
    getProviderAutoApprove(),
  ]);

  return (
    <>
      <PageHeader title="Marketplace settings" />

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface-muted px-4 py-3">
        <span className="text-sm font-semibold text-ink">Payment gateway</span>
        <Badge tone={activeGateway() === "STRIPE" ? "success" : "warning"}>
          {activeGateway() === "STRIPE" ? "Stripe" : "Mock (test mode)"}
        </Badge>
        <span className="text-xs text-ink-muted">
          {activeGateway() === "STRIPE"
            ? "Live Stripe Connect payments are enabled."
            : "Set STRIPE_SECRET_KEY in .env to switch the same flow to live payments."}
        </span>
      </div>

      <PlatformSettingsForm platformFeePercent={feePercent} providerAutoApprove={autoApprove} />
    </>
  );
}
