// This file points to the external Supabase project (ovugummbxablwmbpbbhj).
// Intentionally NOT using VITE_SUPABASE_* env vars here, to keep production
// pinned to the current Supabase project.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = 'https://ovugummbxablwmbpbbhj.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_XwUfPbOV_-pVNB15CS0CUw_psjr6oTw';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
