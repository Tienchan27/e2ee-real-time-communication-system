import { io, type Socket } from "socket.io-client";
import type {
  UUID,
  Message,
  Presence,
  CallState,
} from "../types/index.js";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_BASE_URL || "";

// Event listeners
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

export class SocketManager {
  private socket: Socket | null = null;
  private listeners = {
    presenceUpdate: new Set<PresenceUpdateListener>(),
    chatMessage: new Set<ChatMessageListener>(),
    systemAck: new Set<SystemAckListener>(),
    systemError: new Set<SystemErrorListener>(),
    callIncoming: new Set<CallIncomingListener>(),
  };

  connect(accessToken: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(SOCKET_URL, {
        auth: {
          accessToken,
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      this.socket.on("connect", () => {
        console.log("[Socket] Connected");
        this.setupEventListeners();
        resolve();
      });

      this.socket.on("connect_error", (error) => {
        console.error("[Socket] Connection error:", error);
        reject(error);
      });

      this.socket.on("disconnect", (reason) => {
        console.log("[Socket] Disconnected:", reason);
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

  // Setup listeners for incoming events
  private setupEventListeners() {
    if (!this.socket) return;

    // Presence updates
    this.socket.on(
      "presence:update",
      (presence: Presence) => {
        this.listeners.presenceUpdate.forEach((listener) =>
          listener(presence),
        );
      },
    );

    // Chat messages
    this.socket.on("chat:message", (message: Message) => {
      this.listeners.chatMessage.forEach((listener) => listener(message));
    });

    // System ack
    this.socket.on(
      "system:ack",
      (data: {
        requestId: UUID;
        status: string;
        meta?: Record<string, unknown>;
      }) => {
        this.listeners.systemAck.forEach((listener) =>
          listener(data.requestId, data.meta),
        );
      },
    );

    // System error
    this.socket.on(
      "system:error",
      (data: {
        requestId: UUID;
        errorCode: string;
        errorMessage: string;
        retryable: boolean;
      }) => {
        this.listeners.systemError.forEach((listener) =>
          listener(
            data.requestId,
            data.errorCode,
            data.errorMessage,
            data.retryable,
          ),
        );
      },
    );

    // Call incoming
    this.socket.on("call:incoming", (call: CallState) => {
      this.listeners.callIncoming.forEach((listener) => listener(call));
    });
  }

  // Send events
  private emitEvent<T>(event: string, payload: T): UUID {
    const requestId = this.generateRequestId();
    const timestamp = new Date().toISOString();

    this.socket?.emit(event, {
      requestId,
      timestamp,
      payload,
    });

    return requestId;
  }

  private generateRequestId(): UUID {
    // Generate UUID v4
    return this.generateUUID() as UUID;
  }

  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Conversation events
  joinConversation(conversationId: UUID): Promise<UUID> {
    return new Promise((resolve, reject) => {
      const requestId = this.emitEvent("conversation:join", {
        conversationId,
      });

      const ackListener = (id: UUID) => {
        if (id === requestId) {
          this.removeAckListener(ackListener);
          resolve(requestId);
        }
      };

      const errorListener = (
        id: UUID,
        errorCode: string,
        errorMessage: string,
      ) => {
        if (id === requestId) {
          this.removeErrorListener(errorListener);
          reject(new Error(`${errorCode}: ${errorMessage}`));
        }
      };

      this.listeners.systemAck.add(ackListener);
      this.listeners.systemError.add(errorListener);
    });
  }

  leaveConversation(conversationId: UUID): Promise<UUID> {
    return new Promise((resolve, reject) => {
      const requestId = this.emitEvent("conversation:leave", {
        conversationId,
      });

      const ackListener = (id: UUID) => {
        if (id === requestId) {
          this.removeAckListener(ackListener);
          resolve(requestId);
        }
      };

      const errorListener = (
        id: UUID,
        errorCode: string,
        errorMessage: string,
      ) => {
        if (id === requestId) {
          this.removeErrorListener(errorListener);
          reject(new Error(`${errorCode}: ${errorMessage}`));
        }
      };

      this.listeners.systemAck.add(ackListener);
      this.listeners.systemError.add(errorListener);
    });
  }

  // Presence events
  subscribePresence(targets: UUID[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const requestId = this.emitEvent("presence:subscribe", { targets });

      const ackListener = (id: UUID) => {
        if (id === requestId) {
          this.removeAckListener(ackListener);
          resolve();
        }
      };

      const errorListener = (
        id: UUID,
        errorCode: string,
        errorMessage: string,
      ) => {
        if (id === requestId) {
          this.removeErrorListener(errorListener);
          reject(new Error(`${errorCode}: ${errorMessage}`));
        }
      };

      this.listeners.systemAck.add(ackListener);
      this.listeners.systemError.add(errorListener);
    });
  }

  // Chat events
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

      const ackListener = (id: UUID) => {
        if (id === requestId) {
          this.removeAckListener(ackListener);
          resolve();
        }
      };

      const errorListener = (
        id: UUID,
        errorCode: string,
        errorMessage: string,
      ) => {
        if (id === requestId) {
          this.removeErrorListener(errorListener);
          reject(new Error(`${errorCode}: ${errorMessage}`));
        }
      };

      this.listeners.systemAck.add(ackListener);
      this.listeners.systemError.add(errorListener);
    });
  }

  markDelivered(conversationId: UUID, messageId: UUID): void {
    this.emitEvent("chat:delivered", {
      conversationId,
      messageId,
    });
  }

  markRead(conversationId: UUID, messageIds: UUID[]): void {
    this.emitEvent("chat:read", {
      conversationId,
      messageIds,
    });
  }

  // Listener management
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

  private removeAckListener(listener: SystemAckListener) {
    this.listeners.systemAck.delete(listener);
  }

  private removeErrorListener(listener: SystemErrorListener) {
    this.listeners.systemError.delete(listener);
  }
}

export const socketManager = new SocketManager();
