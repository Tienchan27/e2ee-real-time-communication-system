import { io, type Socket } from "socket.io-client";
import type { UUID, Message, Presence, CallState } from "../types/index.js";

const SOCKET_URL = import.meta.env.VITE_SOCKET_BASE_URL || "";
console.log("[Socket] SOCKET_URL:", SOCKET_URL || "(same origin — relies on nginx /socket.io/ proxy)");

// ── Listener types ────────────────────────────────────────────────────────────

type PresenceUpdateListener = (presence: Presence) => void;
type ChatMessageListener = (message: Message) => void;
type SystemAckListener = (requestId: UUID, meta?: Record<string, unknown>) => void;
type SystemErrorListener = (
  requestId: UUID,
  errorCode: string,
  errorMessage: string,
  retryable: boolean,
) => void;
type CallIncomingListener = (call: CallState) => void;

export type KeyExchangeInitEvent = {
  conversationId: UUID;
  sessionProposalId: UUID;
  curve: "p256" | "x25519";
  publicKey: string;
  senderUserId: UUID;
  senderDeviceId: UUID;
};

export type KeyExchangeResponseEvent = {
  conversationId: UUID;
  sessionProposalId: UUID;
  publicKey: string;
  accepted: boolean;
  senderUserId: UUID;
};

type KeyExchangeInitListener = (event: KeyExchangeInitEvent) => void;
type KeyExchangeResponseListener = (event: KeyExchangeResponseEvent) => void;

// Holds the private key for an in-flight key exchange initiated by this device
export type PendingKeyExchange = {
  privateKey: CryptoKey;
  conversationId: UUID;
};

// ── SocketManager ─────────────────────────────────────────────────────────────

export class SocketManager {
  private socket: Socket | null = null;
  private listeners = {
    presenceUpdate: new Set<PresenceUpdateListener>(),
    chatMessage: new Set<ChatMessageListener>(),
    systemAck: new Set<SystemAckListener>(),
    systemError: new Set<SystemErrorListener>(),
    callIncoming: new Set<CallIncomingListener>(),
    keyExchangeInit: new Set<KeyExchangeInitListener>(),
    keyExchangeResponse: new Set<KeyExchangeResponseListener>(),
  };

  // sessionProposalId → pending exchange (private key + conversationId)
  readonly pendingKeyExchanges: Map<string, PendingKeyExchange> = new Map();

