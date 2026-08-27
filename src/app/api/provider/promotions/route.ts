import { ApiError, handleError, ok, readJson } from "@/lib/api";
import { apiProvider } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { promotionSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const { providerId } = await apiProvider();
    const body = promotionSchema.parse(await readJson(request));

    if (body.endsAt <= body.startsAt) throw new ApiError("The promo must end after it starts.", 422);
    if (body.discountType === "PERCENT" && body.discountValue > 90) {
      throw new ApiError("Percentage discounts cap at 90%.", 422);
    }

    const existing = await prisma.promotion.findUnique({
      where: { providerId_code: { providerId, code: body.code } },
    });
    if (existing) throw new ApiError("You already have a promo with that code.", 409);

    const promotion = await prisma.promotion.create({
      data: {
        providerId,
        code: body.code,
        description: body.description,
        discountType: body.discountType,
        // Percent promos store points; amount promos store cents.
        discountValue:
          body.discountType === "PERCENT" ? body.discountValue : body.discountValue * 100,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        maxRedemptions: body.maxRedemptions ?? null,
      },
    });

    return ok({ id: promotion.id }, 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { providerId } = await apiProvider();
    const { id } = await readJson<{ id: string }>(request);
    await prisma.promotion.updateMany({ where: { id, providerId }, data: { isActive: false } });
    return ok({ deactivated: true });
  } catch (error) {
    return handleError(error);
  }
}
