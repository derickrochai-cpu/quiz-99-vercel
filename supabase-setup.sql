-- =====================================================
-- SQL para configurar o Quiz 99 no Supabase com RLS
-- Execute no SQL Editor do Supabase (https://app.supabase.com)
-- =====================================================

-- 1. Criar tabela de jogos
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'waiting',
  current_question INTEGER DEFAULT -1,
  players JSONB DEFAULT '[]',
  answers JSONB DEFAULT '{}',
  time_left INTEGER,
  started_at TIMESTAMP WITH TIME ZONE,
  results JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_games_code ON games(code);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);

-- 3. Criar função para atualizar o updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_games_updated_at ON games;
CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. HABILITAR Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- 6. Limpar políticas existentes (se houver)
DROP POLICY IF EXISTS "Allow public read by code" ON games;
DROP POLICY IF EXISTS "Allow public insert" ON games;
DROP POLICY IF EXISTS "Allow public update" ON games;
DROP POLICY IF EXISTS "Allow service role all access" ON games;

-- 7. Criar política para permitir SELECT (leitura) por qualquer pessoa
-- Jogadores precisam ler o estado do jogo durante o polling
CREATE POLICY "Allow public read by code"
  ON games
  FOR SELECT
  TO anon, authenticated
  USING (true);  -- Permite ler qualquer jogo

-- 8. Criar política para permitir INSERT (criar jogos)
-- Qualquer um pode criar um novo jogo (na prática só o admin fará isso)
CREATE POLICY "Allow public insert"
  ON games
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 9. Criar política para permitir UPDATE (atualizar jogos)
-- Permite atualizar se conhecer o código do jogo
CREATE POLICY "Allow public update"
  ON games
  FOR UPDATE
  TO anon, authenticated
  USING (true)   -- Pode atualizar se o jogo existe
  WITH CHECK (true);

-- 10. Criar política para permitir DELETE (apenas jogos finalizados e antigos)
CREATE POLICY "Allow delete old finished games"
  ON games
  FOR DELETE
  TO anon, authenticated
  USING (status = 'finished' AND created_at < NOW() - INTERVAL '1 day');

-- =====================================================
-- ALTERNATIVA: Usar Service Role Key (recomendado para produção)
-- =====================================================
-- Se você quiser ser mais restritivo, pode:
-- 1. Desabilitar as políticas acima para 'anon'
-- 2. Usar apenas a Service Role Key no backend (mais seguro)
--
-- Política para service role (bypassa RLS):
-- CREATE POLICY "Allow service role all access"
--   ON games
--   TO service_role
--   USING (true)
--   WITH CHECK (true);

-- =====================================================
-- Comentários na tabela para documentação
-- =====================================================
COMMENT ON TABLE games IS 'Tabela de jogos do Quiz 99';
COMMENT ON COLUMN games.code IS 'Código único do jogo (6 caracteres alfanuméricos)';
COMMENT ON COLUMN games.questions IS 'Array JSON com as perguntas do quiz';
COMMENT ON COLUMN games.status IS 'Status: waiting, playing, finished';
COMMENT ON COLUMN games.players IS 'Array JSON com jogadores inscritos';
COMMENT ON COLUMN games.answers IS 'Objeto JSON com respostas dos jogadores';
COMMENT ON COLUMN games.results IS 'Array JSON com ranking final';

-- =====================================================
-- Função para limpar jogos antigos (pode ser chamada via cron ou manualmente)
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_old_games()
RETURNS void AS $$
BEGIN
  DELETE FROM games
  WHERE created_at < NOW() - INTERVAL '7 days'
    AND status IN ('finished', 'waiting');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICAÇÃO: Liste as políticas criadas
-- =====================================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'games';
