import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UUID, Conversation, Message, Presence, CallLog, TimelineItem } from "../types/index.js";
import { socketManager } from "../socket/manager.js";
import { cryptoManager } from "../crypto/manager.js";
import {
  decryptMessage as decryptMessageWithKeys,
  ensureKeyForSend,
  hasConversationKey,
  loadConversationKey,
  PeerPrekeyMissingError,
} from "../crypto/conversationKeys.js";
import { createSocketKeyExchange } from "../crypto/socketKeyExchange.js";
import { apiClient } from "../api/client.js";
import { generateUUID } from "../utils/uuid.js";
import { getJwtClaim } from "../utils/jwt.js";
import { useAuth } from "./AuthContext.js";

interface ChatContextValue {
  conversations: Map<UUID, Conversation>;
  messages: Map<UUID, Message[]>;
  calls: Map<UUID, CallLog[]>;
  timeline: Map<UUID, TimelineItem[]>;
  presences: Map<UUID, Presence>;
  currentConversationId: UUID | null;
  setCurrentConversationId: (id: UUID | null) => void;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: UUID) => Promise<void>;
  sendMessage: (conversationId: UUID, plaintext: string) => Promise<void>;
  subscribeToPresence: (userIds: UUID[]) => Promise<void>;
}

function mergeTimeline(messages: Message[], calls: CallLog[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...messages.map((message) => ({
      type: "message" as const,
      message,
      sortAt: message.createdAt,
    })),
    ...calls.map((call) => ({
      type: "call" as const,
      call,
      sortAt: call.createdAt,
    })),
  ];
  items.sort((a, b) => a.sortAt.localeCompare(b.sortAt));
  return items;
}

