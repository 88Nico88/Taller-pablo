import { checkDatabase } from "../../../../lib/db/pool.js";
import { checkRequiredTables } from "../../../../lib/db/schema.js";
import { json } from "../../../../lib/api.js";

export async function GET() {
  const database = await checkDatabase().catch((error) => ({
    configured: true,
    ok: false,
    message: error.message
  }));

  if (!database.ok) {
    return json({ database }, { status: database.configured ? 503 : 200 });
  }

  const schema = await checkRequiredTables();
  return json({ database, schema }, { status: schema.ok ? 200 : 503 });
}
