import { ApiError, handleError, ok, readJson } from "@/lib/api";
import { apiAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

type Body = { action: "resolve" | "dismiss" | "reviewing"; note?: string };

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await apiAdmin();
    const { id } = await context.params;
    const body = await readJson<Body>(request);

    const statusMap = {
      resolve: "RESOLVED",
      dismiss: "DISMISSED",
      reviewing: "REVIEWING",
    } as const;

    const status = statusMap[body.action];
    if (!status) throw new ApiError("Unknown action.", 422);

    await prisma.report.update({
      where: { id },
      data: {
        status,
        resolutionNote: body.note?.trim() || null,
        resolvedAt: status === "REVIEWING" ? null : new Date(),
      },
    });

    return ok({ updated: true });
  } catch (error) {
    return handleError(error);
  }
}
