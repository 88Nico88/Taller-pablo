import pg from "pg";
import { config } from "../config.js";

const { Pool } = pg;
let pool;

export function isDatabaseConfigured() {
  return Boolean(config.databaseUrl);
}

export function getPool() {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
  }

  return pool;
}

export async function query(text, params = []) {
  return getPool().query(text, params);
}

export async function checkDatabase() {
  if (!isDatabaseConfigured()) {
    return {
      configured: false,
      ok: false,
      message: "DATABASE_URL is not configured."
    };
  }

  const result = await query("select now() as server_time, current_database() as database_name");
  return {
    configured: true,
    ok: true,
    serverTime: result.rows[0].server_time,
    databaseName: result.rows[0].database_name
  };
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
