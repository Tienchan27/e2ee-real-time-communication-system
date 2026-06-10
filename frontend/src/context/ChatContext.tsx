import React, { createContext, useCallback, useEffect, useRef, useState } from "react";
import type {
  UUID,
  Conversation,
  Message,
  Presence,
} from "../types/index.js";
import { socketManager } from "../socket/manager.js";
import { cryptoManager } from "../crypto/manager.js";
import { generateUUID } from "../utils/uuid.js";
import { useAuth } from "./AuthContext.js";

interface ChatContextValue {
  conversations: Map<UUID, Conversation>;
  messages: Map<UUID, Message[]>;
  presences: Map<UUID, Presence>;
  currentConversationId: UUID | null;
  setCurrentConversationId: (id: UUID | null) => void;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: UUID) => Promise<void>;
  sendMessage: (conversationId: UUID, plaintext: string) => Promise<void>;
  subscribeToPresence: (userIds: UUID[]) => Promise<void>;
}

export const ChatContext = createContext<ChatContextValue | undefined>(
  undefined,
);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Map<UUID, Conversation>>(
    new Map(),
  );
  const [messages, setMessages] = useState<Map<UUID, Message[]>>(new Map());
  const [presences, setPresences] = useState<Map<UUID, Presence>>(new Map());
  const [currentConversationId, setCurrentConversationId] = useState<UUID | null>(
    null,
  );

  const messageSeqRef = useRef<Map<UUID, number>>(new Map());
  const subscribedUsersRef = useRef<Set<UUID>>(new Set());

  // Setup socket listeners
  useEffect(() => {
    if (!user) return;

    const unsubscribePresence = socketManager.onPresenceUpdate((presence) => {
      setPresences((prev) => new Map(prev).set(presence.userId, presence));
    });

    const unsubscribeMessage = socketManager.onChatMessage((message) => {
      setMessages((prev) => {
        const convoMessages = prev.get(message.conversationId) || [];
        const updated = new Map(prev);
        updated.set(
          message.conversationId,
          [...convoMessages, message],
        );
        return updated;
      });

      // Auto-decrypt if we have the key
      decryptMessage(message);
    });

    return () => {
      unsubscribePresence();
      unsubscribeMessage();
    };
  }, [user]);

  const decryptMessage = useCallback(async (message: Message) => {
    try {
      const key = cryptoManager.getKey(message.envelope.keyVersion);
      if (!key) return;

      const plaintext = await cryptoManager.decrypt(
        message.envelope.ciphertext,
        message.envelope.nonce,
        message.envelope.keyVersion,
        message.envelope.aad,
      );

      // Update message with decrypted plaintext
      message.plaintext = plaintext;
    } catch (err) {
      console.error("Failed to decrypt message:", err);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    if (!user) return;

    try {
      // Import apiClient here to avoid circular dependency
      const { apiClient } = await import("../api/client.js");
      const result = await apiClient.getConversations(50);

      const newConversations = new Map(conversations);
      for (const conv of result.conversations) {
        newConversations.set(conv.conversationId, conv);
      }
      setConversations(newConversations);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }, [user, conversations]);

  const loadMessages = useCallback(
    async (conversationId: UUID) => {
      if (!user) return;

      try {
        const { apiClient } = await import("../api/client.js");
        const result = await apiClient.getMessages(conversationId, 50);

        // Decrypt all messages
        for (const msg of result.messages) {
          await decryptMessage(msg);
        }

        setMessages((prev) => {
          const updated = new Map(prev);
          updated.set(conversationId, result.messages);
          return updated;
        });

        // Join conversation room on socket
        await socketManager.joinConversation(conversationId);
      } catch (err) {
        console.error("Failed to load messages:", err);
      }
    },
    [user, decryptMessage],
  );

  const sendMessage = useCallback(
    async (conversationId: UUID, plaintext: string) => {
      if (!user) return;

      try {
        // Get or initialize sequence number
        const currentSeq = messageSeqRef.current.get(conversationId) || 0;
        const clientMessageSeq = currentSeq + 1;
        messageSeqRef.current.set(conversationId, clientMessageSeq);

        // Encrypt message
        const encrypted = await cryptoManager.encrypt(plaintext, 1); // keyVersion = 1 for now
        const messageId = generateUUID() as UUID;

        // Send via socket
        await socketManager.sendMessage({
          conversationId,
          messageId,
          ciphertext: encrypted.ciphertext,
          nonce: encrypted.nonce,
          algorithm: "aes-256-gcm",
          keyVersion: 1,
          clientMessageSeq,
        });

        // Create local message for immediate UI update
        const localMessage: Message = {
          messageId,
          conversationId,
          senderUserId: user.userId,
          senderUsername: user.username,
          senderDisplayName: user.displayName,
          senderAvatarUrl: user.avatarUrl,
          envelope: {
            ciphertext: encrypted.ciphertext,
            nonce: encrypted.nonce,
            algorithm: "aes-256-gcm",
            keyVersion: 1,
            clientMessageSeq,
          },
          plaintext,
          deliveredTo: [],
          readBy: [],
          createdAt: new Date().toISOString() as any,
        };

        setMessages((prev) => {
          const convoMessages = prev.get(conversationId) || [];
          const updated = new Map(prev);
          updated.set(conversationId, [...convoMessages, localMessage]);
          return updated;
        });
      } catch (err) {
        console.error("Failed to send message:", err);
        throw err;
      }
    },
    [user],
  );

  const subscribeToPresence = useCallback(async (userIds: UUID[]) => {
    const newUserIds = userIds.filter((id) => !subscribedUsersRef.current.has(id));
    if (newUserIds.length === 0) return;

    try {
      await socketManager.subscribePresence(newUserIds);
      newUserIds.forEach((id) => subscribedUsersRef.current.add(id));
    } catch (err) {
      console.error("Failed to subscribe to presence:", err);
    }
  }, []);

  const value: ChatContextValue = {
    conversations,
    messages,
    presences,
    currentConversationId,
    setCurrentConversationId,
    loadConversations,
    loadMessages,
    sendMessage,
    subscribeToPresence,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = React.useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return context;
}
