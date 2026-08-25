import { checkDatabase } from "../../../lib/db/pool.js";
import { checkRequiredTables } from "../../../lib/db/schema.js";
import { isSupabaseConfigured } from "../../../lib/supabase/server.js";
import { json } from "../../../lib/api.js";

export async function GET() {
  const database = await checkDatabase().catch((error) => ({
    configured: true,
    ok: false,
    message: error.message
  }));

  const schema =
    database.configured && database.ok
      ? await checkRequiredTables().catch((error) => ({ ok: false, message: error.message }))
      : { ok: false, message: "Database is not configured." };

  return json({
    status: "ok",
    service: "taller-automotriz-pablo",
    runtime: "next-app-router",
    supabase: {
      configured: isSupabaseConfigured()
    },
    database,
    schema
  });
}
