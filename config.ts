// This file reads configuration from the `env.ts` file.
// For local development, ensure that your `env.ts` file
// in the root of your project contains your Supabase and Gemini credentials.

// FIX: The project's TypeScript configuration does not recognize `import.meta.env`.
// This change sources the configuration from the `env.ts` file instead, which
// contains the necessary API keys.
export { SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY } from './env';
