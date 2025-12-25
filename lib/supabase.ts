import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);
const isSupabaseAdminConfigured = !!(supabaseUrl && supabaseServiceRoleKey);

if (!isSupabaseConfigured || !isSupabaseAdminConfigured) {
    console.warn('[Supabase] Configuration status:', {
        url: !!supabaseUrl,
        anonKey: !!supabaseAnonKey,
        serviceRoleKey: !!supabaseServiceRoleKey
    });
}

// For client-side usage
export const supabase = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null as any;

// For server-side usage (bypassing RLS for system tasks)
export const supabaseAdmin = isSupabaseAdminConfigured
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    : null as any;
