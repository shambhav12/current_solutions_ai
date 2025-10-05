import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

// --- Configuration Validation ---
// This check ensures that the developer has set up their env.ts file correctly.
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase URL or Anon Key is missing. Please open the `env.ts` file in the project root and add your Supabase credentials. Refer to the README.md for more details.");
}

// Validate that the provided Supabase URL is a valid URL.
try {
    new URL(SUPABASE_URL);
} catch (e) {
    throw new Error(`Invalid Supabase URL provided. Please check the SUPABASE_URL in your env.ts file.`);
}


// Create a single supabase client for interacting with your database
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);