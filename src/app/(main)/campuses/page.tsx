import type { Metadata } from "next";
import Link from "next/link";

import { apiGet } from "@/lib/api";
import type { University } from "@/lib/types";
import { PageHeader } from "@/components/shell/PageHeader";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Campuses" };
export const dynamic = "force-dynamic";

export default async function CampusesPage() {
  const universities = await apiGet<University[]>("/api/universities");

  return (
    <>
      <PageHeader
        eyebrow="Campuses"
        title="Pick your campus"
        subtitle="Each campus has its own providers, prices and reviews. More are added all the time."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {universities.map((university) => (
          <Link
            key={university.id}
            href={`/campuses/${university.slug}`}
            className="card card-hover group overflow-hidden"
          >
            <div
              className="h-24 w-full"
              style={{
                backgroundImage: `linear-gradient(135deg, ${university.color}, ${university.color}99)`,
              }}
            />
            <div className="p-5">
              <p className="text-[15px] font-bold text-ink">{university.shortName}</p>
              <p className="mt-0.5 text-sm text-ink-muted">{university.name}</p>
              <div className="mt-3 flex items-center gap-4 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="pin" size={14} />
                  {university.city}, {university.state}
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                  <Icon name="users" size={14} />
                  {university.providerCount} providers
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
