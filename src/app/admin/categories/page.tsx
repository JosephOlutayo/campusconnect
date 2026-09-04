import type { Metadata } from "next";

import { apiGet } from "@/lib/api";
import { PageHeader } from "@/components/shell/PageHeader";
import { CategoryManager } from "@/components/admin/CategoryManager";

export const metadata: Metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  keywords: string;
  color: string;
  isActive: boolean;
  serviceCount: number;
};

export default async function AdminCategoriesPage() {
  // The admin listing includes hidden categories, unlike the public one.
  const categories = await apiGet<CategoryRow[]>("/api/admin/categories");

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="The taxonomy behind search and browse. Adding one takes effect immediately — no deploy."
      />
      <CategoryManager categories={categories} />
    </>
  );
}
