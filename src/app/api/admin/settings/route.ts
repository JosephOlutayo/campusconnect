import { handleError, ok, readJson } from "@/lib/api";
import { apiAdmin } from "@/lib/guards";
import { adminSettingsSchema } from "@/lib/validation";
import { setSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/constants";

/**
 * Changing the marketplace fee affects future bookings only — every existing
 * appointment carries its own fee snapshot, so historical payouts never move.
 */
export async function PATCH(request: Request) {
  try {
    await apiAdmin();
    const body = adminSettingsSchema.parse(await readJson(request));

    await setSetting(SETTING_KEYS.platformFeePercent, String(body.platformFeePercent));
    await setSetting(SETTING_KEYS.providerAutoApprove, String(body.providerAutoApprove));

    return ok({ updated: true });
  } catch (error) {
    return handleError(error);
  }
}
