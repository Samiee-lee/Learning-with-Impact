import { createClient } from '@supabase/supabase-js';

// These values are safe to ship to the browser (the anon key is public by design).
// They fall back to your project's values, but you can override them later with
// Vercel environment variables without touching this file.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://qtmlyfkltilbhwclmxvb.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0bWx5ZmtsdGlsYmh3Y2xteHZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNzg3MTAsImV4cCI6MjA5ODg1NDcxMH0.EykxHBJjZK4oet8bfIpf2eRxKeq8euXA3Cn-Oz9j1MU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
