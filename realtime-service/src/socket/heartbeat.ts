import type { Server, Socket } from "socket.io";
import type { SocketActivityStore } from "../stores/socketActivityStore.js";

export function registerHeartbeatHandlers(socket: Socket, activityStore: SocketActivityStore) {
  activityStore.touch(socket.id);

  socket.on("heartbeat:pong", () => {
    // RT-25: Client co the pong chu dong; Socket.IO ping/pong van la lop thap hon.
    activityStore.touch(socket.id);
  });

  socket.onAny(() => {
    // Bat ky event hop le nao cung chung minh socket con dang hoat dong.
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
      if (socket) {
        socket.emit("heartbeat:ping", {
          serverTimestamp: new Date().toISOString(),
        });
        // RT-25: Socket stale bi dong de cleanup mapping/presence qua disconnect handler.
        socket.disconnect(true);
      }
      activityStore.remove(socketId);
    }
  }, intervalMs);

  return interval;
}
