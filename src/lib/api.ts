import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { BookingError } from "@/lib/booking";
import { ReviewError } from "@/lib/reviews";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

/**
 * One error funnel for every route handler. Domain errors carry their own
 * status; anything unexpected is logged server-side and returned as a generic
 * 500 so internals never leak to the client.
 */
export function handleError(error: unknown) {
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return fail(first?.message ?? "Invalid input.", 422, {
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  if (error instanceof ApiError || error instanceof BookingError || error instanceof ReviewError) {
    return fail(error.message, error.status);
  }
  console.error("[api]", error);
  return fail("Something went wrong. Please try again.", 500);
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError("Expected a JSON body.", 400);
  }
}
