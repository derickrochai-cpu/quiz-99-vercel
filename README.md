# 🚕 Quiz 99 - Sistema Completo

Quiz interativo no estilo Kahoot para a 99, hospedado no Vercel.

## ✨ Funcionalidades

### 🎮 Para Participantes
- Entrar com nome, email e código do jogo
- Responder perguntas com tempo limitado (30 segundos)
- Ranking em tempo baseado em velocidade e acertos
- Animações de carros e competição
- Cupons de desconto no final

### 👑 Para Administradores
- Criar quizzes personalizados
- Definir perguntas com 4 alternativas
- Controlar início do jogo
- Ver ranking e estatísticas em tempo real

### 🎨 Design
- Cores da 99 (amarelo #F5C500, preto #000000, branco #FFFFFF)
- Animações de carros correndo
- Interface inspirada no Kahoot
- Totalmente responsivo

## 🚀 Deploy no Vercel

### Passo 1: Instalar dependências
```bash
npm install
```

### Passo 2: Configurar variáveis de ambiente
Crie um arquivo `.env`:
```
JWT_SECRET=quiz99_secret_key_2024
ADMIN_EMAIL=admin@99app.com
ADMIN_PASSWORD=admin123
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

### Passo 3: Deploy
```bash
vercel --prod
```

## 📊 Estrutura de Arquivos

```
quiz-99-vercel/
├── server.js              # Servidor Node.js + Socket.io
├── package.json           # Dependências
├── vercel.json           # Configuração do Vercel
├── public/               # Frontend
│   ├── index.html        # Interface principal
│   └── app.js           # Lógica do cliente
├── google-apps-script-coupons.gs  # Integração com planilha
└── README.md
```

## 🎯 Como Usar

### 1. Admin cria o jogo:
1. Acessa área de admin
2. Cria perguntas (4 alternativas, 1 correta)
3. Define tempo (até 30 segundos)
4. Gera código do jogo

### 2. Participantes entram:
1. Acessam o quiz
2. Colocam nome, email e código
3. Aguardam início

### 3. Durante o jogo:
- Perguntas aparecem em sequência
- Tempo conta regressivamente
- Quanto mais rápido acertar, mais pontos ganha
- Ranking mostra posições entre perguntas

### 4. Final:
- Pódio animado com top 3
- Todos recebem cupons
- Cupons são gerados da planilha Google

## 🔧 Configuração do Google Apps Script

1. Acesse https://script.google.com
2. Crie novo projeto
3. Cole o código de `google-apps-script-coupons.gs`
4. Execute `inicializarPlanilha()`
5. Implante como App da Web
6. Copie a URL e cole no `vercel.json`

## 📝 Adicionar Cupons

Na planilha Google, aba `🎟️ Cupons Quiz`, adicione:

| Data | Código | Email | Nome | Desconto | Descrição | Posição | Status | Validade | Game | Data Atribuição |
|------|--------|-------|------|----------|-----------|---------|--------|----------|------|-----------------|
| | Q99WIN20 | | | R$ 20,00 OFF | 20% discount | | Available | | | |
| | Q99WIN15 | | | R$ 15,00 OFF | 15% discount | | Available | | | |

## 🎨 Personalização

### Cores
Edite no CSS:
```css
--primary: #F5C500;    /* Amarelo 99 */
--secondary: #000000;  /* Preto */
--background: #FFFFFF; /* Branco */
```

### Animações
As animações de carro estão no CSS:
- `.car` - Carros animados na estrada
- `@keyframes drive` - Movimento dos carros
- `@keyframes moveRoad` - Movimento da estrada

## 📱 Suporte

- Chrome, Firefox, Safari, Edge
- iOS e Android
- Totalmente responsivo

## 🏆 Sistema de Pontuação

```
Pontuação = 100 (base) + Bônus de velocidade

Bônus = (1 - tempo_resposta / tempo_total) × 100

Exemplo:
- Respondeu em 5s de 30s: 100 + 83 = 183 pontos
- Respondeu em 15s de 30s: 100 + 50 = 150 pontos
```

## 🔒 Segurança

- JWT para autenticação de admin
- Validação de email único por jogo
- Códigos de jogo aleatórios
- HTTPS obrigatório

## 📞 Suporte

Para dúvidas ou problemas, entre em contato!

---

🚕 **Quiz 99** - Acelere seus conhecimentos!
