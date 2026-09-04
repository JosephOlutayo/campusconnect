import type { Metadata } from "next";

import { apiGet } from "@/lib/api";
import { requireProvider } from "@/lib/guards";
import type { Category, ProviderOwnProfile, ServiceOffering } from "@/lib/types";

import { PageHeader } from "@/components/shell/PageHeader";
import { ServiceManager } from "@/components/provider/ServiceManager";

export const metadata: Metadata = { title: "Services" };
export const dynamic = "force-dynamic";

export default async function ProviderServicesPage() {
  await requireProvider();

  const [services, categories, profile] = await Promise.all([
    apiGet<ServiceOffering[]>("/api/provider/services"),
    apiGet<Category[]>("/api/categories"),
    apiGet<ProviderOwnProfile>("/api/provider/profile"),
  ]);

  // The fee shown in the "you keep" preview is the platform default; the
  // authoritative number is snapshotted onto each booking when it is made.
  const feePercent = Number(process.env.NEXT_PUBLIC_PLATFORM_FEE_PERCENT ?? 10);

  return (
    <>
      <PageHeader
        title="Your services"
        subtitle="Each service is a separate thing students can book, with its own price and length."
      />
      <ServiceManager
        services={services.map((service) => ({
          id: service.id,
          title: service.title,
          description: service.description,
          priceCents: service.priceCents,
          durationMinutes: service.durationMinutes,
          isActive: service.active,
          bookingCount: service.bookingCount,
          categoryId: service.categoryId,
          categoryName: service.categoryName,
          categoryIcon: service.categoryIcon,
          locationModes: service.locationModes,
        }))}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          icon: category.icon,
        }))}
        feePercent={feePercent}
        defaultModes={profile.locationModes}
      />
    </>
  );
}
