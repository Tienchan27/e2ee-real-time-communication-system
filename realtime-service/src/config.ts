export type AppConfig = {
  port: number;
  nodeEnv: string;
  socketOrigins: string[];
  jwtAccessSecret: string;
  allowDevSocketAuth: boolean;
};

function readCsvEnv(value: string | undefined, fallback: string): string[] {
  // Tach bien moi truong dang CSV thanh mang origin hop le cho Socket.IO CORS.
  return (value || fallback)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV || "development";

  return {
    port: Number(process.env.PORT || 4000),
    nodeEnv,
    socketOrigins: readCsvEnv(
      process.env.SOCKET_CORS_ORIGINS || process.env.CLIENT_URL,
      "http://localhost",
    ),
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "",
    // Cho phep dung token dev khi API login/JWT chua hoan thien.
    allowDevSocketAuth: nodeEnv !== "production",
  };
}