export const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuth();
  const [conversations, setConversations] = useState<Map<UUID, Conversation>>(new Map());
  const [messages, setMessages] = useState<Map<UUID, Message[]>>(new Map());
  const [calls, setCalls] = useState<Map<UUID, CallLog[]>>(new Map());
  const [timeline, setTimeline] = useState<Map<UUID, TimelineItem[]>>(new Map());
  const [presences, setPresences] = useState<Map<UUID, Presence>>(new Map());
  const [currentConversationId, setCurrentConversationId] = useState<UUID | null>(null);

  const messageSeqRef = useRef<Map<UUID, number>>(new Map());
  const subscribedUsersRef = useRef<Set<UUID>>(new Set());
  const messagesRef = useRef<Map<UUID, Message[]>>(messages);
  const callsRef = useRef<Map<UUID, CallLog[]>>(calls);
  const conversationsRef = useRef<Map<UUID, Conversation>>(conversations);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    callsRef.current = calls;
  }, [calls]);

  const refreshConversationDecryption = useCallback(async (conversationId: UUID) => {
    const existing = messagesRef.current.get(conversationId) || [];
    const convCalls = callsRef.current.get(conversationId) || [];
    const decrypted = await Promise.all(existing.map(decryptMessageWithKeys));
    setMessages((prev) => new Map(prev).set(conversationId, decrypted));
    setTimeline((prev) =>
      new Map(prev).set(conversationId, mergeTimeline(decrypted, convCalls)),
    );
  }, []);

  const socketKeyExchange = useMemo(
    () => createSocketKeyExchange((conversationId) => void refreshConversationDecryption(conversationId)),
    [refreshConversationDecryption],
  );

  const decryptMessage = useCallback(
    (message: Message) => decryptMessageWithKeys(message),
    [],
  );

  const loadConversations = useCallback(async () => {
    if (!user) return;
    try {
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

  useEffect(() => {
    if (!user) return;

    const unsubPresence = socketManager.onPresenceUpdate((presence) => {
      setPresences((prev) => new Map(prev).set(presence.userId, presence));
    });

    const unsubMessage = socketManager.onChatMessage(async (message) => {
      const conversation = conversationsRef.current.get(message.conversationId);
      const sender = conversation?.members.find((m) => m.userId === message.senderUserId);
      const enriched: Message = {
        ...message,
        senderUsername: sender?.username ?? message.senderUsername ?? "",
        senderDisplayName: sender?.displayName ?? message.senderDisplayName ?? "",
        senderAvatarUrl: sender?.avatarUrl ?? message.senderAvatarUrl,
      };
      const decrypted = await decryptMessage(enriched);
      setMessages((prev) => {
        const existing = prev.get(message.conversationId) || [];
        if (existing.some((m) => m.messageId === decrypted.messageId)) {
          return prev;
        }
        const nextMessages = [...existing, decrypted];
        setCalls((cPrev) => {
          const convCalls = cPrev.get(message.conversationId) || [];
          setTimeline((tPrev) =>
            new Map(tPrev).set(
              message.conversationId,
              mergeTimeline(nextMessages, convCalls),
            ),
          );
          return cPrev;
        });
        return new Map(prev).set(message.conversationId, nextMessages);
      });

      if (user && decrypted.senderUserId !== user.userId) {
        void apiClient
          .markMessageDelivered(decrypted.messageId, new Date().toISOString())
          .catch(() => undefined);
        socketManager.markDelivered(message.conversationId, decrypted.messageId);
      }
    });

    const unsubKeyInit = socketManager.onKeyExchangeInit(
      socketKeyExchange.handleIncomingKeyExchangeInit,
    );

    const unsubPeerJoined = socketManager.onPeerJoined((event) => {
      if (
        !hasConversationKey(event.conversationId) &&
        !socketManager.getPendingExchangeForConversation(event.conversationId)
      ) {
        socketKeyExchange.initiateKeyExchange(event.conversationId).catch((err) =>
          console.error("[KeyExchange] peer_joined re-trigger failed:", err),
        );
      }
    });

    const unsubCallLogged = socketManager.onCallLogged((call) => {
      setCalls((prev) => {
        const existing = prev.get(call.conversationId) || [];
        if (existing.some((c) => c.callId === call.callId)) return prev;
        const nextCalls = [...existing, call];
        setMessages((mPrev) => {
          const convMessages = mPrev.get(call.conversationId) || [];
          setTimeline((tPrev) =>
            new Map(tPrev).set(call.conversationId, mergeTimeline(convMessages, nextCalls)),
          );
          return mPrev;
        });
        return new Map(prev).set(call.conversationId, nextCalls);
      });
    });

    const unsubConversationCreated = socketManager.onConversationCreated(() => {
      void loadConversations();
    });

    return () => {
      unsubPresence();
      unsubMessage();
      unsubKeyInit();
      unsubPeerJoined();
      unsubCallLogged();
      unsubConversationCreated();
    };
  }, [user, decryptMessage, socketKeyExchange, loadConversations]);

  const loadMessages = useCallback(
    async (conversationId: UUID) => {
      if (!user) return;
      try {
        const [messageResult, callResult] = await Promise.all([
          apiClient.getMessages(conversationId, 50),
          apiClient.getCalls(conversationId, 50),
        ]);

        await socketManager.joinConversation(conversationId);
        await loadConversationKey(conversationId, 1);

        let decrypted = await Promise.all(messageResult.messages.map(decryptMessage));
        if (decrypted.some((m) => !m.plaintext)) {
          decrypted = await Promise.all(decrypted.map(decryptMessage));
        }
        setMessages((prev) => new Map(prev).set(conversationId, decrypted));
        setCalls((prev) => new Map(prev).set(conversationId, callResult.calls));
        setTimeline((prev) =>
          new Map(prev).set(conversationId, mergeTimeline(decrypted, callResult.calls)),
        );

        const lastFromPeer = [...decrypted].reverse().find((m) => m.senderUserId !== user.userId);
        if (lastFromPeer) {
          const readAt = new Date().toISOString();
          void apiClient
            .markConversationRead(conversationId, lastFromPeer.messageId, readAt)
            .catch(() => undefined);
          socketManager.markRead(conversationId, [lastFromPeer.messageId]);
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      }
    },
    [user, decryptMessage],
  );

  const sendMessage = useCallback(
    async (conversationId: UUID, plaintext: string) => {
      if (!user || !accessToken) return;

      const conversation = conversationsRef.current.get(conversationId);
      const peer = conversation?.members.find((m) => m.userId !== user.userId);
      if (!peer) {
        throw new Error("Không tìm thấy người nhận trong cuộc trò chuyện.");
      }

      const deviceId = getJwtClaim(accessToken, "deviceId") as UUID | undefined;
      if (!deviceId) {
        throw new Error("Phiên đăng nhập không hợp lệ (thiếu deviceId).");
      }

      let setupAad: Awaited<ReturnType<typeof ensureKeyForSend>>["setupAad"];
      try {
        const result = await ensureKeyForSend(conversationId, peer.userId, deviceId);
        setupAad = result.setupAad;
      } catch (err) {
        if (err instanceof PeerPrekeyMissingError) {
          try {
            await socketKeyExchange.initiateKeyExchange(conversationId);
          } catch (exchangeErr) {
            console.warn("[KeyExchange] fallback on send failed:", exchangeErr);
          }
        } else {
          throw err;
        }
      }

      if (!hasConversationKey(conversationId)) {
        throw new Error(
          "Không thiết lập được kênh mã hoá. Đối phương có thể chưa đăng nhập lần nào — hãy thử lại sau.",
        );
      }

      const currentSeq = messageSeqRef.current.get(conversationId) || 0;
      const clientMessageSeq = currentSeq + 1;
      messageSeqRef.current.set(conversationId, clientMessageSeq);

      const encrypted = await cryptoManager.encrypt(conversationId, plaintext, 1);
      const messageId = generateUUID() as UUID;
      const wireAad = setupAad ? { ...setupAad } : undefined;

      await socketManager.sendMessage({
        conversationId,
        messageId,
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        algorithm: "aes-256-gcm",
        keyVersion: 1,
        clientMessageSeq,
        ...(wireAad ? { aad: wireAad } : {}),
      });

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
          ...(wireAad ? { aad: wireAad } : {}),
        },
        plaintext,
        deliveredTo: [],
        readBy: [],
        createdAt: new Date().toISOString() as Message["createdAt"],
      };

      setMessages((prev) => {
        const existing = prev.get(conversationId) || [];
        const nextMessages = [...existing, localMessage];
        setCalls((cPrev) => {
          const convCalls = cPrev.get(conversationId) || [];
          setTimeline((tPrev) =>
            new Map(tPrev).set(conversationId, mergeTimeline(nextMessages, convCalls)),
          );
          return cPrev;
        });
        return new Map(prev).set(conversationId, nextMessages);
      });
    },
    [user, accessToken, socketKeyExchange],
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
    calls,
    timeline,
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
