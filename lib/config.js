export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "",
  databaseSsl: parseBoolean(process.env.DATABASE_SSL, process.env.NODE_ENV === "production"),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-before-production",
  adminEmail: process.env.ADMIN_EMAIL || "admin@taller.local",
  adminPassword: process.env.ADMIN_PASSWORD || "admin12345",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ""
};

export function parseBoolean(value, fallback = false) {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}
