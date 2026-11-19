import { createClient } from "@supabase/supabase-js";

// Vite reads these values from .env.local during local development and from
// Vercel environment variables during a deployment.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// The publishable key is safe for browser code because database access is
// restricted by Supabase authentication and Row Level Security policies.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

// Avoid constructing the client when configuration is missing so App can show
// a useful setup message instead of failing with a blank page.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null;
