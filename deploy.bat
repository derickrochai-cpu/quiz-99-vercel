@echo off
chcp 65001 >nul
echo.
echo 🚀 ===========================================
echo    DEPLOY - QUIZ 99 NO VERCEL
echo ===========================================
echo.

REM Verificar se Node.js está instalado
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js não encontrado!
    echo 📝 Por favor, instale o Node.js: https://nodejs.org
    pause
    exit /b 1
)

echo ✅ Node.js encontrado

REM Verificar se Vercel CLI está instalado
vercel --version >nul 2>&1
if errorlevel 1 (
    echo 📝 Instalando Vercel CLI...
    call npm i -g vercel
    if errorlevel 1 (
        echo ❌ Erro ao instalar Vercel CLI
        echo 📝 Tente manualmente: npm i -g vercel
        pause
        exit /b 1
    )
)

echo ✅ Vercel CLI encontrado

REM Verificar dependências
if not exist "node_modules" (
    echo 📝 Instalando dependências...
    call npm install
    if errorlevel 1 (
        echo ❌ Erro ao instalar dependências
        pause
        exit /b 1
    )
)

echo ✅ Dependências instaladas

echo.
echo ===========================================
echo 🚀 INICIANDO DEPLOY
echo ===========================================
echo.
echo 📝 Execute os comandos abaixo manualmente:
echo.
echo 1️⃣  Fazer login na Vercel (se não estiver logado):
echo    vercel login
echo.
echo 2️⃣  Fazer deploy:
echo    vercel --prod
echo.
echo ===========================================
echo 📝 Após o deploy, configure as variáveis de ambiente:
echo.
echo    SUPABASE_URL=https://seu-projeto.supabase.co
echo    SUPABASE_ANON_KEY=eyJ...
echo    JWT_SECRET=sua-chave-secreta
echo.
echo Acesse: https://vercel.com/dashboard
echo ===========================================
echo.

set /p choice="Deseja executar 'vercel --prod' agora? (S/N): "
if /i "%choice%"=="S" (
    echo.
    echo 🚀 Executando deploy...
    vercel --prod
) else (
    echo.
    echo ℹ️ Deploy cancelado. Execute 'vercel --prod' quando estiver pronto.
)

echo.
pause
