import type { Socket } from "socket.io";
import type { ConversationAccessService } from "../services/conversationAccess.js";
import { isUuid, readClientEvent, readRequestId } from "./events.js";
import { emitAck, emitError } from "./system.js";

type ConversationRoomPayload = {
  conversationId: string;
};

export function conversationRoomName(conversationId: string): string {
  // Prefix giup tranh nham room conversation voi room user/call trong tuong lai.
  return `conversation:${conversationId}`;
}

function readConversationRoomPayload(payload: Record<string, unknown>): ConversationRoomPayload {
  if (!isUuid(payload.conversationId)) {
    throw new Error("VALIDATION_FAILED");
  }

  return {
    conversationId: payload.conversationId,
  };
}

export function registerRoomHandlers(socket: Socket, accessService: ConversationAccessService) {
  socket.on("conversation:join", async (data: unknown) => {
    const requestId = readRequestId(data);

    try {
      const event = readClientEvent(data, readConversationRoomPayload);
      const auth = socket.data.auth;
      const canJoin = await accessService.canJoinConversation(
        auth.userId,
        event.payload.conversationId,
      );

      if (!canJoin) {
        emitError(
          socket,
          event.requestId,
          "PERMISSION_DENIED",
          "You are not allowed to join this conversation.",
        );
        return;
      }

      const roomName = conversationRoomName(event.payload.conversationId);
      await socket.join(roomName);

      emitAck(socket, event.requestId, {
        conversationId: event.payload.conversationId,
        roomName,
      });
    } catch (error) {
      emitError(
        socket,
        requestId,
        error instanceof Error && error.message === "VALIDATION_FAILED"
          ? "VALIDATION_FAILED"
          : "INTERNAL_ERROR",
        "Failed to join conversation room.",
        false,
      );
    }
  });

  socket.on("conversation:leave", async (data: unknown) => {
    const requestId = readRequestId(data);

    try {
      const event = readClientEvent(data, readConversationRoomPayload);
      const roomName = conversationRoomName(event.payload.conversationId);

      await socket.leave(roomName);

      emitAck(socket, event.requestId, {
        conversationId: event.payload.conversationId,
        roomName,
      });
    } catch (error) {
      emitError(
        socket,
        requestId,
        error instanceof Error && error.message === "VALIDATION_FAILED"
          ? "VALIDATION_FAILED"
          : "INTERNAL_ERROR",
        "Failed to leave conversation room.",
        false,
      );
    }
  });
}
