import type { Server, Socket } from "socket.io";
import type { ConversationAccessService } from "../services/conversationAccess.js";
import type { CallStore, CallType } from "../stores/callStore.js";
import { isObject, isUuid, readClientEvent, readRequestId } from "./events.js";
import { conversationRoomName } from "./rooms.js";
import { emitAck, emitError } from "./system.js";

type CallStartPayload = {
  callId: string;
  conversationId: string;
  callType: CallType;
};

type CallStatePayload = {
  callId: string;
  conversationId: string;
  reason?: string;
};

type CallSdpPayload = {
  callId: string;
  conversationId: string;
  sdp: string;
  sdpType: "offer" | "answer";
};

type CallIcePayload = {
  callId: string;
  conversationId: string;
  candidate: Record<string, unknown>;
};

function readCallStartPayload(payload: Record<string, unknown>): CallStartPayload {
  if (
    !isUuid(payload.callId) ||
    !isUuid(payload.conversationId) ||
    (payload.callType !== "voice" && payload.callType !== "video")
  ) {
    throw new Error("VALIDATION_FAILED");
  }

  return {
    callId: payload.callId,
    conversationId: payload.conversationId,
    callType: payload.callType,
  };
}

function readCallStatePayload(payload: Record<string, unknown>): CallStatePayload {
  if (!isUuid(payload.callId) || !isUuid(payload.conversationId)) {
    throw new Error("VALIDATION_FAILED");
  }

  if (payload.reason !== undefined && typeof payload.reason !== "string") {
    throw new Error("VALIDATION_FAILED");
  }

  return {
    callId: payload.callId,
    conversationId: payload.conversationId,
    ...(payload.reason ? { reason: payload.reason } : {}),
  };
}

function readCallSdpPayload(payload: Record<string, unknown>): CallSdpPayload {
  if (
    !isUuid(payload.callId) ||
    !isUuid(payload.conversationId) ||
    typeof payload.sdp !== "string" ||
    (payload.sdpType !== "offer" && payload.sdpType !== "answer")
  ) {
    throw new Error("VALIDATION_FAILED");
  }

  return {
    callId: payload.callId,
    conversationId: payload.conversationId,
    sdp: payload.sdp,
    sdpType: payload.sdpType,
  };
}

function readCallIcePayload(payload: Record<string, unknown>): CallIcePayload {
  if (!isUuid(payload.callId) || !isUuid(payload.conversationId) || !isObject(payload.candidate)) {
    throw new Error("VALIDATION_FAILED");
  }

  return {
    callId: payload.callId,
    conversationId: payload.conversationId,
    candidate: payload.candidate,
  };
}

async function ensureConversationAccess(
  socket: Socket,
  accessService: ConversationAccessService,
  conversationId: string,
): Promise<boolean> {
  const auth = socket.data.auth;
  return accessService.canJoinConversation(auth.userId, conversationId);
}

function emitCallStateToRoom(
  socket: Socket,
  eventName: "call:accept" | "call:reject" | "call:end",
  payload: CallStatePayload,
) {
  socket.to(conversationRoomName(payload.conversationId)).emit(eventName, {
    ...payload,
    senderUserId: socket.data.auth.userId,
    senderDeviceId: socket.data.auth.deviceId,
  });
}

export function registerCallHandlers(
  socket: Socket,
  accessService: ConversationAccessService,
  callStore: CallStore,
) {
  socket.on("call:start", async (data: unknown) => {
    const requestId = readRequestId(data);

    try {
      const event = readClientEvent(data, readCallStartPayload);
      const auth = socket.data.auth;

      if (!(await ensureConversationAccess(socket, accessService, event.payload.conversationId))) {
        emitError(socket, event.requestId, "PERMISSION_DENIED", "You are not allowed to start this call.");
        return;
      }

      const call = callStore.startCall({
        callId: event.payload.callId,
        conversationId: event.payload.conversationId,
        callerUserId: auth.userId,
        callerDeviceId: auth.deviceId,
        callType: event.payload.callType,
      });

      // RT-20: Caller tao call, realtime phat call:incoming cho peer trong conversation room.
      socket.to(conversationRoomName(call.conversationId)).emit("call:incoming", {
        callId: call.callId,
        conversationId: call.conversationId,
        callerUserId: call.callerUserId,
        callType: call.callType,
        expiresAt: call.expiresAt,
      });

      emitAck(socket, event.requestId, {
        callId: call.callId,
        conversationId: call.conversationId,
        expiresAt: call.expiresAt,
      });
    } catch (error) {
      emitError(
        socket,
        requestId,
        error instanceof Error && error.message === "CALL_STATE_CONFLICT"
          ? "CALL_STATE_CONFLICT"
          : error instanceof Error && error.message === "VALIDATION_FAILED"
            ? "VALIDATION_FAILED"
            : "INTERNAL_ERROR",
        "Failed to start call.",
        false,
      );
    }
  });

  socket.on("call:accept", async (data: unknown) => {
    await handleCallStateEvent(socket, accessService, callStore, data, "call:accept");
  });

  socket.on("call:reject", async (data: unknown) => {
    await handleCallStateEvent(socket, accessService, callStore, data, "call:reject");
  });

  socket.on("call:end", async (data: unknown) => {
    await handleCallStateEvent(socket, accessService, callStore, data, "call:end");
  });

  socket.on("call:offer", async (data: unknown) => {
    await handleCallRelayEvent(socket, accessService, callStore, data, "call:offer", readCallSdpPayload);
  });

  socket.on("call:answer", async (data: unknown) => {
    await handleCallRelayEvent(socket, accessService, callStore, data, "call:answer", readCallSdpPayload);
  });

  socket.on("call:ice", async (data: unknown) => {
    await handleCallRelayEvent(socket, accessService, callStore, data, "call:ice", readCallIcePayload);
  });
}