  connect(accessToken: string): Promise<void> {
    // Already connected — nothing to do.
    if (this.socket?.connected) return Promise.resolve();

    // Socket exists but still connecting/reconnecting — wait for it rather than
    // creating a second socket (which would abandon the first and leak listeners).
    if (this.socket) {
      return new Promise<void>((resolve) => {
        this.socket!.once("connect", resolve);
      });
    }

    return new Promise<void>((resolve, reject) => {
      this.socket = io(SOCKET_URL, {
        auth: { accessToken },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      // Register socket-level handlers once, immediately after io() so they survive reconnects
      // without accumulating duplicates on each "connect" event.
      this.setupEventListeners();

      this.socket.on("connect", () => {
        console.log("[Socket] Connected to realtime service");
        resolve();
      });

      this.socket.on("connect_error", (error) => {
        // Log but don't reject — socket.io retries automatically.
        // We only reject after all attempts are exhausted (reconnect_failed).
        console.warn("[Socket] Connection error (will retry):", error.message);
      });

      this.socket.once("reconnect_failed", () => {
        console.error("[Socket] All reconnection attempts failed");
        reject(new Error("Cannot connect to realtime service. Please refresh the page."));
      });

      this.socket.on("disconnect", (reason) => {
        console.log("[Socket] Disconnected:", reason);
      });

      this.socket.on("reconnect", (attempt) => {
        console.log("[Socket] Reconnected after", attempt, "attempt(s)");
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on("presence:update", (presence: Presence) => {
      this.listeners.presenceUpdate.forEach((l) => l(presence));
    });

    this.socket.on("chat:message", (message: Message) => {
      this.listeners.chatMessage.forEach((l) => l(message));
    });

    this.socket.on(
      "system:ack",
      (data: { requestId: UUID; status: string; meta?: Record<string, unknown> }) => {
        this.listeners.systemAck.forEach((l) => l(data.requestId, data.meta));
      },
    );

    this.socket.on(
      "system:error",
      (data: { requestId: UUID; errorCode: string; errorMessage: string; retryable: boolean }) => {
        this.listeners.systemError.forEach((l) =>
          l(data.requestId, data.errorCode, data.errorMessage, data.retryable),
        );
      },
    );

    this.socket.on("call:incoming", (call: CallState) => {
      this.listeners.callIncoming.forEach((l) => l(call));
    });

    this.socket.on("key:exchange:init", (payload: KeyExchangeInitEvent) => {
      this.listeners.keyExchangeInit.forEach((l) => l(payload));
    });

    this.socket.on("key:exchange:response", (payload: KeyExchangeResponseEvent) => {
      this.listeners.keyExchangeResponse.forEach((l) => l(payload));
    });
  }

  // ── Emit helpers ──────────────────────────────────────────────────────────

  private emitEvent<T>(event: string, payload: T): UUID {
    const requestId = this.generateUUID() as UUID;
    this.socket?.emit(event, {
      requestId,
      timestamp: new Date().toISOString(),
      payload,
    });
    return requestId;
  }

  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // ── Conversation events ───────────────────────────────────────────────────

  joinConversation(conversationId: UUID): Promise<UUID> {
    return new Promise((resolve, reject) => {
      const requestId = this.emitEvent("conversation:join", { conversationId });
      console.log("[Socket] joinConversation emit, requestId:", requestId, "conv:", conversationId);

      const cleanup = () => {
        clearTimeout(timer);
        this.listeners.systemAck.delete(onAck);
        this.listeners.systemError.delete(onErr);
      };

      // 5 s safety valve: if the ack never arrives (dropped packet, server latency),
      // resolve anyway — the server likely joined us but the ack was lost.
      // Key exchange will fail independently if we truly aren't in the room.
      const timer = setTimeout(() => {
        cleanup();
        console.warn("[Socket] joinConversation ack timed out — proceeding anyway:", conversationId);
        resolve(requestId);
      }, 5000);

      const onAck = (id: UUID) => {
        if (id !== requestId) return;
        cleanup();
        console.log("[Socket] joinConversation ack received:", conversationId);
        resolve(requestId);
      };
      const onErr = (id: UUID, code: string, msg: string) => {
        if (id !== requestId) return;
        cleanup();
        console.error("[Socket] joinConversation error:", code, msg);
        reject(new Error(`${code}: ${msg}`));
      };
      this.listeners.systemAck.add(onAck);
      this.listeners.systemError.add(onErr);
    });
  }

  leaveConversation(conversationId: UUID): Promise<UUID> {
    return new Promise((resolve, reject) => {
      const requestId = this.emitEvent("conversation:leave", { conversationId });
      const onAck = (id: UUID) => {
        if (id !== requestId) return;
        this.listeners.systemAck.delete(onAck);
        this.listeners.systemError.delete(onErr);
        resolve(requestId);
      };
      const onErr = (id: UUID, code: string, msg: string) => {
        if (id !== requestId) return;
        this.listeners.systemAck.delete(onAck);
        this.listeners.systemError.delete(onErr);
        reject(new Error(`${code}: ${msg}`));
      };
      this.listeners.systemAck.add(onAck);
      this.listeners.systemError.add(onErr);
    });
  }

  // ── Presence events ───────────────────────────────────────────────────────

  subscribePresence(targets: UUID[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const requestId = this.emitEvent("presence:subscribe", { targets });
      const onAck = (id: UUID) => {
        if (id !== requestId) return;
        this.listeners.systemAck.delete(onAck);
        this.listeners.systemError.delete(onErr);
        resolve();
      };
      const onErr = (id: UUID, code: string, msg: string) => {
        if (id !== requestId) return;
        this.listeners.systemAck.delete(onAck);
        this.listeners.systemError.delete(onErr);
        reject(new Error(`${code}: ${msg}`));
      };
      this.listeners.systemAck.add(onAck);
      this.listeners.systemError.add(onErr);
    });
  }

  // ── Chat events ───────────────────────────────────────────────────────────

  sendMessage(payload: {
    conversationId: UUID;
    messageId: UUID;
    ciphertext: string;
    nonce: string;
    algorithm: "aes-256-gcm";
    keyVersion: number;
    aad?: Record<string, unknown>;
    clientMessageSeq: number;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const requestId = this.emitEvent("chat:send", payload);
      const onAck = (id: UUID) => {
        if (id !== requestId) return;
        this.listeners.systemAck.delete(onAck);
        this.listeners.systemError.delete(onErr);
        resolve();
      };
      const onErr = (id: UUID, code: string, msg: string) => {
        if (id !== requestId) return;
        this.listeners.systemAck.delete(onAck);
        this.listeners.systemError.delete(onErr);
        reject(new Error(`${code}: ${msg}`));
      };
      this.listeners.systemAck.add(onAck);
      this.listeners.systemError.add(onErr);
    });
  }

  markDelivered(conversationId: UUID, messageId: UUID): void {
    this.emitEvent("chat:delivered", { conversationId, messageId });
  }

  markRead(conversationId: UUID, messageIds: UUID[]): void {
    this.emitEvent("chat:read", { conversationId, messageIds });
  }

  // ── Key exchange events ───────────────────────────────────────────────────

  initiateKeyExchange(
    conversationId: UUID,
    sessionProposalId: UUID,
    publicKeyBase64: string,
  ): UUID {
    return this.emitEvent("key:exchange:init", {
      conversationId,
      sessionProposalId,
      curve: "p256",
      publicKey: publicKeyBase64,
    });
  }

  respondToKeyExchange(
    conversationId: UUID,
    sessionProposalId: UUID,
    publicKeyBase64: string,
  ): UUID {
    return this.emitEvent("key:exchange:response", {
      conversationId,
      sessionProposalId,
      publicKey: publicKeyBase64,
      accepted: true,
    });
  }

  onKeyExchangeInit(listener: KeyExchangeInitListener): () => void {
    this.listeners.keyExchangeInit.add(listener);
    return () => this.listeners.keyExchangeInit.delete(listener);
  }

  onKeyExchangeResponse(listener: KeyExchangeResponseListener): () => void {
    this.listeners.keyExchangeResponse.add(listener);
    return () => this.listeners.keyExchangeResponse.delete(listener);
  }

  getPendingExchangeForConversation(conversationId: UUID): { sessionProposalId: UUID } | null {
    for (const [sessionProposalId, pending] of this.pendingKeyExchanges) {
      if (pending.conversationId === conversationId) {
        return { sessionProposalId: sessionProposalId as UUID };
      }
    }
    return null;
  }

  // ── Presence / call listener registration ────────────────────────────────

  onPresenceUpdate(listener: PresenceUpdateListener) {
    this.listeners.presenceUpdate.add(listener);
    return () => this.listeners.presenceUpdate.delete(listener);
  }

  onChatMessage(listener: ChatMessageListener) {
    this.listeners.chatMessage.add(listener);
    return () => this.listeners.chatMessage.delete(listener);
  }

  onCallIncoming(listener: CallIncomingListener) {
    this.listeners.callIncoming.add(listener);
    return () => this.listeners.callIncoming.delete(listener);
  }
}

export const socketManager = new SocketManager();
