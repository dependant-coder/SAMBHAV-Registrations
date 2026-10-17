import { createClient } from '@supabase/supabase-js';

const defaultSupabaseUrl = 'https://cshmcevqedzveldnrgmq.supabase.co';
const defaultSupabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzaG1jZXZxZWR6dmVsZG5yZ21xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0Njc1NDcsImV4cCI6MjEwNzA0MzU0N30.fU9Kn-f-H8v7xudehi9BJ9RfM_qMA71naoxZBbEI_RM';

export const rawUrl = ((import.meta.env.VITE_SUPABASE_URL as string) || defaultSupabaseUrl).trim().replace(/^["']|["']$/g, '');
export const supabaseAnonKey = ((import.meta.env.VITE_SUPABASE_ANON_KEY as string) || defaultSupabaseAnonKey).trim().replace(/^["']|["']$/g, '');

const getClientUrl = () => {
  if (typeof window !== 'undefined' && import.meta.env.DEV && window.location?.origin) {
    return `${window.location.origin}/supabase-proxy`;
  }
  return rawUrl;
};

export const isSupabaseConfigured = Boolean(
  rawUrl && supabaseAnonKey && !rawUrl.includes('placeholder')
);

export const supabase = createClient(
  getClientUrl(),
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

export const anonSupabase = createClient(
  getClientUrl(),
  supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
