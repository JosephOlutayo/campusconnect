import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell/PageHeader";
import { UniversityManager } from "@/components/admin/UniversityManager";

export const metadata: Metadata = { title: "Universities" };
export const dynamic = "force-dynamic";

export default async function AdminUniversitiesPage() {
  const universities = await prisma.university.findMany({
    orderBy: { name: "asc" },
    include: {
      emailDomains: { select: { domain: true } },
      _count: { select: { providers: true, users: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Universities"
        subtitle="Every campus on the platform. The architecture scales from one to hundreds without a code change."
      />
      <UniversityManager
        universities={universities.map((university) => ({
          id: university.id,
          name: university.name,
          shortName: university.shortName,
          slug: university.slug,
          city: university.city,
          state: university.state,
          color: university.color,
          isActive: university.isActive,
          providerCount: university._count.providers,
          userCount: university._count.users,
          domains: university.emailDomains.map((row) => row.domain),
        }))}
      />
    </>
  );
}
