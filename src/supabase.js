import { createClient } from '@supabase/supabase-js'

// Vercel の Environment Variables から読み込む (VITE_ プレフィックス必須)
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[Supabase] 環境変数が設定されていません。\n' +
    'Vercel の Environment Variables に以下を設定してください:\n' +
    '  VITE_SUPABASE_URL\n' +
    '  VITE_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
