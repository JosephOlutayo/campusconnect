import { getSessionUser } from "@/lib/auth";
import { ApiError, handleError, ok, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { startConversationSchema } from "@/lib/validation";
import { notify } from "@/lib/notifications";

/** Opens (or reuses) the thread between the signed-in student and a provider. */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Sign in to message providers.", 401);

    const body = startConversationSchema.parse(await readJson(request));

    const provider = await prisma.providerProfile.findUnique({
      where: { id: body.providerId },
      select: { id: true, userId: true, businessName: true },
    });
    if (!provider) throw new ApiError("Provider not found.", 404);
    if (provider.userId === user.id) throw new ApiError("You cannot message yourself.", 400);

    const blocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: provider.userId, blockedId: user.id },
          { blockerId: user.id, blockedId: provider.userId },
        ],
      },
      select: { id: true },
    });
    if (blocked) throw new ApiError("You cannot message this account.", 403);

    const conversation = await prisma.conversation.upsert({
      where: { customerId_providerId: { customerId: user.id, providerId: provider.id } },
      update: { lastMessageAt: new Date() },
      create: { customerId: user.id, providerId: provider.id },
    });

    await prisma.message.create({
      data: { conversationId: conversation.id, senderId: user.id, body: body.body.trim() },
    });

    await notify({
      userId: provider.userId,
      type: "MESSAGE_RECEIVED",
      title: `Message from ${user.name}`,
      body: body.body.slice(0, 120),
      href: `/messages/${conversation.id}`,
    });

    return ok({ id: conversation.id }, 201);
  } catch (error) {
    return handleError(error);
  }
}
