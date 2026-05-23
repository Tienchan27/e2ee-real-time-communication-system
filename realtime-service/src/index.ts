import http from "node:http";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { Server } from "socket.io";

const port = Number(process.env.PORT ?? 4000);
const corsOrigins = (process.env.SOCKET_CORS_ORIGINS ?? "http://localhost")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();
app.use(cors({ origin: corsOrigins, credentials: true }));

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: { status: "ok" },
    meta: {},
  });
});

const httpServer = http.createServer(app);

// RT-02: handshake auth — owner implements per docs/03-events.md
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins,
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);
});

httpServer.listen(port, () => {
  console.log(`realtime-service listening on :${port}`);
});
