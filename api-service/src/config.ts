export const config = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl:
    process.env.DATABASE_URL ?? "postgresql://e2ee_user:e2ee_pass@localhost:5432/e2ee_app",
  corsOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};
