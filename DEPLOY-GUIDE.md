# 🚀 Guia Completo de Deploy - Quiz 99 no Vercel

## 📋 Pré-requisitos

- Conta no [Vercel](https://vercel.com) (gratuita)
- Conta no [Supabase](https://supabase.com) (gratuita)
- [Node.js](https://nodejs.org) instalado (v16+)
- [Git](https://git-scm.com) instalado

---

## 🔧 PASSO 1: Configurar o Supabase

### 1.1 Criar Projeto no Supabase

1. Acesse https://supabase.com e faça login
2. Clique em **"New Project"**
3. Escolha um nome (ex: `quiz-99`)
4. Defina uma senha segura para o banco
5. Aguarde a criação (≈ 2 minutos)

### 1.2 Criar Tabelas

No painel do Supabase:
1. Vá em **"SQL Editor"** (no menu lateral)
2. Clique em **"New query"**
3. Cole o código abaixo e execute (▶️):

```sql
-- Tabela de jogos
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
  question_started_at TIMESTAMP WITH TIME ZONE,
  results JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_games_code ON games(code);
CREATE INDEX idx_games_status ON games(status);

-- Tabela de cupons (opcional - se for usar cupons)
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'available',
  player_email TEXT,
  player_name TEXT,
  game_code TEXT,
  position INTEGER,
  assigned_at TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_coupons_status ON coupons(status);
CREATE INDEX idx_coupons_player ON coupons(player_email, game_code);

-- Tabela de participantes (opcional - analytics)
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_email TEXT NOT NULL,
  player_name TEXT NOT NULL,
  game_code TEXT NOT NULL,
  position INTEGER,
  score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_participants_game ON participants(game_code);
```

### 1.3 Obter Credenciais

1. No painel do Supabase, vá em **Project Settings** → **API**
2. Copie os seguintes valores:
   - **Project URL**: `https://xxxxx.supabase.co` → `SUPABASE_URL`
   - **anon public**: `eyJ...` → `SUPABASE_ANON_KEY`

**Guarde esses valores!** Você vai precisar deles no Passo 3.

---

## 📦 PASSO 2: Preparar o Projeto

### 2.1 Instalar Vercel CLI

```bash
# Instalar globalmente
npm i -g vercel

# Verificar instalação
vercel --version
```

### 2.2 Login na Vercel

```bash
# Fazer login (vai abrir o navegador)
vercel login
```

### 2.3 Instalar Dependências do Projeto

```bash
# Navegar até a pasta do projeto
cd C:\Users\derickrocha_i\quiz-99-vercel

# Instalar dependências
npm install
```

---

## 🚀 PASSO 3: Deploy na Vercel

### 3.1 Deploy Inicial

```bash
# Fazer deploy
vercel

# Responda às perguntas:
# ? Set up and deploy "quiz-99-vercel"? [Y/n] → Y
# ? Which scope do you want to deploy to? → Selecione sua conta
# ? Link to existing project? [y/N] → N
# ? What's your project name? [quiz-99-vercel] → Enter (ou mude se quiser)
# ? In which directory is your code located? [./] → Enter
```

Aguarde o deploy completar. Você verá uma URL como:
```
https://quiz-99-vercel-xyz123.vercel.app
```

### 3.2 Configurar Variáveis de Ambiente

No painel da Vercel:
1. Acesse https://vercel.com/dashboard
2. Clique no seu projeto
3. Vá em **Settings** → **Environment Variables**
4. Adicione as seguintes variáveis:

| Nome | Valor | Ambiente |
|------|-------|----------|
| `SUPABASE_URL` | `https://seu-projeto.supabase.co` | Production |
| `SUPABASE_ANON_KEY` | `eyJ...` (sua chave anon) | Production |
| `JWT_SECRET` | `quiz99_secret_key_2024_segura` | Production |

**⚠️ IMPORTANTE:** Troque `quiz99_secret_key_2024_segura` por uma senha aleatória forte!

### 3.3 Redeploy com as Variáveis

```bash
# Redeploy com as novas variáveis
vercel --prod
```

---

## ✅ PASSO 4: Testar o Deploy

### 4.1 Testar a Página Inicial

Acesse sua URL e verifique se a página carrega corretamente:
```
https://seu-projeto.vercel.app
```

### 4.2 Testar API

```bash
# Testar se a API está funcionando
curl https://seu-projeto.vercel.app/api/game/poll?gameCode=TEST123

# Deve retornar: {"error":"Game not found"} (isso é esperado!)
```

### 4.3 Testar Login de Admin

1. Acesse a página
2. Clique em "Admin Area"
3. Use as credenciais padrão:
   - Email: `admin@99app.com`
   - Senha: `admin123`

**⚠️ IMPORTANTE:** Troque a senha padrão editando o arquivo `api/admin/login.js` antes de colocar em produção real!

---

## 🔒 PASSO 5: Segurança (IMPORTANTE!)

### 5.1 Trocar Senha Padrão do Admin

Edite o arquivo `api/admin/login.js`:

```javascript
// Mude estas credenciais!
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@99app.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'SENHA_FORTE_AQUI';
```

E adicione ao Environment Variables da Vercel:
- `ADMIN_EMAIL` → seu email
- `ADMIN_PASSWORD` → senha segura

### 5.2 Trocar JWT_SECRET

```bash
# Gere uma senha aleatória forte
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use esse valor no `JWT_SECRET` das Environment Variables.

---

## 🎨 PASSO 6: Personalizar (Opcional)

### 6.1 Mudar Cores

Edite `public/index.html` e altere as variáveis CSS:
```css
--primary: #F5C500;    /* Amarelo 99 */
--secondary: #000000;  /* Preto */
```

### 6.2 Adicionar Logo

Substitua o texto "QUIZ99" por uma imagem:
```html
<img src="logo-99.png" alt="Quiz 99" class="logo">
```

### 6.3 Customizar Domínio

No painel da Vercel:
1. Vá em **Settings** → **Domains**
2. Adicione seu domínio personalizado

---

## 🐛 Solução de Problemas

### Erro: "Supabase not configured"
- Verifique se `SUPABASE_URL` e `SUPABASE_ANON_KEY` estão configurados
- Verifique se não há espaços extras nos valores

### Erro: "Unauthorized" no admin
- Verifique o `JWT_SECRET`
- Limpe o localStorage do navegador e tente novamente

### Erro: "Game not found"
- Normal na primeira vez - crie um jogo primeiro
- Verifique se a tabela `games` existe no Supabase

### Erro: CORS
- Verifique se as rotas `/api/*` estão configuradas em `vercel.json`

### Jogos não persistem
- Verifique as credenciais do Supabase
- Verifique os logs em **Vercel Dashboard** → **Deployments** → **Functions**

---

## 📊 Monitoramento

### Ver Logs
```bash
vercel logs --production
```

### Estatísticas
Acesse o dashboard da Vercel para ver:
- Requisições por dia
- Erros
- Performance

---

## 📝 Comandos Úteis

```bash
# Deploy para preview (não produção)
vercel

# Deploy para produção
vercel --prod

# Ver logs em tempo real
vercel logs -f

# Remover projeto
vercel remove

# Atualizar Vercel CLI
npm i -g vercel@latest
```

---

## 🎉 Parabéns!

Seu Quiz 99 está no ar! Compartilhe a URL com seus amigos e divirta-se! 🚕✨

**URL do seu projeto:** `https://seu-projeto.vercel.app`
