import type { Message, OutboundStatus, Timestamp, User, UUID } from "../types/index.js";

export function createOptimisticMessage(
  conversationId: UUID,
  clientTempId: UUID,
  sender: User,
  plaintext: string,
): Message {
  const now = new Date().toISOString() as Timestamp;
  return {
    messageId: clientTempId,
    clientTempId,
    conversationId,
    senderUserId: sender.userId,
    senderUsername: sender.username,
    senderDisplayName: sender.displayName,
    senderAvatarUrl: sender.avatarUrl,
    envelope: {
      ciphertext: "",
      nonce: "",
      algorithm: "aes-256-gcm",
      keyVersion: 1,
      clientMessageSeq: 0,
    },
    plaintext,
    outboundStatus: "pending_key",
    deliveredTo: [],
    readBy: [],
    createdAt: now,
  };
}

export function withOutboundStatus(message: Message, status: OutboundStatus): Message {
  return { ...message, outboundStatus: status };
}
