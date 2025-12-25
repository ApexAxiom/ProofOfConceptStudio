import { NextRequest, NextResponse } from "next/server";

const CACHE_MAX_AGE = 60 * 60 * 24; // 24 hours

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  // Validate URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: parsedUrl.origin,
    };

    const attempt = async (omitReferer = false) => {
      const attemptHeaders = omitReferer ? { ...headers } : headers;
      if (omitReferer) {
        delete (attemptHeaders as any).Referer;
      }
      return fetch(url, {
        headers: attemptHeaders,
        next: { revalidate: CACHE_MAX_AGE },
      });
    };

    let response = await attempt();

    if (!response.ok && (response.status === 403 || response.status === 404)) {
      response = await attempt(true);
    }

    if (!response.ok) {
      return new NextResponse("Failed to fetch image", { status: response.status });
    }

    const contentType = response.headers.get("content-type");
    
    // Validate that response is actually an image
    if (!contentType || !contentType.startsWith("image/")) {
      return new NextResponse("Not an image", { status: 400 });
    }

    const imageBuffer = await response.arrayBuffer();

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_MAX_AGE * 2}`,
        "X-Proxy-Cache": "HIT",
      },
    });
  } catch (error) {
    console.error("Image proxy error:", error);
    return new NextResponse("Failed to fetch image", { status: 500 });
  }
}
