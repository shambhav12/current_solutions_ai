import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

// --- Configuration Validation ---
// This check ensures that the developer has set up their .env.local file correctly.
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase URL or Anon Key is missing. Please create a `.env.local` file in the project root and add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` credentials. Refer to the README.md for more details.");
}

// Validate that the provided Supabase URL is a valid URL.
try {
    new URL(SUPABASE_URL);
} catch (e) {
    throw new Error(`Invalid Supabase URL provided. Please check the VITE_SUPABASE_URL in your .env.local file.`);
}


// Create a single supabase client for interacting with your database
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);