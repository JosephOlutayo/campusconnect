import { prisma } from "@/lib/prisma";

/**
 * Loads a thread only if the requester is one of its two participants, and
 * returns which side they are. Every messaging read/write funnels through this
 * so a conversation id alone is never enough to see someone else's DMs.
 */
export async function loadConversationFor(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      customer: { select: { id: true, name: true, avatarSeed: true } },
      provider: {
        select: {
          id: true,
          businessName: true,
          userId: true,
          user: { select: { id: true, name: true, avatarSeed: true } },
        },
      },
    },
  });

  if (!conversation) return null;

  const isCustomer = conversation.customerId === userId;
  const isProvider = conversation.provider.userId === userId;
  if (!isCustomer && !isProvider) return null;

  return {
    conversation,
    isCustomer,
    /** The person on the other end, already shaped for the header. */
    counterpart: isCustomer
      ? {
          id: conversation.provider.userId,
          name: conversation.provider.businessName,
          avatarSeed: conversation.provider.user.avatarSeed,
          href: `/providers/${conversation.provider.id}`,
        }
      : {
          id: conversation.customer.id,
          name: conversation.customer.name,
          avatarSeed: conversation.customer.avatarSeed,
          href: `/messages/${conversation.id}`,
        },
  };
}

/** Threads for either side of the account, newest activity first. */
export async function listConversations(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ customerId: userId }, { provider: { userId } }] },
    include: {
      customer: { select: { id: true, name: true, avatarSeed: true } },
      provider: {
        select: {
          id: true,
          businessName: true,
          userId: true,
          user: { select: { avatarSeed: true } },
        },
      },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: { where: { readAt: null, senderId: { not: userId } } } } },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  return conversations.map((conversation) => {
    const isCustomer = conversation.customerId === userId;
    return {
      id: conversation.id,
      name: isCustomer ? conversation.provider.businessName : conversation.customer.name,
      avatarSeed: isCustomer
        ? conversation.provider.user.avatarSeed
        : conversation.customer.avatarSeed,
      lastMessage: conversation.messages[0]?.body ?? "",
      lastMessageAt: conversation.messages[0]?.createdAt ?? conversation.lastMessageAt,
      unread: conversation._count.messages,
      providerId: conversation.provider.id,
    };
  });
}

export async function markThreadRead(conversationId: string, userId: string) {
  await prisma.message.updateMany({
    where: { conversationId, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });
}
