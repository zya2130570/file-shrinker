import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: SupabaseClient<any, any, any> | null = null;

function cleanSupabaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/https:\/\/[a-z0-9-]+\.supabase\.co/i);
  return match?.[0]?.replace(/\/$/, '') ?? null;
}

function cleanSupabaseKey(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();

  const jwt = trimmed.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0];
  if (jwt) return jwt;

  const modernKey = trimmed.match(/\bsb_(?:publishable|secret)_[A-Za-z0-9_-]+\b/)?.[0];
  if (modernKey) return modernKey;

  return /^[\x21-\x7E]+$/.test(trimmed) ? trimmed : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getClient(): SupabaseClient<any, any, any> {
  if (_client) return _client;

  const url = cleanSupabaseUrl(process.env.SUPABASE_URL);
  const key = cleanSupabaseKey(process.env.SUPABASE_ANON_KEY);

  if (!url || !key) {
    throw new Error(
      'Invalid SUPABASE_URL or SUPABASE_ANON_KEY. ' +
      'In Vercel, paste only the raw values without labels, arrows, quotes, or notes.'
    );
  }

  _client = createClient(url, key, { db: { schema: 'file_shrinker' } });
  return _client;
}

// Proxy so callers can write `supabase.from(...)` etc. while the real client
// is only instantiated on first use (not at module-evaluation / build time).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = new Proxy({} as SupabaseClient<any, any, any>, {
  get(_target, prop: string | symbol) {
    const client = getClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
