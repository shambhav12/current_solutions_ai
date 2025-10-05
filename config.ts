// This file reads configuration from env.ts.
// For local development, create a `.env.local` file in the root of your project
// and add your Supabase credentials there.
//
// VITE_SUPABASE_URL="YOUR_SUPABASE_URL"
// VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"

// FIX: Switched from using `import.meta.env` to importing from `env.ts` to resolve TypeScript errors and centralize configuration.
import { SUPABASE_URL as SU_URL, SUPABASE_ANON_KEY as SU_KEY } from './env';

export const SUPABASE_URL = SU_URL;
export const SUPABASE_ANON_KEY = SU_KEY;
