import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  UUID,
  Conversation,
  Message,
  Presence,
  CallLog,
  TimelineItem,
  E2eeSetupAad,
  ConversationLocalMeta,
  Timestamp,
} from "../types/index.js";
import { socketManager } from "../socket/manager.js";
import { cryptoManager } from "../crypto/manager.js";
import {
  clearConversationKey,
  decryptMessage as decryptMessageWithKeys,
  ensureKeyForSend,
  ensureKeyFromGliteHistory,
  conversationHasGliteSetup,
  hasConversationKey,
  isE2eeSetupAad,
  loadConversationKey,
  PeerPrekeyMissingError,
  setActiveCryptoUserId,
} from "../crypto/conversationKeys.js";
import {
  configureGliteKeyGate,
  markGliteConversation,
  shouldAllowSocketKeyExchange,
} from "../crypto/gliteKeyGate.js";
import { createSocketKeyExchange } from "../crypto/socketKeyExchange.js";
import { apiClient } from "../api/client.js";
import { generateUUID } from "../utils/uuid.js";
import { getJwtClaim } from "../utils/jwt.js";
import { useAuth } from "./AuthContext.js";
import {
  applyConversationPatch,
  patchMessageInConversation,
  type ConversationMaps,
} from "../chat/applyConversationPatch.js";
import {
  buildPreviewText,
  getSortedVisibleConversations,
  truncatePreview,
} from "../chat/conversationList.js";
import { createOptimisticMessage, withOutboundStatus } from "../chat/optimisticMessage.js";

type PendingQueueEntry = { clientTempId: UUID; plaintext: string };

interface ChatContextValue {
  conversations: Map<UUID, Conversation>;
  visibleConversations: Conversation[];
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
  markConversationOpenedByMe: (conversationId: UUID) => void;
  getConversationPreview: (conversationId: UUID) => { preview?: string; sentAt?: Timestamp };
  keyReadyConversations: Set<UUID>;
}

const KEY_EXCHANGE_WAIT_MS = 10_000;

function conversationHasSuccessfulSend(
  conversationId: UUID,
  userId: UUID,
  messagesByConversation: Map<UUID, Message[]>,
): boolean {
  const msgs = messagesByConversation.get(conversationId) ?? [];
  return msgs.some((m) => m.senderUserId === userId && m.outboundStatus === "sent");
}

function markOptimisticSendFailed(
  conversationId: UUID,
  clientTempId: UUID,
  messagesByConversation: Map<UUID, Message[]>,
  commit: (conversationId: UUID, patch: { messages?: Message[] }) => void,
): void {
  const current = messagesByConversation.get(conversationId) ?? [];
  commit(conversationId, {
    messages: patchMessageInConversation(current, clientTempId, (m) =>
      withOutboundStatus(m, "failed"),
    ),
  });
}

