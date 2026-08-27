import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/constants";

const COOKIE_NAME = "cc_session";
const SESSION_DAYS = 30;

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Add a 32+ character random string to .env",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

/** Signs a session JWT and writes it as an httpOnly cookie. */
export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

async function readUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    // Expired or tampered — treat as signed out rather than throwing.
    return null;
  }
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof loadSessionUser>>>;

async function loadSessionUser() {
  const userId = await readUserId();
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatarSeed: true,
      bio: true,
      phone: true,
      universityId: true,
      emailVerifiedAt: true,
      studentVerifiedAt: true,
      isSuspended: true,
      createdAt: true,
      university: { select: { id: true, name: true, shortName: true, slug: true, color: true } },
      providerProfile: {
        select: { id: true, businessName: true, status: true, isVerified: true },
      },
    },
  });

  if (!user || user.isSuspended) return null;
  return { ...user, role: user.role as Role };
}

/** Deduped for the lifetime of one request/render pass. */
export const getSessionUser = cache(loadSessionUser);

export async function requireUser(redirectTo = "/login") {
  const user = await getSessionUser();
  if (!user) redirect(`${redirectTo}?next=${encodeURIComponent("/dashboard")}`);
  return user;
}

export async function requireRole(role: Role, redirectTo = "/login") {
  const user = await requireUser(redirectTo);
  if (user.role !== role) redirect("/dashboard");
  return user;
}

/** Provider pages need both the role and an existing profile row. */
export async function requireProvider() {
  const user = await requireUser();
  if (!user.providerProfile) redirect("/provider/onboarding");
  return { user, providerId: user.providerProfile.id };
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
