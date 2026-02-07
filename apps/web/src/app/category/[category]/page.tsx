import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { PORTFOLIOS, CATEGORY_META, CategoryGroup, RegionSlug, categoryForPortfolio, regionLabel, toBriefViewModelV2 } from "@proof/shared";
import { fetchPosts } from "../../../lib/api";

export const dynamic = "force-dynamic";

interface CategoryDashboardProps {
  params: Promise<{ category: string }>;
  searchParams?: Promise<{ briefRegion?: string }>;
}

export default async function CategoryDashboard({ params, searchParams }: CategoryDashboardProps) {
  const { category: slug } = await params;
  const query = searchParams ? await searchParams : undefined;
  const selectedRegion: RegionSlug =
    query?.briefRegion === "us-mx-la-lng" || query?.briefRegion === "au" ? query.briefRegion : "au";

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
  const regionBriefs = await fetchPosts({ region: selectedRegion, limit: 400 }).catch(() => []);
  const latestCategoryBrief = regionBriefs.find((brief) => categoryForPortfolio(brief.portfolio) === category);
  const latestCategoryView = latestCategoryBrief ? toBriefViewModelV2(latestCategoryBrief, { defaultRegion: selectedRegion }) : null;

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

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Latest {meta.label} Brief</h2>
          <div className="inline-flex rounded-lg border border-border bg-background p-1 text-xs">
            <Link
              href={`/category/${slug}?briefRegion=au`}
              className={`rounded-md px-3 py-1.5 font-semibold transition-colors ${
                selectedRegion === "au" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              APAC
            </Link>
            <Link
              href={`/category/${slug}?briefRegion=us-mx-la-lng`}
              className={`rounded-md px-3 py-1.5 font-semibold transition-colors ${
                selectedRegion === "us-mx-la-lng"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              International (US/Mexico/Senegal)
            </Link>
          </div>
        </div>
        {latestCategoryView ? (
          <article className="mt-4 space-y-3">
            <img
              src={latestCategoryView.heroImage.url}
              alt={latestCategoryView.heroImage.alt}
              className="h-48 w-full rounded-lg border border-border bg-background object-cover"
              loading="lazy"
            />
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {regionLabel(latestCategoryView.region)} · {latestCategoryView.dateLabel}
            </p>
            <h3 className="text-lg font-semibold text-foreground">{latestCategoryView.title}</h3>
            {latestCategoryView.deltaBullets.length > 0 ? (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {latestCategoryView.deltaBullets.map((item, idx) => (
                  <li key={`${item}-${idx}`} className="flex gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <Link href={`/brief/${latestCategoryBrief.postId}`} className="btn-secondary text-sm">
              Open Brief
            </Link>
          </article>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No published brief is available for this region yet. Content will appear in the next cycle.
          </p>
        )}
      </section>

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