async function waitForConversationKey(conversationId: UUID, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (hasConversationKey(conversationId)) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return hasConversationKey(conversationId);
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
  const [keyReadyConversations, setKeyReadyConversations] = useState<Set<UUID>>(new Set());
  const [conversationLocalMeta, setConversationLocalMeta] = useState<
    Map<UUID, ConversationLocalMeta>
  >(new Map());

  const messageSeqRef = useRef<Map<UUID, number>>(new Map());
  const subscribedUsersRef = useRef<Set<UUID>>(new Set());
  const messagesRef = useRef<Map<UUID, Message[]>>(messages);
  const callsRef = useRef<Map<UUID, CallLog[]>>(calls);
  const conversationsRef = useRef<Map<UUID, Conversation>>(conversations);
  const pendingQueueRef = useRef<Map<UUID, PendingQueueEntry[]>>(new Map());
  const pendingSetupAadRef = useRef<Map<UUID, E2eeSetupAad>>(new Map());
  const exchangeInProgressRef = useRef<Set<UUID>>(new Set());
  const conversationLocalMetaRef = useRef<Map<UUID, ConversationLocalMeta>>(conversationLocalMeta);

  useEffect(() => {
    configureGliteKeyGate((conversationId) => messagesRef.current.get(conversationId));
  });

  useEffect(() => {
    if (user) {
      setActiveCryptoUserId(user.userId);
    }
  }, [user]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    callsRef.current = calls;
  }, [calls]);
  useEffect(() => {
    conversationLocalMetaRef.current = conversationLocalMeta;
  }, [conversationLocalMeta]);

  const commitConversation = useCallback(
    (conversationId: UUID, patch: { messages?: Message[]; calls?: CallLog[] }) => {
      setMessages((mPrev) => {
        const maps: ConversationMaps = {
          messages: mPrev,
          calls: callsRef.current,
          timeline: new Map(),
        };
        const next = applyConversationPatch(maps, conversationId, patch);
        setCalls(next.calls);
        setTimeline(next.timeline);
        messagesRef.current = next.messages;
        callsRef.current = next.calls;
        return next.messages;
      });
    },
    [],
  );

  const patchConversationMeta = useCallback(
    (conversationId: UUID, patch: Partial<ConversationLocalMeta>) => {
      setConversationLocalMeta((prev) => {
        const next = new Map(prev);
        const existing = next.get(conversationId) ?? {};
        next.set(conversationId, { ...existing, ...patch });
        return next;
      });
    },
    [],
  );

  const syncPreviewFromMessages = useCallback(
    (conversationId: UUID, convMessages: Message[]) => {
      const last = [...convMessages].reverse().find((m) => m.plaintext);
      if (!last?.plaintext) return;
      patchConversationMeta(conversationId, {
        hasLocalActivity: true,
        lastPreview: truncatePreview(last.plaintext),
        lastActivityAt: last.createdAt,
      });
    },
    [patchConversationMeta],
  );

  const markConversationOpenedByMe = useCallback(
    (conversationId: UUID) => {
      patchConversationMeta(conversationId, { openedByMe: true });
    },
    [patchConversationMeta],
  );

  const getConversationPreview = useCallback(
    (conversationId: UUID) => {
      const conv = conversations.get(conversationId);
      if (!conv) return {};
      return buildPreviewText(conv, conversationLocalMeta.get(conversationId));
    },
    [conversations, conversationLocalMeta],
  );

  const visibleConversations = useMemo(
    () => getSortedVisibleConversations(conversations, conversationLocalMeta),
    [conversations, conversationLocalMeta],
  );

  const refreshConversationDecryption = useCallback(
    (conversationId: UUID) => {
      const existing = messagesRef.current.get(conversationId) || [];
      void Promise.all(existing.map(decryptMessageWithKeys)).then((decrypted) => {
        commitConversation(conversationId, { messages: decrypted });
        syncPreviewFromMessages(conversationId, decrypted);
      });
    },
    [commitConversation, syncPreviewFromMessages],
  );

  const markKeyReady = useCallback((conversationId: UUID) => {
    setKeyReadyConversations((prev) => new Set(prev).add(conversationId));
  }, []);

  const socketKeyExchange = useMemo(
    () =>
      createSocketKeyExchange((conversationId) => {
        markKeyReady(conversationId as UUID);
        refreshConversationDecryption(conversationId);
      }),
    [refreshConversationDecryption, markKeyReady],
  );

  const decryptMessage = useCallback(
    (message: Message) => decryptMessageWithKeys(message),
    [],
  );

  const doActualSend = useCallback(
    async (
      conversationId: UUID,
      plaintext: string,
      clientTempId: UUID,
      wireAad?: Record<string, unknown>,
    ) => {
      if (!user) return;

      const existing = messagesRef.current.get(conversationId) ?? [];
      commitConversation(conversationId, {
        messages: patchMessageInConversation(existing, clientTempId, (m) =>
          withOutboundStatus(m, "sending"),
        ),
      });

      try {
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
          ...(wireAad ? { aad: wireAad } : {}),
        });

        const sentMessage: Message = {
          messageId,
          clientTempId,
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
          outboundStatus: "sent",
          deliveredTo: [],
          readBy: [],
          createdAt: new Date().toISOString() as Message["createdAt"],
        };

        const current = messagesRef.current.get(conversationId) ?? [];
        commitConversation(conversationId, {
          messages: patchMessageInConversation(current, clientTempId, () => sentMessage),
        });
        patchConversationMeta(conversationId, {
          hasLocalActivity: true,
          lastPreview: truncatePreview(plaintext),
          lastActivityAt: sentMessage.createdAt,
        });
      } catch (err) {
        const current = messagesRef.current.get(conversationId) ?? [];
        commitConversation(conversationId, {
          messages: patchMessageInConversation(current, clientTempId, (m) =>
            withOutboundStatus(m, "failed"),
          ),
        });
        throw err;
      }
    },
    [user, commitConversation, patchConversationMeta],
  );

  const flushPendingQueue = useCallback(
    async (conversationId: UUID) => {
      const queue = pendingQueueRef.current.get(conversationId);
      if (!queue?.length) return;
      pendingQueueRef.current.delete(conversationId);
      const setupAad = pendingSetupAadRef.current.get(conversationId);
      for (let i = 0; i < queue.length; i += 1) {
        const entry = queue[i]!;
        const wireAad =
          i === 0 && setupAad ? ({ ...setupAad } as Record<string, unknown>) : undefined;
        await doActualSend(conversationId, entry.plaintext, entry.clientTempId, wireAad);
      }
      if (setupAad) {
        pendingSetupAadRef.current.delete(conversationId);
      }
    },
    [doActualSend],
  );

  useEffect(() => {
    for (const conversationId of keyReadyConversations) {
      const queue = pendingQueueRef.current.get(conversationId as UUID);
      if (!queue?.length) continue;
      void flushPendingQueue(conversationId as UUID).catch((err) =>
        console.error("[Queue] Failed to flush queued messages:", err),
      );
    }
  }, [keyReadyConversations, flushPendingQueue]);

  const appendOptimisticMessage = useCallback(
    (conversationId: UUID, clientTempId: UUID, plaintext: string) => {
      if (!user) return;
      const optimistic = createOptimisticMessage(conversationId, clientTempId, user, plaintext);
      const existing = messagesRef.current.get(conversationId) ?? [];
      commitConversation(conversationId, { messages: [...existing, optimistic] });
      patchConversationMeta(conversationId, {
        hasLocalActivity: true,
        lastPreview: truncatePreview(plaintext),
        lastActivityAt: optimistic.createdAt,
      });
    },
    [user, commitConversation, patchConversationMeta],
  );

  const loadConversations = useCallback(async () => {
    if (!user || !accessToken) return;
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
  }, [user, accessToken]);

  useEffect(() => {
    if (!user || !accessToken) return;

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
      if (isE2eeSetupAad(decrypted.envelope.aad) && decrypted.plaintext) {
        markGliteConversation(decrypted.conversationId);
      }

      const existing = messagesRef.current.get(message.conversationId) || [];
      if (existing.some((m) => m.messageId === decrypted.messageId)) return;

      const nextMessages = [...existing, decrypted];
      commitConversation(message.conversationId, { messages: nextMessages });
      if (decrypted.plaintext) {
        patchConversationMeta(message.conversationId, {
          hasLocalActivity: true,
          lastPreview: truncatePreview(decrypted.plaintext),
          lastActivityAt: decrypted.createdAt,
        });
      }

      if (user && decrypted.senderUserId !== user.userId) {
        void loadConversations();
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
      const convId = event.conversationId as UUID;
      if (!shouldAllowSocketKeyExchange(convId)) return;
      if (
        !hasConversationKey(convId) &&
        !socketManager.getPendingExchangeForConversation(convId) &&
        !exchangeInProgressRef.current.has(convId)
      ) {
        exchangeInProgressRef.current.add(convId);
        socketKeyExchange
          .initiateKeyExchange(convId)
          .catch((err) => console.error("[KeyExchange] peer_joined re-trigger failed:", err))
          .finally(() => exchangeInProgressRef.current.delete(convId));
      }
    });

    const unsubCallLogged = socketManager.onCallLogged((call) => {
      const existing = callsRef.current.get(call.conversationId) || [];
      if (existing.some((c) => c.callId === call.callId)) return;
      const nextCalls = [...existing, call];
      const convMessages = messagesRef.current.get(call.conversationId) || [];
      commitConversation(call.conversationId, { messages: convMessages, calls: nextCalls });
    });

    const unsubConversationCreated = socketManager.onConversationCreated((event) => {
      void loadConversations();
      if (shouldAllowSocketKeyExchange(event.conversationId)) {
        void socketManager.joinConversation(event.conversationId);
      }
    });

    return () => {
      unsubPresence();
      unsubMessage();
      unsubKeyInit();
      unsubPeerJoined();
      unsubCallLogged();
      unsubConversationCreated();
    };
  }, [
    user,
    accessToken,
    decryptMessage,
    socketKeyExchange,
    loadConversations,
    commitConversation,
    patchConversationMeta,
  ]);

  const loadMessages = useCallback(
    async (conversationId: UUID) => {
      if (!user) return;
      try {
        const [messageResult, callResult] = await Promise.all([
          apiClient.getMessages(conversationId, 50),
          apiClient.getCalls(conversationId, 50),
        ]);

        const hasGlite = conversationHasGliteSetup(messageResult.messages);
        const gliteKeyOk = await ensureKeyFromGliteHistory(
          conversationId,
          messageResult.messages,
        );

        if (gliteKeyOk) {
          markGliteConversation(conversationId);
        } else if (hasGlite) {
          clearConversationKey(conversationId, 1);
          markGliteConversation(conversationId);
        } else if (!hasConversationKey(conversationId)) {
          await loadConversationKey(conversationId, 1);
        }

        if (hasConversationKey(conversationId)) {
          markKeyReady(conversationId);
        }

        let decrypted = await Promise.all(messageResult.messages.map(decryptMessage));
        if (decrypted.some((m) => !m.plaintext)) {
          decrypted = await Promise.all(decrypted.map(decryptMessage));
        }
        for (const m of decrypted) {
          if (isE2eeSetupAad(m.envelope.aad) && m.plaintext) {
            markGliteConversation(conversationId);
            break;
          }
        }

        commitConversation(conversationId, {
          messages: decrypted,
          calls: callResult.calls,
        });
        syncPreviewFromMessages(conversationId, decrypted);

        await socketManager.joinConversation(conversationId);

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
    [user, decryptMessage, markKeyReady, commitConversation, syncPreviewFromMessages],
  );

  const sendMessage = useCallback(
    async (conversationId: UUID, plaintext: string) => {
      if (!user || !accessToken) return;

      const conversation = conversationsRef.current.get(conversationId);
      const peer = conversation?.members.find((m) => m.userId !== user.userId);
      if (!peer) {
        throw new Error("Không tìm thấy người nhận trong cuộc trò chuyện.");
      }

      const clientTempId = generateUUID() as UUID;
      appendOptimisticMessage(conversationId, clientTempId, plaintext);

      const deviceId = getJwtClaim(accessToken, "deviceId") as UUID | undefined;
      if (!deviceId) {
        throw new Error("Phiên đăng nhập không hợp lệ (thiếu deviceId).");
      }

      if (!conversationHasSuccessfulSend(conversationId, user.userId, messagesRef.current)) {
        clearConversationKey(conversationId, 1);
      }

      let setupAad: Awaited<ReturnType<typeof ensureKeyForSend>>["setupAad"];
      try {
        const result = await ensureKeyForSend(conversationId, peer.userId, deviceId);
        setupAad = result.setupAad;
        if (setupAad) {
          pendingSetupAadRef.current.set(conversationId, setupAad);
          markGliteConversation(conversationId);
        }
      } catch (err) {
        if (err instanceof PeerPrekeyMissingError) {
          if (
            shouldAllowSocketKeyExchange(conversationId) &&
            !socketManager.getPendingExchangeForConversation(conversationId) &&
            !exchangeInProgressRef.current.has(conversationId)
          ) {
            exchangeInProgressRef.current.add(conversationId);
            try {
              await socketKeyExchange.initiateKeyExchange(conversationId);
            } catch (exchangeErr) {
              console.warn("[KeyExchange] fallback on send failed:", exchangeErr);
            } finally {
              exchangeInProgressRef.current.delete(conversationId);
            }
          }
          await waitForConversationKey(conversationId, KEY_EXCHANGE_WAIT_MS);
        } else {
          markOptimisticSendFailed(
            conversationId,
            clientTempId,
            messagesRef.current,
            commitConversation,
          );
          throw err;
        }
      }

      if (!hasConversationKey(conversationId)) {
        markOptimisticSendFailed(
          conversationId,
          clientTempId,
          messagesRef.current,
          commitConversation,
        );
        throw new Error(
          "Không thể thiết lập mã hóa — đối phương chưa có khóa mã hóa (nhờ họ đăng nhập app một lần) hoặc đang offline.",
        );
      }

      markKeyReady(conversationId);
      await flushPendingQueue(conversationId);

      const wireAad = setupAad ? { ...setupAad } : undefined;
      if (wireAad) {
        pendingSetupAadRef.current.delete(conversationId);
      }
      await doActualSend(conversationId, plaintext, clientTempId, wireAad);
    },
    [
      user,
      accessToken,
      socketKeyExchange,
      markKeyReady,
      doActualSend,
      flushPendingQueue,
      appendOptimisticMessage,
      commitConversation,
    ],
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
    visibleConversations,
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
    markConversationOpenedByMe,
    getConversationPreview,
    keyReadyConversations,
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
