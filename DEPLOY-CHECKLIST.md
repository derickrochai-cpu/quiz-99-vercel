# ✅ Checklist de Deploy - Quiz 99 com Supabase

## 1. Obter Credenciais do Supabase

No painel do Supabase (https://app.supabase.com):

### A. Project URL
- Vá em **Project Settings** → **API**
- Copie o **Project URL**: `https://xxxxxx.supabase.co`

### B. Anon Key (pública)
- Na mesma página, copie a **anon public** key
- Começa com: `eyJ...`

### C. (Opcional) Service Role Key
- Na mesma página, copie a **service_role** key
- ⚠️ MANTENHA EM SEGREDO! Não expõe no frontend

---

## 2. Configurar Variáveis de Ambiente no Vercel

No painel da Vercel:

1. Selecione seu projeto
2. Vá em **Settings** → **Environment Variables**
3. Adicione:

| Nome | Valor |
|------|-------|
| `SUPABASE_URL` | `https://seu-projeto.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJ...` (anon key) |
| `JWT_SECRET` | `quiz99_secret_key_2024` (ou crie uma nova) |
| `GOOGLE_SCRIPT_URL` | URL do seu Apps Script (se usar cupons) |

### (Opcional) Para mais segurança, use Service Role:
| Nome | Valor |
|------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service_role key) |

---

## 3. Instalar Dependências e Fazer Deploy

```bash
# No terminal, na pasta do projeto
cd quiz-99-vercel

# Instalar dependências
npm install

# Deploy na Vercel
vercel --prod
```

---

## 4. Testar o Funcionamento

### Teste 1: Criar um jogo
```bash
curl -X POST https://seu-projeto.vercel.app/api/game/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -d '{
    "title": "Quiz de Teste",
    "questions": [{
      "text": "Qual a cor do logo da 99?",
      "options": ["Amarelo", "Azul", "Verde", "Vermelho"],
      "correctAnswer": 0,
      "time": 30
    }]
  }'
```

### Teste 2: Verificar no Supabase
```sql
-- No SQL Editor do Supabase
SELECT code, title, status FROM games ORDER BY created_at DESC LIMIT 5;
```

### Teste 3: Entrar no jogo
Use o código gerado para testar a entrada de jogadores.

---

## 5. Solução de Problemas

### Erro: "Game not found"
- Verifique se `SUPABASE_URL` e `SUPABASE_KEY` estão configurados
- Verifique se a tabela `games` existe: `SELECT * FROM games LIMIT 1;`

### Erro: "Unauthorized"
- Verifique se o token JWT está sendo enviado corretamente
- Verifique a variável `JWT_SECRET`

### Erro: RLS violation
- Se usar Anon Key: verifique se as políticas RLS estão ativas
- Se usar Service Role Key: verifique se configurou `SUPABASE_SERVICE_ROLE_KEY`

### Jogo some após criar
- Isso era o problema original (memória não persistia)
- Com Supabase configurado, os dados devem persistir

---

## 6. Variáveis de Ambiente Completas (.env.local)

Para testar localmente, crie um arquivo `.env.local`:

```bash
SUPABASE_URL=https://xxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
# Ou use a service role key:
# SUPABASE_SERVICE_ROLE_KEY=eyJ...

JWT_SECRET=quiz99_secret_key_2024
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/XXXX/exec
```

---

## 🎉 Depois do Deploy

O quiz deve funcionar assim:

1. Admin cria jogo → Salvo no Supabase ✅
2. Jogadores entram → Dados persistem ✅
3. Admin inicia jogo → Lê do Supabase ✅
4. Jogo funciona normalmente! 🚀
