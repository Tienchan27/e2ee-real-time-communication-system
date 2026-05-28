import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { Server } from "socket.io";
import { loadConfig } from "./config.js";
import { createSocketAuthMiddleware } from "./socket/auth.js";
import { ConnectionStore } from "./stores/connectionStore.js";

const config = loadConfig();
const connectionStore = new ConnectionStore();

function sendJson(res: ServerResponse, statusCode: number, data: Record<string, unknown>) {
  // Ham nho giup cac endpoint tra ve JSON co format giong nhau.
  const body = JSON.stringify(data);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  // Healthcheck de Docker biet realtime service dang song.
  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, {
      status: "ok",
      service: "realtime-service",
    });
    return;
  }

  // Readycheck don gian cho giai doan khoi dau du an.
  if (req.method === "GET" && url.pathname === "/ready") {
    sendJson(res, 200, {
      status: "ready",
      socketCorsOrigins: config.socketOrigins,
      authMode: config.allowDevSocketAuth ? "jwt-or-dev-token" : "jwt",
      connections: connectionStore.getStats(),
    });
    return;
  }

  sendJson(res, 404, {
    error: "Not Found",
    path: url.pathname,
  });
});

const io = new Server(server, {
  cors: {
    origin: config.socketOrigins,
  },
});

io.use(createSocketAuthMiddleware(config));

io.on("connection", (socket) => {
  const auth = socket.data.auth;
  const presence = connectionStore.addSocket(socket.id, auth);

  // Log metadata can thiet, khong log token de tranh lo thong tin nhay cam.
  console.log(
    `socket connected: socketId=${socket.id} userId=${auth.userId} deviceId=${auth.deviceId}`,
  );
  console.log(`presence changed: userId=${presence.userId} status=${presence.status}`);

  socket.on("disconnect", (reason) => {
    const updatedPresence = connectionStore.removeSocket(socket.id);

    console.log(`socket disconnected: socketId=${socket.id} reason=${reason}`);
    if (updatedPresence) {
      console.log(
        `presence changed: userId=${updatedPresence.userId} status=${updatedPresence.status}`,
      );
    }
  });
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(`realtime-service listening on port ${config.port}`);
});
