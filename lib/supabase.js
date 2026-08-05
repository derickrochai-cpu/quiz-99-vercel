// Cliente Supabase para persistência de dados
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
// Usar SERVICE_ROLE_KEY no backend (bypassa RLS)
// Se não tiver, usa ANON_KEY (funciona se RLS estiver desabilitado ou com políticas permissivas)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase] SUPABASE_URL ou SUPABASE_KEY não configurados. Usando memória local.');
}

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Fallback em memória para desenvolvimento local ou se Supabase não configurado
const memoryGames = new Map();
const memoryTimers = new Map();

module.exports = {
  supabase,
  memoryGames,
  memoryTimers,
  isSupabaseEnabled: !!supabase
};
