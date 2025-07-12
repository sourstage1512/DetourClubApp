import { createClient } from "@supabase/supabase-js";

// Replace "YOUR_SUPABASE_URL" and "YOUR_ANON_KEY" with the values you copied.
const supabaseUrl = "https://wcoefpouzysdoyptlsam.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indjb2VmcG91enlzZG95cHRsc2FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMDkwNjAsImV4cCI6MjA2NjU4NTA2MH0.hFdAajfSijS-t-nYbgPsrZaTQSzRJURH9Wgg7ZmK_QQ";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
