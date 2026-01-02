
import { createClient } from '@supabase/supabase-js';

// Access environment variables based on standard patterns
const supabaseUrl = process.env.SUPABASE_URL || (window as any).process?.env?.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || (window as any).process?.env?.SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!supabase) {
  console.warn('Supabase credentials missing. App will function in offline/local-only mode.');
}
