import Link from "next/link";
import {
  BriefPost,
  BriefSourceInput,
  RegionSlug,
  findPortfolio,
  portfolioLabel,
  regionLabel,
  toBriefViewModelV2
} from "@proof/shared";
import { fetchPosts } from "../../../lib/api";
import { getPortfolioNews } from "../../../lib/portfolio-news";
import { PortfolioMarketTicker } from "../../../components/PortfolioMarketTicker";
import { DashboardCard, ListRow } from "../../../components/portfolio-dashboard";
import styles from "./portfolio-dashboard.module.css";

interface PortfolioOverviewPageProps {
  params: Promise<{ portfolio: string }>;
  searchParams?: Promise<{ briefRegion?: string }>;
}

interface SourceRow {
  url: string;
  title: string;
  publishedAt?: string;
  retrievedAt?: string;
}

const OPERATIONAL_PHRASES: RegExp[] = [
  /^brief generation failed\.?/i,
  /^carrying forward the most recent brief\.?/i,
  /^no material change detected today\.?/i,
  /^automated refresh was unavailable(?: this cycle)?\.?/i,
  /^using the most recent brief\.?/i,
  /^daily intelligence update is being (prepared|initialized)\.?/i,
  /^baseline coverage is active(?: while.*)?\.?/i,
  /^latest available intelligence snapshot(?: for this region)?\.?/i
];

function sanitizeInsightText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let cleaned = value.replace(/\s+/g, " ").trim();
  for (const phrase of OPERATIONAL_PHRASES) {
    cleaned = cleaned.replace(phrase, "").trim();
  }
  cleaned = cleaned.replace(/^[,;:. -]+/, "").trim();
  if (!cleaned) return undefined;
  if (/^(no material|no published|no update|pending update)/i.test(cleaned)) return undefined;
  return cleaned;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const sanitized = sanitizeInsightText(value);
    if (!sanitized) continue;
    const key = sanitized.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

function deriveWhatsHappening(briefs: BriefPost[]): {
  summary: string;
  impact: string[];
  actions: string[];
} {
  const latest = briefs[0];
  if (!latest) {
    return {
      summary: "Latest portfolio signals are summarized from monitored market and source coverage.",
      impact: ["Recent source signals are tracked for this portfolio across configured regions."],
      actions: ["Review latest portfolio news and prioritize follow-up actions tied to current supplier and market moves."]
    };
  }

  const summary =
    sanitizeInsightText(latest.summary?.trim()) ||
    sanitizeInsightText(latest.decisionSummary?.topMove?.trim()) ||
    "Latest market and category movement is reflected in today’s published brief.";

  const impact = uniqueStrings([
    ...(latest.decisionSummary?.whatChanged ?? []),
    ...(latest.highlights ?? []),
    ...(latest.deltaSinceLastRun ?? []),
    latest.vpSnapshot?.health?.narrative
  ]).slice(0, 6);

  const actions = uniqueStrings([
    ...(latest.decisionSummary?.doNext ?? []),
    ...(latest.procurementActions ?? []),
    ...(latest.vpSnapshot?.recommendedActions ?? []).map((item) => item.action)
  ]).slice(0, 6);

  return {
    summary,
    impact: impact.length > 0 ? impact : ["No major impact deltas were captured in the latest run."],
    actions: actions.length > 0 ? actions : ["Monitor next run for concrete category actions."]
  };
}

function fallbackHistory(portfolio: string): BriefPost[] {
  const now = new Date().toISOString();
  return [
    {
      postId: `baseline-${portfolio}-au`,
      title: `${portfolioLabel(portfolio)} — Intelligence snapshot`,
      region: "au",
      portfolio,
      runWindow: "apac",
      status: "published",
      publishedAt: now,
      summary: "Latest available intelligence snapshot for this region.",
      bodyMarkdown: "Latest available intelligence snapshot for this region.",
      tags: ["baseline"]
    },
    {
      postId: `baseline-${portfolio}-intl`,
      title: `${portfolioLabel(portfolio)} — Intelligence snapshot`,
      region: "us-mx-la-lng",
      portfolio,
      runWindow: "international",
      status: "published",
      publishedAt: now,
      summary: "Latest available intelligence snapshot for this region.",
      bodyMarkdown: "Latest available intelligence snapshot for this region.",
      tags: ["baseline"]
    }
  ];
}

