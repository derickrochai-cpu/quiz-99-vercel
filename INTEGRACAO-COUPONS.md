# 🎟️ Integração de Cupons - Instruções

## ✅ Google Apps Script Configurado!

URL: `https://script.google.com/macros/s/AKfycbwBMFJy8Jf6xvgLcuLosxS2mHuCh8Pg2qkkG6g8R5W-MMoZlcMHvMwOKptlp5B9iSFR/exec`

## 📋 Próximos Passos:

### 1️⃣ Configurar CORS no Google Apps Script

O Apps Script precisa permitir requisições do seu domínio Vercel.

No código do Apps Script, já está configurado com:
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
```

Se não funcionar, você pode precisar atualizar a configuração do Web App:
1. Vá no Apps Script → **Deploy** → **Manage deployments**
2. Clique no lápis (editar)
3. Em **Execute as**: Selecione "Me"
4. Em **Who has access**: Selecione "Anyone" (qualquer pessoa)

### 2️⃣ Configurar Variáveis no Vercel

Adicione no painel da Vercel (Settings → Environment Variables):

```
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/AKfycbwBMFJy8Jf6xvgLcuLosxS2mHuCh8Pg2qkkG6g8R5W-MMoZlcMHvMwOKptlp5B9iSFR/exec
```

### 3️⃣ Estrutura da Planilha

Certifique-se de que a planilha tenha as seguintes abas:

**Aba: '🎟️ Cupons Quiz'**
| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| 📅 Data | 🎟️ Código | 📧 Email | 👤 Nome | 💰 Desconto | 📝 Descrição | 🏆 Posição | Status | 📆 Validade | 🔑 Game | 📅 Data Atribuição |

**Aba: '📊 Participantes Quiz'**
| A | B | C | D | E | F |
|---|---|---|---|---|---|
| 📅 Data | 📧 Email | 👤 Nome | 🏆 Posição | ⭐ Pontuação | 🔑 Game Code |

### 4️⃣ Adicionar Cupons

Na aba '🎟️ Cupons Quiz', adicione cupons com Status = "Available" ou "Disponível":

| B | E | F | H |
|---|---|---|---|
| Q99WIN20 | R$ 20,00 OFF | 20% discount on your next ride | Available |
| Q99WIN15 | R$ 15,00 OFF | 15% discount on your next ride | Available |

### 5️⃣ Testar

Após o deploy:
1. Crie um quiz
2. Jogue até o fim
3. Na tela final, o cupom deve aparecer automaticamente!

## 🐛 Problemas Conhecidos

### Erro de CORS
Se aparecer erro de CORS no console:
1. No Apps Script, vá em **Deploy** → **New deployment**
2. Tipo: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. **Redeploy**

### Cupom não aparece
Verifique no console do navegador (F12 → Console) se há erros na chamada ao Apps Script.

## ✅ Funcionalidades

- ✅ Atribui cupom automaticamente ao final do quiz
- ✅ Salva participante na planilha
- ✅ Valida se cupom já foi usado/expirado
- ✅ Mostra cupom na tela final para o jogador
