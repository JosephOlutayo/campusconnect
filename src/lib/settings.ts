import { prisma } from "@/lib/prisma";
import { SETTING_KEYS } from "@/lib/constants";
import { DEFAULT_PLATFORM_FEE_PERCENT } from "@/lib/money";

/**
 * Admin-tunable platform config. Reads fall back to the .env default so a fresh
 * database still behaves sensibly before anyone visits the settings screen.
 */
export async function getSetting(key: string, fallback: string): Promise<string> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getPlatformFeePercent(): Promise<number> {
  const raw = await getSetting(
    SETTING_KEYS.platformFeePercent,
    String(DEFAULT_PLATFORM_FEE_PERCENT),
  );
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return DEFAULT_PLATFORM_FEE_PERCENT;
  }
  return parsed;
}

export async function getProviderAutoApprove(): Promise<boolean> {
  return (await getSetting(SETTING_KEYS.providerAutoApprove, "true")) === "true";
}
