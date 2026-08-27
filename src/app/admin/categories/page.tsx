import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell/PageHeader";
import { CategoryManager } from "@/components/admin/CategoryManager";

export const metadata: Metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { services: true } } },
  });

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="The taxonomy behind search and browse. Adding one takes effect immediately — no deploy."
      />
      <CategoryManager
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          icon: category.icon,
          description: category.description,
          keywords: category.keywords,
          color: category.color,
          isActive: category.isActive,
          serviceCount: category._count.services,
        }))}
      />
    </>
  );
}
