#!/usr/bin/env node
/**
 * Script de verificação pré-deploy
 * Verifica se todas as configurações estão corretas
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 ===========================================');
console.log('   VERIFICAÇÃO PRÉ-DEPLOY - QUIZ 99');
console.log('===========================================\n');

let hasErrors = false;
let hasWarnings = false;

// ============================================
// 1. Verificar arquivos necessários
// ============================================
console.log('📁 Verificando arquivos...\n');

const requiredFiles = [
    'vercel.json',
    'package.json',
    'public/index.html',
    'public/app.js',
    'api/admin/login.js',
    'api/game/create.js',
    'api/game/join.js',
    'api/game/poll.js',
    'lib/supabase.js',
    'lib/game-store.js'
];

requiredFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
        console.log(`  ✅ ${file}`);
    } else {
        console.log(`  ❌ ${file} - NÃO ENCONTRADO!`);
        hasErrors = true;
    }
});

// ============================================
// 2. Verificar package.json
// ============================================
console.log('\n📦 Verificando package.json...\n');

try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

    const requiredDeps = ['uuid', 'jsonwebtoken', '@supabase/supabase-js'];

    requiredDeps.forEach(dep => {
        if (packageJson.dependencies && packageJson.dependencies[dep]) {
            console.log(`  ✅ ${dep}: ${packageJson.dependencies[dep]}`);
        } else {
            console.log(`  ❌ ${dep} - NÃO ENCONTRADO!`);
            hasErrors = true;
        }
    });
} catch (err) {
    console.log('  ❌ Erro ao ler package.json');
    hasErrors = true;
}

// ============================================
// 3. Verificar vercel.json
// ============================================
console.log('\n⚙️  Verificando vercel.json...\n');

try {
    const vercelJson = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));

    if (vercelJson.routes) {
        console.log('  ✅ Routes configuradas');
    } else {
        console.log('  ❌ Routes não configuradas!');
        hasErrors = true;
    }

    if (vercelJson.functions) {
        console.log('  ✅ Functions configuradas');
    } else {
        console.log('  ⚠️  Functions não configuradas');
        hasWarnings = true;
    }
} catch (err) {
    console.log('  ❌ Erro ao ler vercel.json');
    hasErrors = true;
}

// ============================================
// 4. Verificar JWT_SECRET nos arquivos
// ============================================
console.log('\n🔐 Verificando segurança...\n');

const loginFile = fs.readFileSync('api/admin/login.js', 'utf8');

// Verificar se há hardcoded secrets
const hardcodedPatterns = [
    { pattern: /const\s+JWT_SECRET\s*=\s*['"][^'"]+['"]/, file: 'api/admin/login.js' },
];

// Verificar se usa process.env
if (loginFile.includes('process.env.JWT_SECRET')) {
    console.log('  ✅ JWT_SECRET usa variável de ambiente');
} else if (loginFile.includes('quiz99_secret_key')) {
    console.log('  ⚠️  JWT_SECRET está hardcoded!');
    console.log('     💡 Dica: Use process.env.JWT_SECRET');
    hasWarnings = true;
}

// Verificar senha padrão do admin
if (loginFile.includes('admin123')) {
    console.log('  ⚠️  Senha padrão do admin detectada (admin123)');
    console.log('     💡 Dica: Troque para uma senha mais segura');
    hasWarnings = true;
}

// ============================================
// 5. Verificar node_modules
// ============================================
console.log('\n📂 Verificando dependências...\n');

if (fs.existsSync('node_modules')) {
    console.log('  ✅ node_modules existe');

    const uuidExists = fs.existsSync('node_modules/uuid');
    const jwtExists = fs.existsSync('node_modules/jsonwebtoken');
    const supabaseExists = fs.existsSync('node_modules/@supabase/supabase-js');

    if (uuidExists && jwtExists && supabaseExists) {
        console.log('  ✅ Todas as dependências instaladas');
    } else {
        console.log('  ❌ Algumas dependências faltando!');
        console.log('     💡 Execute: npm install');
        hasErrors = true;
    }
} else {
    console.log('  ❌ node_modules não encontrado!');
    console.log('     💡 Execute: npm install');
    hasErrors = true;
}

// ============================================
// 6. Verificar git
// ============================================
console.log('\n🌿 Verificando Git...\n');

if (fs.existsSync('.git')) {
    console.log('  ✅ Repositório Git inicializado');

    // Verificar se há commits
    const gitHead = fs.readFileSync('.git/HEAD', 'utf8').trim();
    console.log(`  ℹ️  Branch atual: ${gitHead.replace('ref: ', '')}`);
} else {
    console.log('  ⚠️  Repositório Git não inicializado');
    console.log('     💡 Execute: git init');
    hasWarnings = true;
}

// ============================================
// 7. Resumo
// ============================================
console.log('\n===========================================');
console.log('📊 RESUMO');
console.log('===========================================\n');

if (hasErrors) {
    console.log('❌ ERROS ENCONTRADOS!');
    console.log('   Corrija os erros acima antes de fazer deploy.\n');
    process.exit(1);
} else if (hasWarnings) {
    console.log('⚠️  AVISOS ENCONTRADOS!');
    console.log('   O deploy pode funcionar, mas considere corrigir os avisos.\n');
    console.log('✅ Pode prosseguir com o deploy!\n');
    process.exit(0);
} else {
    console.log('✅ TUDO CERTO!');
    console.log('   Pronto para fazer deploy!\n');
    console.log('🚀 Execute: vercel --prod\n');
    process.exit(0);
}