async function handleCallStateEvent(
  socket: Socket,
  accessService: ConversationAccessService,
  callStore: CallStore,
  data: unknown,
  eventName: "call:accept" | "call:reject" | "call:end",
) {
  const requestId = readRequestId(data);

  try {
    const event = readClientEvent(data, readCallStatePayload);

    if (!(await ensureConversationAccess(socket, accessService, event.payload.conversationId))) {
      emitError(socket, event.requestId, "PERMISSION_DENIED", "You are not allowed to update this call.");
      return;
    }

    if (eventName === "call:accept") {
      callStore.acceptCall(event.payload.callId, socket.data.auth.userId);
    } else {
      callStore.endCall(event.payload.callId);
    }

    // RT-21: accept/reject/end chi cap nhat state ngan han va relay sang peer.
    emitCallStateToRoom(socket, eventName, event.payload);
    emitAck(socket, event.requestId, {
      eventName,
      callId: event.payload.callId,
      conversationId: event.payload.conversationId,
    });
  } catch (error) {
    emitError(
      socket,
      requestId,
      error instanceof Error && error.message === "CALL_STATE_CONFLICT"
        ? "CALL_STATE_CONFLICT"
        : error instanceof Error && error.message === "VALIDATION_FAILED"
          ? "VALIDATION_FAILED"
          : "INTERNAL_ERROR",
      `Failed to handle ${eventName}.`,
      false,
    );
  }
}

async function handleCallRelayEvent<TPayload extends { callId: string; conversationId: string }>(
  socket: Socket,
  accessService: ConversationAccessService,
  callStore: CallStore,
  data: unknown,
  eventName: "call:offer" | "call:answer" | "call:ice",
  readPayload: (payload: Record<string, unknown>) => TPayload,
) {
  const requestId = readRequestId(data);

  try {
    const event = readClientEvent(data, readPayload);
    const call = callStore.getCall(event.payload.callId);

    if (!call || call.status === "ended") {
      throw new Error("CALL_STATE_CONFLICT");
    }

    if (!(await ensureConversationAccess(socket, accessService, event.payload.conversationId))) {
      emitError(socket, event.requestId, "PERMISSION_DENIED", "You are not allowed to relay this call event.");
      return;
    }

    // RT-22: offer/answer/ice chi la signaling WebRTC; media van di P2P/TURN, khong qua realtime.
    socket.to(conversationRoomName(event.payload.conversationId)).emit(eventName, {
      ...event.payload,
      senderUserId: socket.data.auth.userId,
      senderDeviceId: socket.data.auth.deviceId,
    });

    emitAck(socket, event.requestId, {
      eventName,
      callId: event.payload.callId,
      conversationId: event.payload.conversationId,
    });
  } catch (error) {
    emitError(
      socket,
      requestId,
      error instanceof Error && error.message === "CALL_STATE_CONFLICT"
        ? "CALL_STATE_CONFLICT"
        : error instanceof Error && error.message === "VALIDATION_FAILED"
          ? "VALIDATION_FAILED"
          : "INTERNAL_ERROR",
      `Failed to relay ${eventName}.`,
      false,
    );
  }
}

export function startCallCleanupInterval(io: Server, callStore: CallStore, intervalMs: number) {
  const interval = setInterval(() => {
    for (const call of callStore.cleanupExpiredRingingCalls()) {
      // RT-23: Cuoc goi ringing het han se duoc thong bao miss/timeout cho room.
      io.to(conversationRoomName(call.conversationId)).emit("call:end", {
        callId: call.callId,
        conversationId: call.conversationId,
        reason: "timeout",
      });
    }
  }, intervalMs);

  return interval;
}
