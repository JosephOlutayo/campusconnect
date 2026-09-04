import { NextRequest } from "next/server";

import { API_BASE_URL } from "@/lib/api";

/**
 * Transparent proxy from the Next.js origin to the Java API.
 *
 * Why proxy instead of pointing the browser straight at :8080:
 *   - every client component keeps its relative `/api/...` path, so swapping the
 *     backend touched none of them
 *   - no CORS, in development or production
 *   - the session cookie stays first-party, which keeps it working under
 *     browsers that block third-party cookies
 *
 * This forwards the method, body, content type and cookies onward, and passes
 * Set-Cookie back so login and logout still control the browser's session.
 */

// Hop-by-hop headers, plus ones the fetch layer must recompute for itself.
const STRIPPED = new Set([
  "host",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "accept-encoding",
]);

async function forward(request: NextRequest, path: string[]) {
  const url = new URL(request.url);
  const target = `${API_BASE_URL}/api/${path.join("/")}${url.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIPPED.has(key.toLowerCase())) headers.set(key, value);
  });

  const hasBody = !["GET", "HEAD"].includes(request.method);
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    // The API being down should read as a clean API error, not a Next.js crash.
    return Response.json(
      { ok: false, error: "The API is not reachable. Is the Java server running on :8080?" },
      { status: 503 },
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "content-encoding" || lower === "content-length" || lower === "transfer-encoding") {
      return;
    }
    responseHeaders.set(key, value);
  });

  // getSetCookie preserves multiple Set-Cookie headers, which a plain get() collapses.
  const cookies = upstream.headers.getSetCookie?.() ?? [];
  if (cookies.length > 0) {
    responseHeaders.delete("set-cookie");
    for (const cookie of cookies) responseHeaders.append("set-cookie", cookie);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function POST(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function PUT(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function PATCH(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function DELETE(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
