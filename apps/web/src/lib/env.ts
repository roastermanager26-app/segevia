import { WebEnv } from "./contracts";

const parsed = WebEnv.safeParse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

export const env = parsed.success ? parsed.data : null;
export const envIssues = parsed.success
  ? []
  : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
