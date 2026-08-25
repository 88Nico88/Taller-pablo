import { query } from "./pool.js";

export const requiredTables = [
  "users",
  "customers",
  "vehicles",
  "work_orders",
  "inspections",
  "parts",
  "stock_movements",
  "work_order_parts"
];

export async function checkRequiredTables() {
  const result = await query(
    `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1::text[])
      order by table_name
    `,
    [requiredTables]
  );
  const present = result.rows.map((row) => row.table_name);
  const missing = requiredTables.filter((table) => !present.includes(table));
  return {
    ok: missing.length === 0,
    present,
    missing
  };
}
