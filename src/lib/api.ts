import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

/**
 * Server-side client for the Java API.
 *
 * Server components call this directly (no proxy hop); browser code goes through
 * the /api/[...path] proxy instead. Both end up at the same Spring endpoints
 * carrying the same cc_token cookie.
 */

export const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8080";

/** The envelope every Java endpoint returns. */
type Envelope<T> = { ok: boolean; data?: T; error?: string };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Forwards the browser's session cookie so the API sees the same user the page
 * does. Without this every server-rendered page would look signed out.
 */
async function authHeaders(): Promise<HeadersInit> {
  const store = await cookies();
  const token = store.get("cc_token")?.value;
  return token ? { cookie: `cc_token=${token}` } : {};
}

type FetchOptions = {
  method?: string;
  body?: unknown;
  /** Marketplace data changes constantly; nothing here is cached by default. */
  cache?: RequestCache;
};

async function request<T>(path: string, options: FetchOptions = {}): Promise<Envelope<T> & { status: number }> {
  const headers: Record<string, string> = { ...(await authHeaders()) } as Record<string, string>;
  if (options.body !== undefined) headers["content-type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: options.cache ?? "no-store",
    });
  } catch {
    throw new ApiError(
      "Could not reach the API. Start it with `mvn spring-boot:run` in api/.",
      503,
    );
  }

  let payload: Envelope<T>;
  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    payload = { ok: false, error: `Unexpected ${response.status} from the API.` };
  }

  return { ...payload, status: response.status };
}

/** Throws on failure — use when the page cannot render without the data. */
export async function apiGet<T>(path: string): Promise<T> {
  const result = await request<T>(path);
  if (!result.ok || result.data === undefined) {
    throw new ApiError(result.error ?? "Request failed.", result.status);
  }
  return result.data;
}

/**
 * Returns null instead of throwing. For data a page can render without —
 * a signed-out visitor's bookings, an optional panel.
 */
export async function apiGetOrNull<T>(path: string): Promise<T | null> {
  try {
    const result = await request<T>(path);
    return result.ok && result.data !== undefined ? result.data : null;
  } catch {
    return null;
  }
}

/** Distinguishes "not found" from "broken", so pages can call notFound(). */
export async function apiGetOptional<T>(
  path: string,
): Promise<{ data: T | null; notFound: boolean }> {
  const result = await request<T>(path);
  if (result.ok && result.data !== undefined) return { data: result.data, notFound: false };
  return { data: null, notFound: result.status === 404 };
}

export async function apiSend<T>(
  path: string,
  method: string,
  body?: unknown,
): Promise<Envelope<T> & { status: number }> {
  return request<T>(path, { method, body });
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "STUDENT" | "PROVIDER" | "ADMIN";
  avatarSeed: string;
  bio: string | null;
  phone: string | null;
  universityId: string | null;
  universityName: string | null;
  universityShortName: string | null;
  studentVerified: boolean;
  providerProfileId: string | null;
  providerBusinessName: string | null;
};

/**
 * The signed-in user, or null.
 *
 * Wrapped in React's cache() so the many components that ask (shell, nav badges,
 * page body) cost exactly one API call per render.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  return apiGetOrNull<SessionUser>("/api/auth/me");
});
