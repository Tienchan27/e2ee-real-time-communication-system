import pg from "pg";
import { config } from "./config.js";

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
});

export async function pingDb(): Promise<void> {
  await pool.query("SELECT 1");
}
