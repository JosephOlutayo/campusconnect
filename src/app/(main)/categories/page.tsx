import type { Metadata } from "next";

import { apiGet } from "@/lib/api";
import type { Category } from "@/lib/types";
import { PageHeader } from "@/components/shell/PageHeader";
import { CategoryTile } from "@/components/categories/CategoryRail";
import { SearchBar } from "@/components/search/SearchBar";

export const metadata: Metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await apiGet<Category[]>("/api/categories");

  return (
    <>
      <PageHeader
        eyebrow="Browse"
        title="Every kind of service on campus"
        subtitle="Sixteen categories, all offered by students and local pros near you."
      />
      <div className="mb-6">
        <SearchBar size="lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {categories.map((category) => (
          <CategoryTile key={category.id} category={category} />
        ))}
      </div>
    </>
  );
}
