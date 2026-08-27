import { handleError, ok, readJson } from "@/lib/api";
import { apiProvider } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { availabilitySchema } from "@/lib/validation";

export async function GET() {
  try {
    const { providerId } = await apiProvider();
    const rules = await prisma.availabilityRule.findMany({
      where: { providerId },
      orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
    });
    return ok({ rules });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * The weekly schedule is replaced wholesale rather than diffed — the editor
 * always sends the complete week, so a delete-then-insert inside one
 * transaction is both simpler and impossible to leave half-applied.
 */
export async function PUT(request: Request) {
  try {
    const { providerId } = await apiProvider();
    const body = availabilitySchema.parse(await readJson(request));

    await prisma.$transaction(async (tx) => {
      await tx.availabilityRule.deleteMany({ where: { providerId } });
      if (body.rules.length > 0) {
        await tx.availabilityRule.createMany({
          data: body.rules.map((rule) => ({ ...rule, providerId })),
        });
      }
    });

    return ok({ saved: true, windows: body.rules.length });
  } catch (error) {
    return handleError(error);
  }
}
