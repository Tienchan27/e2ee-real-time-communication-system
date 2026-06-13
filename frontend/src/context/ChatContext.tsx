import React, { createContext, useCallback, useEffect, useRef, useState } from "react";
import type { UUID, Conversation, Message, Presence } from "../types/index.js";
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

export const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Map<UUID, Conversation>>(new Map());
  const [messages, setMessages] = useState<Map<UUID, Message[]>>(new Map());
  const [presences, setPresences] = useState<Map<UUID, Presence>>(new Map());
  const [currentConversationId, setCurrentConversationId] = useState<UUID | null>(null);

  const messageSeqRef = useRef<Map<UUID, number>>(new Map());
  const subscribedUsersRef = useRef<Set<UUID>>(new Set());

  // ── Decryption ─────────────────────────────────────────────────────────────

  const decryptMessage = useCallback(async (message: Message): Promise<Message> => {
    try {
      const key = cryptoManager.getConversationKey(message.conversationId, message.envelope.keyVersion);
      if (!key) return message;
      const plaintext = await cryptoManager.decrypt(
        message.conversationId,
        message.envelope.ciphertext,
        message.envelope.nonce,
        message.envelope.keyVersion,
        message.envelope.aad,
      );
      return { ...message, plaintext };
    } catch {
      return message;
    }
  }, []);

  // ── Key exchange ───────────────────────────────────────────────────────────

  // Respond to a key:exchange:init from a peer. Called from the global listener below.
  const handleIncomingKeyExchangeInit = useCallback(
    async (event: Parameters<Parameters<typeof socketManager.onKeyExchangeInit>[0]>[0]) => {
      try {
        const peerPublicKey = await cryptoManager.importEcdhPublicKey(event.publicKey);
        const keyPair = await cryptoManager.generateEcdhKeyPair();
        const sharedKey = await cryptoManager.deriveSharedKey(
          keyPair.privateKey,
          peerPublicKey,
          event.conversationId,
        );
        cryptoManager.setConversationKey(event.conversationId, 1, sharedKey);

        const myPublicKeyBase64 = await cryptoManager.exportEcdhPublicKey(keyPair.publicKey);
        socketManager.respondToKeyExchange(
          event.conversationId,
          event.sessionProposalId,
          myPublicKeyBase64,
        );

        // Re-decrypt messages in this conversation now that we have a key
        setMessages((prev) => {
          const existing = prev.get(event.conversationId);
          if (!existing) return prev;
          const updated = new Map(prev);
          // Trigger async decrypt; state will update via the promise chain below
          Promise.all(existing.map(decryptMessage)).then((decrypted) => {
            setMessages((p) => new Map(p).set(event.conversationId, decrypted));
          });
          return updated;
        });
      } catch (err) {
        console.error("[KeyExchange] Failed to respond to init:", err);
      }
    },
    [decryptMessage],
  );

  // Initiate key exchange for a conversation when we open it without a key
  const initiateKeyExchange = useCallback(
    (conversationId: UUID): Promise<void> => {
      return new Promise((resolve, reject) => {
        const sessionProposalId = generateUUID() as UUID;

        cryptoManager.generateEcdhKeyPair().then(async (keyPair) => {
          const myPublicKeyBase64 = await cryptoManager.exportEcdhPublicKey(keyPair.publicKey);

          // Store private key so the response handler can complete the derivation
          socketManager.pendingKeyExchanges.set(sessionProposalId, {
            privateKey: keyPair.privateKey,
            conversationId,
          });

          const timeout = setTimeout(() => {
            socketManager.pendingKeyExchanges.delete(sessionProposalId);
            // No peer online yet — resolve quietly; they'll respond when they join
            resolve();
          }, 8000);

          const unsubscribe = socketManager.onKeyExchangeResponse(async (response) => {
            if (response.sessionProposalId !== sessionProposalId) return;
            clearTimeout(timeout);
            unsubscribe();

            const pending = socketManager.pendingKeyExchanges.get(sessionProposalId);
            if (!pending || !response.accepted) {
              socketManager.pendingKeyExchanges.delete(sessionProposalId);
              resolve();
              return;
            }

            try {
              const peerPublicKey = await cryptoManager.importEcdhPublicKey(response.publicKey);
              const sharedKey = await cryptoManager.deriveSharedKey(
                pending.privateKey,
                peerPublicKey,
                conversationId,
              );
              cryptoManager.setConversationKey(conversationId, 1, sharedKey);
              socketManager.pendingKeyExchanges.delete(sessionProposalId);
              resolve();
            } catch (err) {
              socketManager.pendingKeyExchanges.delete(sessionProposalId);
              reject(err);
            }
          });

          socketManager.initiateKeyExchange(conversationId, sessionProposalId, myPublicKeyBase64);
        });
      });
    },
    [],
  );

  // ── Socket listeners ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;

    const unsubPresence = socketManager.onPresenceUpdate((presence) => {
      setPresences((prev) => new Map(prev).set(presence.userId, presence));
    });

    const unsubMessage = socketManager.onChatMessage(async (message) => {
      const decrypted = await decryptMessage(message);
      setMessages((prev) => {
        const existing = prev.get(message.conversationId) || [];
        return new Map(prev).set(message.conversationId, [...existing, decrypted]);
      });
    });

    const unsubKeyInit = socketManager.onKeyExchangeInit(handleIncomingKeyExchangeInit);

    return () => {
      unsubPresence();
      unsubMessage();
      unsubKeyInit();
    };
  }, [user, decryptMessage, handleIncomingKeyExchangeInit]);

  // ── API actions ────────────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    if (!user) return;
    try {
      const { apiClient } = await import("../api/client.js");
      const result = await apiClient.getConversations(50);
      setConversations((prev) => {
        const updated = new Map(prev);
        for (const conv of result.conversations) {
          updated.set(conv.conversationId, conv);
        }
        return updated;
      });
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }, [user]);

  const loadMessages = useCallback(
    async (conversationId: UUID) => {
      if (!user) return;
      try {
        const { apiClient } = await import("../api/client.js");
        const result = await apiClient.getMessages(conversationId, 50);

        // Join the Socket.IO room first
        await socketManager.joinConversation(conversationId);

        // Initiate key exchange if no key exists yet for this conversation
        if (!cryptoManager.hasConversationKey(conversationId)) {
          await initiateKeyExchange(conversationId);
        }

        // Decrypt historical messages (key may now be available)
        const decrypted = await Promise.all(result.messages.map(decryptMessage));
        setMessages((prev) => new Map(prev).set(conversationId, decrypted));
      } catch (err) {
        console.error("Failed to load messages:", err);
      }
    },
    [user, decryptMessage, initiateKeyExchange],
  );

  const sendMessage = useCallback(
    async (conversationId: UUID, plaintext: string) => {
      if (!user) return;

      if (!cryptoManager.hasConversationKey(conversationId)) {
        throw new Error("Secure channel not established yet. Please wait.");
      }

      const currentSeq = messageSeqRef.current.get(conversationId) || 0;
      const clientMessageSeq = currentSeq + 1;
      messageSeqRef.current.set(conversationId, clientMessageSeq);

      const encrypted = await cryptoManager.encrypt(conversationId, plaintext, 1);
      const messageId = generateUUID() as UUID;

      await socketManager.sendMessage({
        conversationId,
        messageId,
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        algorithm: "aes-256-gcm",
        keyVersion: 1,
        clientMessageSeq,
      });

      // Optimistic local message for immediate UI update
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
        createdAt: new Date().toISOString() as Message["createdAt"],
      };

      setMessages((prev) => {
        const existing = prev.get(conversationId) || [];
        return new Map(prev).set(conversationId, [...existing, localMessage]);
      });
    },
    [user],
  );

  const subscribeToPresence = useCallback(async (userIds: UUID[]) => {
    const newIds = userIds.filter((id) => !subscribedUsersRef.current.has(id));
    if (newIds.length === 0) return;
    try {
      await socketManager.subscribePresence(newIds);
      newIds.forEach((id) => subscribedUsersRef.current.add(id));
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

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = React.useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return context;
}
