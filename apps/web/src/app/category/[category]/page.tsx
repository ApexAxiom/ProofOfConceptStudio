import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { PORTFOLIOS, CATEGORY_META, categoryForPortfolio, CategoryGroup } from "@proof/shared";

interface CategoryDashboardProps {
  params: Promise<{ category: string }>;
}

export default async function CategoryDashboard({ params }: CategoryDashboardProps) {
  const { category: slug } = await params;

  const portfolio = PORTFOLIOS.find((p) => p.slug === slug);
  if (portfolio) {
    redirect(`/portfolio/${portfolio.slug}`);
  }

  const category = Object.keys(CATEGORY_META).find((key) => key === slug) as CategoryGroup | undefined;
  if (!category) {
    return notFound();
  }

  const meta = CATEGORY_META[category];
  const portfolios = PORTFOLIOS.filter((p) => categoryForPortfolio(p.slug) === category);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Dashboard</Link>
          <span>/</span>
          <span className="text-foreground">{meta.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
          <h1 className="text-2xl font-bold text-foreground">{meta.label}</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Portfolios grouped under {meta.label}. Choose a portfolio to view its cross-region intelligence dashboard.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {portfolios.map((p) => (
          <Link
            key={p.slug}
            href={`/portfolio/${p.slug}`}
            className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
              <span className="text-sm font-semibold text-foreground">{p.label}</span>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-3">{p.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
