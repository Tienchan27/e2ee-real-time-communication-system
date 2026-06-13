import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceRoot = resolve(__dirname, "..");

function loadEnvFile() {
  const envPath = resolve(serviceRoot, ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

export const config = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl:
    process.env.DATABASE_URL ?? "postgresql://postgres:admin@localhost:5432/e2ee_app",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? "change-me-access",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? "change-me-refresh",
  apiInternalToken: process.env.API_INTERNAL_TOKEN ?? "change-me",
  accessTokenTtlSec: Number(process.env.ACCESS_TOKEN_TTL_SEC ?? 15 * 60),
  refreshTokenTtlSec: Number(process.env.REFRESH_TOKEN_TTL_SEC ?? 30 * 24 * 60 * 60),
  corsOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "",
  },
};
