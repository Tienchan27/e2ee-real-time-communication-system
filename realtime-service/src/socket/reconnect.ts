import type { Socket } from "socket.io";
import type { ConversationAccessService } from "../services/conversationAccess.js";
import type { ConnectionStore } from "../stores/connectionStore.js";
import type { PresenceSubscriptionStore } from "../stores/presenceSubscriptionStore.js";
import { isUuid, readClientEvent, readRequestId } from "./events.js";
import { conversationRoomName } from "./rooms.js";
import { emitAck, emitError } from "./system.js";

type RealtimeResubscribePayload = {
  conversationIds: string[];
  presenceTargets: string[];
};

function readUuidArray(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((item) => !isUuid(item))) {
    throw new Error("VALIDATION_FAILED");
  }

  return value;
}

function readRealtimeResubscribePayload(
  payload: Record<string, unknown>,
): RealtimeResubscribePayload {
  return {
    conversationIds: readUuidArray(payload.conversationIds),
    presenceTargets: readUuidArray(payload.presenceTargets),
  };
}

export function registerReconnectHandlers(
  socket: Socket,
  accessService: ConversationAccessService,
  connectionStore: ConnectionStore,
  presenceSubscriptionStore: PresenceSubscriptionStore,
) {
  socket.on("realtime:resubscribe", async (data: unknown) => {
    const requestId = readRequestId(data);

    try {
      const event = readClientEvent(data, readRealtimeResubscribePayload);
      const auth = socket.data.auth;
      const joinedConversationIds: string[] = [];

      for (const conversationId of event.payload.conversationIds) {
        const canJoin = await accessService.canJoinConversation(auth.userId, conversationId);
        if (!canJoin) {
          emitError(socket, event.requestId, "PERMISSION_DENIED", "Cannot resubscribe to conversation.");
          return;
        }

        await socket.join(conversationRoomName(conversationId));
        joinedConversationIds.push(conversationId);
      }

      if (event.payload.presenceTargets.length > 0) {
        presenceSubscriptionStore.subscribe(socket.id, event.payload.presenceTargets);

        for (const targetUserId of event.payload.presenceTargets) {
          socket.emit("presence:update", connectionStore.getPresence(targetUserId));
        }
      }

      emitAck(socket, event.requestId, {
        joinedConversationCount: joinedConversationIds.length,
        presenceTargetCount: event.payload.presenceTargets.length,
      });
    } catch (error) {
      emitError(
        socket,
        requestId,
        error instanceof Error && error.message === "VALIDATION_FAILED"
          ? "VALIDATION_FAILED"
          : "INTERNAL_ERROR",
        "Failed to resubscribe realtime state.",
        false,
      );
    }
  });
}
