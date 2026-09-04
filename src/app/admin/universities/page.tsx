import type { Metadata } from "next";

import { apiGet } from "@/lib/api";
import { PageHeader } from "@/components/shell/PageHeader";
import { UniversityManager } from "@/components/admin/UniversityManager";

export const metadata: Metadata = { title: "Universities" };
export const dynamic = "force-dynamic";

type UniversityRow = {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  city: string;
  state: string;
  color: string;
  isActive: boolean;
  providerCount: number;
  userCount: number;
  domains: string[];
};

export default async function AdminUniversitiesPage() {
  const universities = await apiGet<UniversityRow[]>("/api/admin/universities");

  return (
    <>
      <PageHeader
        title="Universities"
        subtitle="Every campus on the platform. Adding one is data entry, not a deploy."
      />
      <UniversityManager universities={universities} />
    </>
  );
}
