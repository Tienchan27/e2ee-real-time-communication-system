function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: required("DATABASE_URL"),
  corsOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};
