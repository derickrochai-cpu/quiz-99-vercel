-- Adicionar coluna question_started_at na tabela games
ALTER TABLE games ADD COLUMN IF NOT EXISTS question_started_at TIMESTAMP WITH TIME ZONE;

-- Atualizar registros existentes
UPDATE games SET question_started_at = updated_at WHERE question_started_at IS NULL;

-- Verificar se a coluna foi adicionada
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'games';
