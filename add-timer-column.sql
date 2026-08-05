-- Adicionar coluna para controlar o início de cada pergunta
ALTER TABLE games ADD COLUMN IF NOT EXISTS question_started_at TIMESTAMP WITH TIME ZONE;

-- Comentário sobre a coluna
COMMENT ON COLUMN games.question_started_at IS 'Timestamp quando a pergunta atual começou (usado para timer)';
