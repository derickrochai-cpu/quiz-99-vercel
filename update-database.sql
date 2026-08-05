-- Adicionar coluna question_started_at na tabela games
ALTER TABLE games ADD COLUMN IF NOT EXISTS question_started_at TIMESTAMP WITH TIME ZONE;

-- Atualizar registros existentes (opcional)
UPDATE games SET question_started_at = updated_at WHERE question_started_at IS NULL;
