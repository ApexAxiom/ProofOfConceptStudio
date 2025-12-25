import { request } from "undici";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9"
};

function resolveUrl(href: string, baseUrl: string): string | null {
  if (!href) return null;
  if (href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) return null;
  try {
    const resolved = new URL(href, baseUrl);
    if (resolved.protocol === "http:") {
      resolved.protocol = "https:";
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

/**
 * Checks if an image URL is likely to be a good hero image
 */
function isValidHeroImage(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  
  // Skip common non-content images
  const skipPatterns = [
    "logo", "icon", "favicon", "avatar", "profile",
    "button", "sprite", "spacer", "pixel", "tracking",
    "advertisement", "ad-", "-ad.", "banner",
    "1x1", "1px", "transparent", "blank"
  ];
  
  if (skipPatterns.some((pattern) => lower.includes(pattern))) {
    return false;
  }
  
  // Must be https for security
  if (!url.startsWith("https://")) {
    return false;
  }

  const blockedExtensions = [".svg", ".gif"];
  if (blockedExtensions.some((ext) => lower.includes(ext))) {
    return false;
  }

  // Must be an image format or contain common image hints
  const imageExtensions = [".jpg", ".jpeg", ".png", ".webp"];
  const hasImageExtension = imageExtensions.some((ext) => lower.includes(ext));
  const hasImageParams = lower.includes("image") || lower.includes("photo") || lower.includes("media") || lower.includes("upload");

  return hasImageExtension || hasImageParams || lower.includes("/wp-content/uploads/");
}

/**
 * Extracts the best available image from an article page
 */
function extractBestImage(document: Document, url: string): string | undefined {
  const candidates: string[] = [];
  
  // Priority 1: OpenGraph image (most reliable)
  const ogImage = 
    document.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
    document.querySelector('meta[property="og:image:url"]')?.getAttribute("content") ||
    document.querySelector('meta[property="og:image:secure_url"]')?.getAttribute("content");
  
  if (ogImage) {
    const resolved = resolveUrl(ogImage, url);
    if (resolved && isValidHeroImage(resolved)) {
      candidates.push(resolved);
    }
  }
  
  // Priority 2: Twitter card image
  const twitterImage = 
    document.querySelector('meta[name="twitter:image"]')?.getAttribute("content") ||
    document.querySelector('meta[name="twitter:image:src"]')?.getAttribute("content");
  
  if (twitterImage) {
    const resolved = resolveUrl(twitterImage, url);
    if (resolved && isValidHeroImage(resolved)) {
      candidates.push(resolved);
    }
  }
  
  // Priority 3: Schema.org image
  const schemaScript = document.querySelector('script[type="application/ld+json"]');
  if (schemaScript) {
    try {
      const schema = JSON.parse(schemaScript.textContent || "{}");
      const schemaImage = schema.image?.url || schema.image || schema.thumbnailUrl;
      if (schemaImage) {
        const imgUrl = Array.isArray(schemaImage) ? schemaImage[0] : schemaImage;
        const resolved = resolveUrl(typeof imgUrl === "string" ? imgUrl : imgUrl?.url, url);
        if (resolved && isValidHeroImage(resolved)) {
          candidates.push(resolved);
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  }
  
  // Priority 4: Article featured image
  const articleImage = 
    document.querySelector("article img")?.getAttribute("src") ||
    document.querySelector(".post-thumbnail img")?.getAttribute("src") ||
    document.querySelector(".featured-image img")?.getAttribute("src") ||
    document.querySelector(".hero-image img")?.getAttribute("src") ||
    document.querySelector("[itemprop='image']")?.getAttribute("src") ||
    document.querySelector(".entry-content img")?.getAttribute("src");
  
  if (articleImage) {
    const resolved = resolveUrl(articleImage, url);
    if (resolved && isValidHeroImage(resolved)) {
      candidates.push(resolved);
    }
  }
  
  // Priority 5: First large image in content
  const allImages = Array.from(document.querySelectorAll("img"));
  for (const img of allImages) {
    const src = img.getAttribute("src");
    const width = parseInt(img.getAttribute("width") || "0", 10);
    const height = parseInt(img.getAttribute("height") || "0", 10);
    
    // Skip small images (likely icons/logos)
    if (width > 0 && width < 200) continue;
    if (height > 0 && height < 150) continue;
    
    if (src) {
      const resolved = resolveUrl(src, url);
      if (resolved && isValidHeroImage(resolved)) {
        candidates.push(resolved);
        break; // Only take the first valid large image
      }
    }
  }
  
  // Return the first valid candidate (highest priority)
  return candidates[0];
}

/**
 * Extracts the publication/source name from the page
 */
function extractSourceName(document: Document, url: string): string | undefined {
  // Try meta tags first
  const siteName = 
    document.querySelector('meta[property="og:site_name"]')?.getAttribute("content") ||
    document.querySelector('meta[name="application-name"]')?.getAttribute("content");
  
  if (siteName) return siteName;
  
  // Fall back to domain name
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    // Capitalize first letter of each word
    return hostname.split(".")[0].replace(/^\w/, (c) => c.toUpperCase());
  } catch {
    return undefined;
  }
}

export async function shallowScrape(url: string, limit = 30): Promise<{ title: string; url: string }[]> {
  const res = await request(url, { method: "GET", headers: BROWSER_HEADERS });
  const text = await res.body.text();
  const dom = new JSDOM(text, { url });
  const baseHost = new URL(url).hostname;
  const anchors = Array.from(dom.window.document.querySelectorAll("a")) as unknown as HTMLAnchorElement[];
  const links = anchors
    .map((a) => {
      const resolved = resolveUrl(a.getAttribute("href") ?? "", url);
      return {
        title: (a.textContent ?? "").trim(),
        url: resolved
      };
    })
    .filter((l): l is { title: string; url: string } => typeof l.url === "string" && l.url.startsWith("http"))
    .filter((l) => {
      try {
        const host = new URL(l.url).hostname;
        return host.endsWith(baseHost);
      } catch {
        return false;
      }
    });
  const deduped = Array.from(new Map(links.map((l) => [l.url, l])).values());
  return deduped.slice(0, limit);
}

export interface ArticleDetails {
  url: string;
  title: string;
  content: string;
  ogImageUrl?: string;
  publishedAt?: string;
  description?: string;
  sourceName?: string;
}

export async function fetchArticleDetails(url: string): Promise<ArticleDetails> {
  try {
    const res = await request(url, {
      method: "GET",
      headers: BROWSER_HEADERS,
      maxRedirections: 3,
      bodyTimeout: 15000
    });
    const html = await res.body.text();
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;
    const reader = new Readability(document);
    const article = reader.parse();
    
    // Extract the best image using our enhanced function
    const bestImage = extractBestImage(document, url);
    
    // Extract publication date
    const publishedAt = 
      document.querySelector('meta[property="article:published_time"]')?.getAttribute("content") ||
      document.querySelector('meta[name="pubdate"]')?.getAttribute("content") ||
      document.querySelector('meta[name="date"]')?.getAttribute("content") ||
      document.querySelector('time[datetime]')?.getAttribute("datetime") ||
      undefined;
    
    // Extract description
    const description = 
      document.querySelector('meta[name="description"]')?.getAttribute("content") ||
      document.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
      undefined;
    
    // Extract source name
    const sourceName = extractSourceName(document, url);
    
    return {
      url, // Preserve the exact original URL
      title: article?.title || document.title || url,
      content: article?.textContent || "",
      ogImageUrl: bestImage,
      publishedAt,
      description,
      sourceName
    };
  } catch (error) {
    console.error(`Failed to fetch article details for ${url}:`, error);
    return {
      url, // Always preserve the original URL even on error
      title: url,
      content: ""
    };
  }
}
