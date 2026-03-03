// env.ts

// -----------------------------------------------------------------------------
// IMPORTANT: PASTE YOUR SECRET KEYS HERE
// -----------------------------------------------------------------------------
// This file is used to configure your application's API keys and secrets.
//
// How to get your keys:
// 1. SUPABASE_URL & SUPABASE_ANON_KEY:
//    - Go to your Supabase project -> Settings (Gear icon) -> API.
//    - Copy the 'Project URL' and the 'anon' 'public' key.
// 2. GEMINI_API_KEY:
//    - Visit the Google AI Studio to generate an API key:
//      https://aistudio.google.com/app/apikey
// -----------------------------------------------------------------------------

export const GOOGLE_CLIENT_ID = '1046189549493-bcht5m68nd62cbkgmi5b9jd08oqa6mmv.apps.googleusercontent.com';

// IMPORTANT: Replace with your Supabase Project URL and Anon Key
// from your Supabase project settings > API.
export const SUPABASE_URL = 'https://cknzcxdctnecextrftln.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrbnpjeGRjdG5lY2V4dHJmdGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyOTIzODUsImV4cCI6MjA4Nzg2ODM4NX0.e1ZGEJVI8563ET9CIVMYexkyAU1dgEOtjW_-cRJfipU';
// IMPORTANT: Replace with your Gemini API Key from Google AI Studio.
// The AI features (Insights, Bill Scanning) will not work without this.
export const GEMINI_API_KEY = 'AIzaSyAZ7NYYVOdaqrnoytXb1wl20OQt2E0lUj4';