function shortDate(iso?: string): string {
  if (!iso) return "Date n/a";
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return "Date n/a";
  return value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function sourceLabelFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

function normalizeSources(sources?: BriefPost["sources"]): SourceRow[] {
  if (!Array.isArray(sources)) return [];

  const seen = new Set<string>();
  const rows: SourceRow[] = [];

  for (const source of sources) {
    let row: SourceRow | null = null;

    if (typeof source === "string") {
      const url = source.trim();
      if (url) {
        row = { url, title: sourceLabelFromUrl(url) };
      }
    } else if (source && typeof source === "object") {
      const typed = source as Exclude<BriefSourceInput, string>;
      const url = typeof typed.url === "string" ? typed.url.trim() : "";
      if (url) {
        const title =
          typeof typed.title === "string" && typed.title.trim().length > 0
            ? typed.title.trim()
            : sourceLabelFromUrl(url);
        row = {
          url,
          title,
          publishedAt: typeof typed.publishedAt === "string" ? typed.publishedAt : undefined,
          retrievedAt: typeof typed.retrievedAt === "string" ? typed.retrievedAt : undefined
        };
      }
    }

    if (!row) continue;
    const key = row.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }

  return rows;
}

function regionBadge(brief: BriefPost): string {
  const runWindow = (brief.runWindow ?? "").toLowerCase();
  if (runWindow.includes("apac") || brief.region === "au") return "APAC";
  return "INTL";
}

/**
 * Category overview page for a selected portfolio.
 */
export default async function PortfolioOverviewPage({ params, searchParams }: PortfolioOverviewPageProps) {
  const { portfolio } = await params;
  const query = searchParams ? await searchParams : undefined;
  const selectedRegion: RegionSlug =
    query?.briefRegion === "us-mx-la-lng" || query?.briefRegion === "au" ? query.briefRegion : "au";
  const portfolioDef = findPortfolio(portfolio);

  if (!portfolioDef) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold text-foreground">Portfolio not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">{portfolio} is not configured.</p>
        <Link href="/" className="btn-secondary mt-4 inline-flex">
          Back to Executive View
        </Link>
      </div>
    );
  }

  const [auBriefs, intlBriefs, portfolioNews] = await Promise.all([
    fetchPosts({ region: "au", portfolio, limit: 120 }).catch(() => [] as BriefPost[]),
    fetchPosts({ region: "us-mx-la-lng", portfolio, limit: 120 }).catch(() => [] as BriefPost[]),
    getPortfolioNews(portfolio, 12).catch(() => [])
  ]);

  const history = [...auBriefs, ...intlBriefs].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const insight = deriveWhatsHappening(history);
  const latestByRegion: Record<RegionSlug, BriefPost | undefined> = {
    au: auBriefs[0],
    "us-mx-la-lng": intlBriefs[0]
  };
  const activeBrief = latestByRegion[selectedRegion];
  const activeBriefView = activeBrief ? toBriefViewModelV2(activeBrief, { defaultRegion: selectedRegion }) : null;

  const displayBriefs = history.length > 0 ? history : fallbackHistory(portfolio);

  const visibleImpact = insight.impact.slice(0, 4);
  const hiddenImpact = insight.impact.slice(4);
  const visibleActions = insight.actions.slice(0, 4);
  const hiddenActions = insight.actions.slice(4);
  const visibleNews = portfolioNews.slice(0, 8);
  const hiddenNews = portfolioNews.slice(8);
  const visibleBriefs = displayBriefs.slice(0, 6);
  const hiddenBriefs = displayBriefs.slice(6);
  const normalizedSources = normalizeSources(activeBrief?.sources);
  const visibleSources = normalizedSources.slice(0, 8);
  const hiddenSources = normalizedSources.slice(8);
  const hasRenderableHero = Boolean(activeBriefView?.heroImage?.url?.startsWith("https://"));

  return (
    <div className={styles.dashboard}>
      <header className={styles.stickyHeader}>
        <div className={styles.headerRow}>
          <div>
            <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
              <Link href="/" className={`${styles.breadcrumbLink} ${styles.focusable}`}>
                Executive View
              </Link>
              <span>/</span>
              <Link href="/portfolios" className={`${styles.breadcrumbLink} ${styles.focusable}`}>
                Portfolios
              </Link>
              <span>/</span>
              <span>{portfolioLabel(portfolio)}</span>
            </nav>
            <h1 className={styles.title}>{portfolioLabel(portfolio)}</h1>
            <p className={styles.description}>{portfolioDef.description}</p>
          </div>

          <div className={styles.headerActions}>
            <nav className={styles.segmentControl} aria-label="Brief region selector">
              <Link
                href={`/portfolio/${portfolio}?briefRegion=au`}
                className={`${styles.segmentLink} ${styles.focusable} ${selectedRegion === "au" ? styles.segmentLinkActive : ""}`}
              >
                APAC
              </Link>
              <Link
                href={`/portfolio/${portfolio}?briefRegion=us-mx-la-lng`}
                className={`${styles.segmentLink} ${styles.focusable} ${selectedRegion === "us-mx-la-lng" ? styles.segmentLinkActive : ""}`}
              >
                International (US/Mexico/Senegal)
              </Link>
            </nav>
            <Link href={`/chat?portfolio=${portfolio}`} className={`btn-primary ${styles.askAiButton} ${styles.focusable}`}>
              Ask AI
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.contentGrid}>
        <div className={styles.primaryColumn}>
          <DashboardCard
            title="Daily Intelligence Update"
            subtitle={selectedRegion === "au" ? "APAC view" : "International view"}
            className={styles.card}
            headerClassName={styles.cardHeader}
            bodyClassName={styles.cardBody}
          >
            {activeBriefView ? (
              <>
                <p className={styles.metaLine}>
                  {regionLabel(activeBriefView.region)} · {activeBriefView.dateLabel}
                </p>
                <h3 className={styles.headline}>{activeBriefView.title}</h3>
                <p className={styles.lede}>{insight.summary}</p>
                {hasRenderableHero ? (
                  <img
                    src={activeBriefView.heroImage.url}
                    alt={activeBriefView.heroImage.alt}
                    className={styles.heroImage}
                    loading="lazy"
                  />
                ) : null}
              </>
            ) : (
              <>
                <p className={styles.metaLine}>{selectedRegion === "au" ? "APAC" : "International"} · Latest signal set</p>
                <h3 className={styles.headline}>Daily intelligence update</h3>
                <p className={styles.lede}>{insight.summary}</p>
              </>
            )}

            <section className={styles.subSection}>
              <h4 className={styles.subSectionTitle}>What changed</h4>
              {visibleImpact.length > 0 ? (
                <ul className={styles.bulletList}>
                  {visibleImpact.map((item, idx) => (
                    <li key={`${item}-${idx}`} className={styles.bulletItem}>
                      <span className={styles.bulletDot} aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.emptyState}>No major deltas were captured in the latest run.</p>
              )}
              {hiddenImpact.length > 0 ? (
                <details className={styles.details}>
                  <summary className={`${styles.detailsSummary} ${styles.focusable}`}>Show more changes</summary>
                  <ul className={`${styles.bulletList} mt-3`}>
                    {hiddenImpact.map((item, idx) => (
                      <li key={`${item}-${idx}`} className={styles.bulletItem}>
                        <span className={styles.bulletDot} aria-hidden />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </section>

            <section className={styles.subSection}>
              <h4 className={styles.subSectionTitle}>Top Stories</h4>
              {activeBriefView?.topStories?.length ? (
                <div className={styles.listStack}>
                  {activeBriefView.topStories.map((story, idx) => (
                    <ListRow
                      key={`${story.url}-${idx}`}
                      title={story.title}
                      href={story.url}
                      meta={`${story.sourceName ?? "source"} · ${shortDate(story.publishedAt)}`}
                      note={story.categoryImportance ?? story.briefContent}
                      className={styles.listRow}
                      titleClassName={styles.rowTitle}
                      metaClassName={styles.rowMeta}
                      noteClassName={styles.rowNote}
                    />
                  ))}
                </div>
              ) : (
                <p className={styles.emptyState}>Top stories will populate after the next published run.</p>
              )}
            </section>

            {activeBrief ? (
              <div className="mt-5">
                <Link href={`/brief/${activeBrief.postId}`} className={`btn-secondary text-sm ${styles.focusable}`}>
                  Open Full Brief
                </Link>
              </div>
            ) : null}
          </DashboardCard>

          <DashboardCard
            title="Latest Portfolio News"
            subtitle="Scoped to this category’s configured sources and query terms."
            className={styles.card}
            headerClassName={styles.cardHeader}
            bodyClassName={styles.cardBody}
          >
            {visibleNews.length > 0 ? (
              <div className={styles.listStack}>
                {visibleNews.map((article) => (
                  <ListRow
                    key={article.url}
                    title={article.title}
                    href={article.url}
                    meta={`${article.source} · ${shortDate(article.publishedAt)} · ${article.region}`}
                    note={article.summary}
                    className={styles.listRow}
                    titleClassName={styles.rowTitle}
                    metaClassName={styles.rowMeta}
                    noteClassName={styles.rowNote}
                  />
                ))}
              </div>
            ) : (
              <p className={styles.emptyState}>News feed refresh in progress. Check back in the next run cycle.</p>
            )}

            {hiddenNews.length > 0 ? (
              <details className={styles.details}>
                <summary className={`${styles.detailsSummary} ${styles.focusable}`}>Show more news</summary>
                <div className={`${styles.listStack} mt-3`}>
                  {hiddenNews.map((article) => (
                    <ListRow
                      key={article.url}
                      title={article.title}
                      href={article.url}
                      meta={`${article.source} · ${shortDate(article.publishedAt)} · ${article.region}`}
                      note={article.summary}
                      className={styles.listRow}
                      titleClassName={styles.rowTitle}
                      metaClassName={styles.rowMeta}
                      noteClassName={styles.rowNote}
                    />
                  ))}
                </div>
              </details>
            ) : null}
          </DashboardCard>
        </div>

        <aside className={styles.railColumn}>
          <DashboardCard
            title="Possible Actions"
            subtitle="Current execution priorities from the latest brief signal set."
            className={styles.card}
            headerClassName={styles.cardHeader}
            bodyClassName={styles.cardBody}
          >
            <ol className={styles.actionsList}>
              {visibleActions.map((item, idx) => (
                <li key={`${item}-${idx}`} className={styles.actionItem}>
                  {item}
                </li>
              ))}
            </ol>
            {hiddenActions.length > 0 ? (
              <details className={styles.details}>
                <summary className={`${styles.detailsSummary} ${styles.focusable}`}>Show more actions</summary>
                <ol className={`${styles.actionsList} mt-3`} start={visibleActions.length + 1}>
                  {hiddenActions.map((item, idx) => (
                    <li key={`${item}-${idx}`} className={styles.actionItem}>
                      {item}
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}
          </DashboardCard>

          <DashboardCard
            title="Daily Briefs"
            subtitle="Recent published briefs for this portfolio."
            className={styles.card}
            headerClassName={styles.cardHeader}
            bodyClassName={styles.cardBody}
          >
            <div className={styles.listStack}>
              {visibleBriefs.map((brief) => (
                <ListRow
                  key={brief.postId}
                  title={brief.title}
                  href={`/brief/${brief.postId}`}
                  external={false}
                  meta={`${regionBadge(brief)} · ${regionLabel(brief.region)} · ${shortDate(brief.publishedAt)}`}
                  note={sanitizeInsightText(brief.summary)}
                  className={styles.listRow}
                  titleClassName={styles.rowTitle}
                  metaClassName={styles.rowMeta}
                  noteClassName={styles.rowNote}
                />
              ))}
            </div>
            {hiddenBriefs.length > 0 ? (
              <details className={styles.details}>
                <summary className={`${styles.detailsSummary} ${styles.focusable}`}>Show more briefs</summary>
                <div className={`${styles.listStack} mt-3`}>
                  {hiddenBriefs.map((brief) => (
                    <ListRow
                      key={brief.postId}
                      title={brief.title}
                      href={`/brief/${brief.postId}`}
                      external={false}
                      meta={`${regionBadge(brief)} · ${regionLabel(brief.region)} · ${shortDate(brief.publishedAt)}`}
                      note={sanitizeInsightText(brief.summary)}
                      className={styles.listRow}
                      titleClassName={styles.rowTitle}
                      metaClassName={styles.rowMeta}
                      noteClassName={styles.rowNote}
                    />
                  ))}
                </div>
              </details>
            ) : null}
          </DashboardCard>

          <DashboardCard
            title="Market Indices"
            subtitle="Compact market snapshot for this category."
            className={styles.card}
            headerClassName={styles.cardHeader}
            bodyClassName={styles.cardBody}
          >
            <PortfolioMarketTicker portfolio={portfolio} variant="grid" limit={4} showHeader={false} />
          </DashboardCard>
        </aside>

        <div className={styles.fullWidth}>
          <DashboardCard
            title="Sources"
            subtitle="Source set attached to the active regional brief."
            className={styles.card}
            headerClassName={styles.cardHeader}
            bodyClassName={styles.cardBody}
          >
            {visibleSources.length > 0 ? (
              <ul className={styles.sourcesGrid}>
                {visibleSources.map((source) => (
                  <li key={source.url} className={styles.sourceItem}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={`${styles.sourceLink} ${styles.focusable}`}
                    >
                      {source.title}
                    </a>
                    <p className={styles.sourceMeta}>
                      {sourceLabelFromUrl(source.url)} · {shortDate(source.publishedAt ?? source.retrievedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyState}>No source list is available for the selected regional brief yet.</p>
            )}

            {hiddenSources.length > 0 ? (
              <details className={styles.details}>
                <summary className={`${styles.detailsSummary} ${styles.focusable}`}>Show more sources</summary>
                <ul className={`${styles.sourcesGrid} mt-3`}>
                  {hiddenSources.map((source) => (
                    <li key={source.url} className={styles.sourceItem}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={`${styles.sourceLink} ${styles.focusable}`}
                      >
                        {source.title}
                      </a>
                      <p className={styles.sourceMeta}>
                        {sourceLabelFromUrl(source.url)} · {shortDate(source.publishedAt ?? source.retrievedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </DashboardCard>
        </div>
      </main>
    </div>
  );
}
