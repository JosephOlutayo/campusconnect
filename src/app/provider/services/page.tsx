import type { Metadata } from "next";

import { requireProvider } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCategories } from "@/lib/queries";
import { getPlatformFeePercent } from "@/lib/settings";
import { parseLocationModes } from "@/lib/constants";

import { PageHeader } from "@/components/shell/PageHeader";
import { ServiceManager, type ManagedService } from "@/components/provider/ServiceManager";

export const metadata: Metadata = { title: "Services" };
export const dynamic = "force-dynamic";

export default async function ProviderServicesPage() {
  const { providerId } = await requireProvider();

  const [services, categories, feePercent, profile] = await Promise.all([
    prisma.service.findMany({
      where: { providerId },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: { category: { select: { id: true, name: true, icon: true } } },
    }),
    getCategories(),
    getPlatformFeePercent(),
    prisma.providerProfile.findUniqueOrThrow({
      where: { id: providerId },
      select: { locationModes: true },
    }),
  ]);

  const managed: ManagedService[] = services.map((service) => ({
    id: service.id,
    title: service.title,
    description: service.description,
    priceCents: service.priceCents,
    durationMinutes: service.durationMinutes,
    isActive: service.isActive,
    bookingCount: service.bookingCount,
    categoryId: service.categoryId,
    categoryName: service.category.name,
    categoryIcon: service.category.icon,
    locationModes: parseLocationModes(service.locationModes || profile.locationModes),
  }));

  return (
    <>
      <PageHeader
        title="Services"
        subtitle="What students can book, how long it takes and what it costs."
      />
      <ServiceManager
        services={managed}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          icon: category.icon,
        }))}
        feePercent={feePercent}
        defaultModes={parseLocationModes(profile.locationModes)}
      />
    </>
  );
}
