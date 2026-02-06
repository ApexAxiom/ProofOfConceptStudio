import crypto from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const DEFAULT_TIMEOUT_MS = Number(process.env.BRIEF_IMAGE_FETCH_TIMEOUT_MS ?? 6000);
const DEFAULT_MAX_BYTES = Number(process.env.BRIEF_IMAGE_MAX_BYTES ?? 5 * 1024 * 1024);

const s3Clients = new Map<string, S3Client>();

function s3ClientForRegion(region: string): S3Client {
  const key = region.trim().toLowerCase();
  const cached = s3Clients.get(key);
  if (cached) return cached;
  const next = new S3Client({ region });
  s3Clients.set(key, next);
  return next;
}

function normalizeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function extensionForContentType(contentType: string): string {
  const normalized = contentType.toLowerCase().split(";")[0].trim();
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/svg+xml") return "svg";
  if (normalized === "image/gif") return "gif";
  if (normalized === "image/avif") return "avif";
  return "jpg";
}

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function readBodyWithLimit(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error(`image exceeds max bytes (${declaredLength} > ${maxBytes})`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const fallback = new Uint8Array(await response.arrayBuffer());
    if (fallback.byteLength > maxBytes) {
      throw new Error(`image exceeds max bytes (${fallback.byteLength} > ${maxBytes})`);
    }
    return fallback;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      throw new Error(`image exceeds max bytes (${total} > ${maxBytes})`);
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

export async function cacheHeroImageToS3(params: {
  ogImageUrl?: string;
  categorySlug: string;
  region: string;
  publishedDateISO: string;
  articleIndex: number;
  bucket: string;
  bucketRegion: string;
  publicBaseUrl: string;
}): Promise<{ url: string; cacheKey: string; contentType: string } | null> {
  const ogImageUrl = params.ogImageUrl?.trim();
  if (!ogImageUrl || !/^https?:\/\//i.test(ogImageUrl)) return null;

  const timeoutMs = Number.isFinite(DEFAULT_TIMEOUT_MS) && DEFAULT_TIMEOUT_MS > 0 ? DEFAULT_TIMEOUT_MS : 6000;
  const maxBytes = Number.isFinite(DEFAULT_MAX_BYTES) && DEFAULT_MAX_BYTES > 0 ? DEFAULT_MAX_BYTES : 5 * 1024 * 1024;

  const publishedDate = new Date(params.publishedDateISO);
  if (Number.isNaN(publishedDate.getTime())) return null;
  const yyyyMmDd = publishedDate.toISOString().slice(0, 10);

  const urlHash = sha256Hex(ogImageUrl);
  const categorySlug = normalizeSlug(params.categorySlug);
  const regionSlug = normalizeSlug(params.region);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(ogImageUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "POCStudioBriefRunner/1.0",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
      }
    });

    if (!response.ok) {
      throw new Error(`image fetch failed (${response.status})`);
    }

    const contentType = response.headers.get("content-type")?.toLowerCase().split(";")[0].trim() ?? "";
    if (!contentType.startsWith("image/")) {
      throw new Error(`invalid image content-type: ${contentType || "unknown"}`);
    }

    const extension = extensionForContentType(contentType);
    const cacheKey = `brief-hero/${categorySlug}/${regionSlug}/${yyyyMmDd}/${params.articleIndex}-${urlHash}.${extension}`;
    const bytes = await readBodyWithLimit(response, maxBytes);

    const client = s3ClientForRegion(params.bucketRegion);
    await client.send(
      new PutObjectCommand({
        Bucket: params.bucket,
        Key: cacheKey,
        Body: bytes,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable"
      })
    );

    const publicBase = params.publicBaseUrl.replace(/\/$/, "");
    return {
      url: `${publicBase}/${cacheKey}`,
      cacheKey,
      contentType
    };
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "hero_image_cache_failed",
        url: ogImageUrl,
        reason: (error as Error).message
      })
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

