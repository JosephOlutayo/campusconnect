import { getSessionUser } from "@/lib/auth";
import { ApiError, handleError, ok, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { messageSchema } from "@/lib/validation";
import { loadConversationFor, markThreadRead } from "@/lib/messaging";
import { notify } from "@/lib/notifications";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Sign in first.", 401);

    const { id } = await context.params;
    const thread = await loadConversationFor(id, user.id);
    if (!thread) throw new ApiError("Conversation not found.", 404);

    const url = new URL(request.url);
    const after = url.searchParams.get("after");

    const messages = await prisma.message.findMany({
      where: { conversationId: id, ...(after ? { createdAt: { gt: new Date(after) } } : {}) },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        id: true,
        body: true,
        senderId: true,
        imageSeed: true,
        appointmentId: true,
        createdAt: true,
        readAt: true,
      },
    });

    await markThreadRead(id, user.id);
    return ok({ messages, viewerId: user.id });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Sign in first.", 401);

    const { id } = await context.params;
    const thread = await loadConversationFor(id, user.id);
    if (!thread) throw new ApiError("Conversation not found.", 404);

    const body = messageSchema.parse(await readJson(request));

    const message = await prisma.message.create({
      data: {
        conversationId: id,
        senderId: user.id,
        body: body.body,
        imageSeed: body.imageSeed ?? null,
        appointmentId: body.appointmentId ?? null,
      },
      select: { id: true, body: true, senderId: true, createdAt: true, imageSeed: true },
    });

    await prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: message.createdAt },
    });

    await notify({
      userId: thread.counterpart.id,
      type: "MESSAGE_RECEIVED",
      title: `Message from ${user.name}`,
      body: body.body.slice(0, 120),
      href: `/messages/${id}`,
    });

    return ok({ message }, 201);
  } catch (error) {
    return handleError(error);
  }
}
