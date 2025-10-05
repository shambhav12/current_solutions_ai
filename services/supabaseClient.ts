import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

// Add validation to provide a clear error message if the config is missing.
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase URL or Anon Key is missing. Please ensure `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in `config.ts`.");
}
try {
    new URL(SUPABASE_URL);
} catch (e) {
    throw new Error(`Invalid Supabase URL provided. Please check the SUPABASE_URL in your config.ts file.`);
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);