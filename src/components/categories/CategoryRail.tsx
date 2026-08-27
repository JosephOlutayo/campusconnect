import Link from "next/link";

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  _count?: { services: number };
};

/** Horizontally scrollable on phones, wrapping grid from sm upwards. */
export function CategoryRail({ categories }: { categories: Category[] }) {
  return (
    <div className="rail -mx-1 flex gap-2.5 px-1 pb-1 sm:flex-wrap sm:overflow-visible">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/explore?category=${category.slug}`}
          className="card card-hover flex shrink-0 items-center gap-2.5 rounded-2xl px-3.5 py-2.5 scroll-ml-1 snap-start"
        >
          <span
            className="grid size-9 shrink-0 place-items-center rounded-xl text-lg"
            style={{ backgroundColor: `${category.color}18` }}
          >
            {category.icon}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold whitespace-nowrap text-ink">
              {category.name}
            </span>
            {category._count ? (
              <span className="block text-xs whitespace-nowrap text-ink-muted">
                {category._count.services} service{category._count.services === 1 ? "" : "s"}
              </span>
            ) : null}
          </span>
        </Link>
      ))}
    </div>
  );
}

export function CategoryTile({ category }: { category: Category }) {
  return (
    <Link
      href={`/explore?category=${category.slug}`}
      className="card card-hover group flex flex-col gap-3 p-5"
    >
      <span
        className="grid size-12 place-items-center rounded-2xl text-2xl transition-transform group-hover:scale-110"
        style={{ backgroundColor: `${category.color}18` }}
      >
        {category.icon}
      </span>
      <span>
        <span className="block text-[15px] font-semibold text-ink">{category.name}</span>
        {category._count ? (
          <span className="mt-0.5 block text-xs text-ink-muted">
            {category._count.services} service{category._count.services === 1 ? "" : "s"} listed
          </span>
        ) : null}
      </span>
    </Link>
  );
}
