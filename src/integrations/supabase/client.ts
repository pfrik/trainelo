import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  // Don’t throw during builds/tests—just fail loudly in console.
  console.warn(
    "Supabase env vars missing: VITE_SUPABASE_URL and/or VITE_SUPABASE_PUBLISHABLE_KEY"
  );
}

const options =
  typeof window === "undefined"
    ? {}
    : {
        auth: {
          storage: window.localStorage,
          persistSession: true,
          autoRefreshToken: true,
        },
      };

// Untyped for now to avoid schema/type mismatch while DB is still evolving.
// TODO: Re-enable typed Database after schema is finalized + types regenerated.
export const supabase = createClient(
  SUPABASE_URL ?? "",
  SUPABASE_PUBLISHABLE_KEY ?? "",
  options as any
);
