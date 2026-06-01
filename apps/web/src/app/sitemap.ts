import type { MetadataRoute } from "next";
import { CATEGORY_META, PORTFOLIOS, REGION_LIST, categoryForPortfolio } from "@proof/shared";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://proofofconceptstudio.com";

function absoluteUrl(path: string) {
  return new URL(path, siteUrl).toString();
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const categoryPaths = Array.from(new Set(PORTFOLIOS.map((portfolio) => categoryForPortfolio(portfolio.slug)))).filter(
    (category) => Boolean(CATEGORY_META[category])
  );

  const paths = [
    "/",
    "/morning-scan",
    "/portfolios",
    "/watchlist",
    ...REGION_LIST.map((region) => `/${region.slug}`),
    ...REGION_LIST.map((region) => `/actions/${region.slug}`),
    ...PORTFOLIOS.map((portfolio) => `/portfolio/${portfolio.slug}`),
    ...REGION_LIST.flatMap((region) => PORTFOLIOS.map((portfolio) => `/${region.slug}/${portfolio.slug}`)),
    ...categoryPaths.map((category) => `/category/${category}`)
  ];

  return Array.from(new Set(paths)).map((path) => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency: path === "/" ? "hourly" : "daily",
    priority: path === "/" ? 1 : 0.7
  }));
}
