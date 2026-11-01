import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables from Vite
const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env || {};
const envUrl = metaEnv.VITE_SUPABASE_URL;
const envAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY;

// Check localStorage for manually configured Supabase credentials if env is missing
const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('nexmoney_sb_url') : null;
const storedKey = typeof window !== 'undefined' ? localStorage.getItem('nexmoney_sb_key') : null;

export const supabaseUrl = envUrl || storedUrl || '';
export const supabaseAnonKey = envAnonKey || storedKey || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  supabaseAnonKey.length > 20
);

// Fallback dummy client if not configured yet to prevent crash at initialization
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : createClient('https://placeholder-project.supabase.co', 'placeholder-anon-key-that-is-safe', {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

export function saveCustomSupabaseConfig(url: string, key: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('nexmoney_sb_url', url.trim());
    localStorage.setItem('nexmoney_sb_key', key.trim());
    window.location.reload();
  }
}

export function clearCustomSupabaseConfig() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('nexmoney_sb_url');
    localStorage.removeItem('nexmoney_sb_key');
    window.location.reload();
  }
}

/**
 * SHA-256 cryptographic hash helper for client-side hashing fallback.
 * Plaintext PINs are NEVER stored or transmitted unhashed.
 */
export async function hashPinClient(pin: string, salt: string = 'nexmoney_pin_salt_v1'): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${pin}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
