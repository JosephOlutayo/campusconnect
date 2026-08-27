import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

/**
 * Maps an email address to a campus using the UniversityEmailDomain table.
 * Domains are data because universities do not agree on a convention —
 * utdallas.edu, mavs.uta.edu, my.unt.edu are all "the student domain".
 */
export async function matchUniversityByEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;

  const record = await prisma.universityEmailDomain.findUnique({
    where: { domain },
    include: { university: true },
  });
  return record?.university ?? null;
}

export type IssuedToken = { token: string; expiresAt: Date };

/**
 * Issues a single-use verification token.
 *
 * EMAIL DELIVERY: no transactional mail provider is wired up yet, so the token
 * is returned to the caller and surfaced in the UI as a clickable dev link.
 * When Resend/SES/Postmark is added, send it instead of returning it — the
 * consume path below does not change.
 */
export async function issueToken(
  userId: string,
  purpose: "EMAIL_VERIFY" | "STUDENT_VERIFY" | "PASSWORD_RESET",
  payload?: string,
  ttlMinutes = 60 * 24,
): Promise<IssuedToken> {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

  // Only one live token per purpose per user.
  await prisma.verificationToken.deleteMany({ where: { userId, purpose, usedAt: null } });
  await prisma.verificationToken.create({
    data: { userId, purpose, token, payload: payload ?? null, expiresAt },
  });

  return { token, expiresAt };
}

export async function consumeToken(token: string, purpose: string) {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || record.purpose !== purpose) return null;
  if (record.usedAt) return null;
  if (record.expiresAt < new Date()) return null;

  await prisma.verificationToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return record;
}
