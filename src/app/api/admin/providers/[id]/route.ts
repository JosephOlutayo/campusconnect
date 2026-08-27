import { ApiError, handleError, ok, readJson } from "@/lib/api";
import { apiAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";

type Body = {
  action: "approve" | "reject" | "suspend" | "reinstate" | "verify" | "unverify";
  note?: string;
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await apiAdmin();
    const { id } = await context.params;
    const body = await readJson<Body>(request);

    const provider = await prisma.providerProfile.findUnique({
      where: { id },
      select: { id: true, userId: true, businessName: true },
    });
    if (!provider) throw new ApiError("Provider not found.", 404);

    switch (body.action) {
      case "approve":
        await prisma.providerProfile.update({ where: { id }, data: { status: "ACTIVE" } });
        await notify({
          userId: provider.userId,
          type: "PROVIDER_APPROVED",
          title: "You are live",
          body: `${provider.businessName} is now visible to students on your campus.`,
          href: "/provider",
        });
        break;
      case "reject":
        await prisma.providerProfile.update({ where: { id }, data: { status: "REJECTED" } });
        await notify({
          userId: provider.userId,
          type: "PROVIDER_REJECTED",
          title: "Listing not approved",
          body: body.note?.trim() || "Your provider listing was not approved.",
          href: "/provider/settings",
        });
        break;
      case "suspend":
        await prisma.providerProfile.update({ where: { id }, data: { status: "SUSPENDED" } });
        break;
      case "reinstate":
        await prisma.providerProfile.update({ where: { id }, data: { status: "ACTIVE" } });
        break;
      case "verify":
        await prisma.providerProfile.update({ where: { id }, data: { isVerified: true } });
        break;
      case "unverify":
        await prisma.providerProfile.update({ where: { id }, data: { isVerified: false } });
        break;
      default:
        throw new ApiError("Unknown action.", 422);
    }

    return ok({ updated: true });
  } catch (error) {
    return handleError(error);
  }
}
