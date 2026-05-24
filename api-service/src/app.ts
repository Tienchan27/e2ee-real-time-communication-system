import express from "express";
import helmet from "helmet";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { pingDb } from "./db.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({
      success: true,
      data: { status: "ok" },
      meta: {},
    });
  });

  app.get("/ready", async (_req, res) => {
    const requestId = randomUUID();
    try {
      await pingDb();
      res.json({
        success: true,
        data: { status: "ready", database: "up" },
        meta: {},
      });
    } catch {
      res.status(503).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Database not ready",
          requestId,
        },
      });
    }
  });

  return app;
}
