import type { Server, Socket } from "socket.io";
import type { SocketActivityStore } from "../stores/socketActivityStore.js";

export function registerHeartbeatHandlers(socket: Socket, activityStore: SocketActivityStore) {
  activityStore.touch(socket.id);

  socket.on("heartbeat:pong", () => {
    activityStore.touch(socket.id);
  });

  socket.onAny(() => {
    activityStore.touch(socket.id);
  });

  // Engine.io ping/pong tang transport (moi pingInterval) cung tinh la "con song".
  // Nho vay socket idle-nhung-con-ket-noi khong bao gio bi coi la stale; chi socket
  // chet that (ngung gui packet) moi bi don dep (engine.io cung tu drop bang pingTimeout).
  socket.conn.on("packet", () => {
    activityStore.touch(socket.id);
  });
}

export function startHeartbeatCleanupInterval(
  io: Server,
  activityStore: SocketActivityStore,
  intervalMs: number,
) {
  const interval = setInterval(() => {
    for (const socketId of activityStore.findStaleSocketIds()) {
      const socket = io.sockets.sockets.get(socketId);
      // Socket thuc su chet (khong con packet transport) -> dong va don.
      socket?.disconnect(true);
      activityStore.remove(socketId);
    }
  }, intervalMs);

  return interval;
}
