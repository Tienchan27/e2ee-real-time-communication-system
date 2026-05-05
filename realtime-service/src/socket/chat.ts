import type { Socket } from "socket.io";
import type { ConversationAccessService } from "../services/conversationAccess.js";
import type { MessagePersistenceService } from "../services/messagePersistence.js";
import type { DedupeResult, DedupeStore } from "../stores/dedupeStore.js";
import type { NonceReplayStore } from "../stores/nonceReplayStore.js";
import { isObject, isUuid, readClientEvent, readRequestId } from "./events.js";
import { conversationRoomName } from "./rooms.js";
import { emitAck, emitError } from "./system.js";

type ChatSendPayload = {
  conversationId: string;
  messageId: string;
  ciphertext: string;
  nonce: string;
  algorithm: "aes-256-gcm";
  keyVersion: number;
  aad?: Record<string, unknown>;
  clientMessageSeq: number;
};

function isBase64(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  // Kiem tra base64 o muc wire-format: server chi validate shape, khong giai ma plaintext.
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length % 4 === 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function readChatSendPayload(payload: Record<string, unknown>): ChatSendPayload {
  if (!isUuid(payload.conversationId) || !isUuid(payload.messageId)) {
    throw new Error("VALIDATION_FAILED");
  }

  if (!isBase64(payload.ciphertext) || !isBase64(payload.nonce)) {
    throw new Error("VALIDATION_FAILED");
  }

  if (payload.algorithm !== "aes-256-gcm") {
    throw new Error("VALIDATION_FAILED");
  }

  if (!isPositiveInteger(payload.keyVersion) || !isNonNegativeInteger(payload.clientMessageSeq)) {
    throw new Error("VALIDATION_FAILED");
  }

  if (payload.aad !== undefined && !isObject(payload.aad)) {
    throw new Error("VALIDATION_FAILED");
  }

  return {
    conversationId: payload.conversationId,
    messageId: payload.messageId,
    ciphertext: payload.ciphertext,
    nonce: payload.nonce,
    algorithm: payload.algorithm,
    keyVersion: payload.keyVersion,
    ...(payload.aad ? { aad: payload.aad } : {}),
    clientMessageSeq: payload.clientMessageSeq,
  };
}

function replayDedupeResult(socket: Socket, requestId: string, result: DedupeResult) {
  // Khi client retry cung requestId, server tra lai ket qua cu thay vi persist/fanout lan nua.
  if (result.type === "success") {
    emitAck(socket, requestId, {
      ...result.meta,
      dedupedByRealtime: true,
    });
    return;
  }

  emitError(
    socket,
    requestId,
    result.errorCode,
    result.errorMessage,
    result.retryable,
    result.details,
  );
}

export function registerChatHandlers(
  socket: Socket,
  accessService: ConversationAccessService,
  persistenceService: MessagePersistenceService,
  dedupeStore: DedupeStore,
  nonceReplayStore: NonceReplayStore,
) {
  socket.on("chat:send", async (data: unknown) => {
    const requestId = readRequestId(data);

    try {
      // RT-07: Doc va validate dung contract chat:send trong docs/03-events.md.
      const event = readClientEvent(data, readChatSendPayload);
      const auth = socket.data.auth;

      // RT-08: Khong tin senderUserId tu client; lay userId tu auth context cua socket.
      const canSend = await accessService.canJoinConversation(
        auth.userId,
        event.payload.conversationId,
      );

      if (!canSend) {
        emitError(
          socket,
          event.requestId,
          "PERMISSION_DENIED",
          "You are not allowed to send messages in this conversation.",
        );
        return;
      }

      const dedupeKey = dedupeStore.createKey({
        requestId: event.requestId,
        senderDeviceId: auth.deviceId,
        conversationId: event.payload.conversationId,
      });
      const existingResult = dedupeStore.get(dedupeKey);

      if (existingResult) {
        replayDedupeResult(socket, event.requestId, existingResult);
        return;
      }

      const nonceReplayKey = nonceReplayStore.createKey({
        senderDeviceId: auth.deviceId,
        conversationId: event.payload.conversationId,
        nonce: event.payload.nonce,
        keyVersion: event.payload.keyVersion,
      });

      if (nonceReplayStore.has(nonceReplayKey)) {
        const errorResult = {
          type: "error" as const,
          errorCode: "REPLAY_DETECTED" as const,
          errorMessage: "Message nonce was already used for this device and key version.",
          retryable: false,
          details: {
            conversationId: event.payload.conversationId,
            messageId: event.payload.messageId,
            keyVersion: event.payload.keyVersion,
          },
        };

        // RT-14: Cung nonce trong cung device/conversation/keyVersion la dau hieu replay.
        emitError(
          socket,
          event.requestId,
          errorResult.errorCode,
          errorResult.errorMessage,
          errorResult.retryable,
          errorResult.details,
        );
        dedupeStore.set(dedupeKey, errorResult);
        return;
      }

      try {
        // RT-09: Goi API internal persist. Server chi gui ciphertext envelope, khong co plaintext.
        const persistResult = await persistenceService.persistMessage({
          requestId: event.requestId,
          messageId: event.payload.messageId,
          conversationId: event.payload.conversationId,
          senderUserId: auth.userId,
          senderDeviceId: auth.deviceId,
          envelope: {
            ciphertext: event.payload.ciphertext,
            nonce: event.payload.nonce,
            algorithm: event.payload.algorithm,
            keyVersion: event.payload.keyVersion,
            ...(event.payload.aad ? { aad: event.payload.aad } : {}),
            clientMessageSeq: event.payload.clientMessageSeq,
          },
        });

        const successMeta = {
          messageId: event.payload.messageId,
          conversationId: event.payload.conversationId,
          stored: persistResult.stored,
          deduped: persistResult.deduped,
          createdAt: persistResult.createdAt,
        };

        // RT-10: Ack sender sau khi persist thanh cong de FE biet message da duoc server nhan.
        emitAck(socket, event.requestId, successMeta);

        // RT-12: Fanout ciphertext cho cac socket khac trong conversation room.
        socket.to(conversationRoomName(event.payload.conversationId)).emit("chat:message", {
          messageId: event.payload.messageId,
          conversationId: event.payload.conversationId,
          senderUserId: auth.userId,
          senderDeviceId: auth.deviceId,
          ciphertext: event.payload.ciphertext,
          nonce: event.payload.nonce,
          algorithm: event.payload.algorithm,
          keyVersion: event.payload.keyVersion,
          ...(event.payload.aad ? { aad: event.payload.aad } : {}),
          createdAt: persistResult.createdAt,
        });

        nonceReplayStore.markUsed(nonceReplayKey);

        // RT-13: Luu ket qua de retry cung requestId khong tao message/fanout trung.
        dedupeStore.set(dedupeKey, {
          type: "success",
          meta: successMeta,
        });
      } catch (persistError) {
        const errorResult = {
          type: "error" as const,
          errorCode: "MESSAGE_PERSIST_FAILED" as const,
          errorMessage: "Message persistence failed.",
          retryable: true,
          details: {
            reason: persistError instanceof Error ? persistError.message : "UNKNOWN",
            conversationId: event.payload.conversationId,
            messageId: event.payload.messageId,
          },
        };

        // RT-11: Loi persist la loi co the retry, vi client co the gui lai cung requestId.
        emitError(
          socket,
          event.requestId,
          errorResult.errorCode,
          errorResult.errorMessage,
          errorResult.retryable,
          errorResult.details,
        );
        dedupeStore.set(dedupeKey, errorResult);
      }
    } catch (error) {
      const errorCode =
        error instanceof Error && error.message === "VALIDATION_FAILED"
          ? "VALIDATION_FAILED"
          : "INTERNAL_ERROR";

      emitError(
        socket,
        requestId,
        errorCode,
        "Invalid chat:send payload.",
        false,
      );
    }
  });
}
