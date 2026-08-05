# 🔧 Configuração do Supabase

## Passo 1: Criar conta no Supabase

1. Acesse [https://supabase.com](https://supabase.com)
2. Clique em "Start your project"
3. Crie uma conta (pode usar GitHub, Google ou email)
4. Crie um novo projeto

## Passo 2: Criar a tabela de jogos

No SQL Editor do Supabase, execute:

```sql
CREATE TABLE games (
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

-- Índice para busca rápida por código
CREATE INDEX idx_games_code ON games(code);

-- Índice para buscar por status
CREATE INDEX idx_games_status ON games(status);

-- Trigger para atualizar o updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Passo 3: Configurar Políticas de Segurança (RLS)

```sql
-- Permitir leitura pública de jogos ativos
CREATE POLICY "Allow public read active games" ON games
  FOR SELECT USING (status IN ('waiting', 'playing'));

-- Permitir criação/edição com chave de serviço (usada no backend)
-- Isso já é permitido por padrão quando usando a service key
```

## Passo 4: Obter as credenciais

1. No painel do Supabase, vá em **Project Settings** > **API**
2. Copie:
   - **Project URL** (https://xxxxx.supabase.co) → `SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY`

## Passo 5: Configurar no Vercel

No painel do Vercel, vá em **Settings** > **Environment Variables** e adicione:

| Nome | Valor |
|------|-------|
| `SUPABASE_URL` | `https://seu-projeto.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJ...` (sua chave anon) |

Ou crie um arquivo `.env.local` para testar localmente:

```bash
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave_anon_aqui
```

## Passo 6: Instalar dependências

```bash
npm install
```

## 🚀 Como funciona

- Se o Supabase estiver configurado → jogos são salvos lá (persistência entre requisições)
- Se não estiver configurado → funciona em memória (limitado a uma única instância)

## 📝 Notas

- Plano gratuito: 500 MB de armazenamento, 100k requisições/mês
- Jogos antigos podem ser excluídos automaticamente após 24h (backup recomendado)
- Os jogos em andamento são mantidos ativos enquanto houver polling
