const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Configurações das variáveis de ambiente
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  console.log('🔐 Login attempt:');
  console.log('  Received email:', email);
  console.log('  Expected ADMIN_EMAIL:', ADMIN_EMAIL);
  console.log('  JWT_SECRET defined:', !!JWT_SECRET);
  console.log('  ADMIN_PASSWORD defined:', !!ADMIN_PASSWORD);

  // Verificar se as variáveis de ambiente estão definidas
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log('❌ Environment variables not set!');
    return res.status(500).json({
      error: 'Server configuration error',
      debug: {
        adminEmailSet: !!ADMIN_EMAIL,
        adminPasswordSet: !!ADMIN_PASSWORD
      }
    });
  }

  // Verificar email
  if (email !== ADMIN_EMAIL) {
    console.log('❌ Email mismatch');
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Verificar senha (comparar diretamente ou com hash)
  let validPassword = false;

  // Tentar comparar como texto plano primeiro (para teste)
  if (password === ADMIN_PASSWORD) {
    validPassword = true;
  } else {
    // Tentar com bcrypt
    try {
      validPassword = await bcrypt.compare(password, ADMIN_PASSWORD);
    } catch (e) {
      validPassword = false;
    }
  }

  console.log('  Password valid:', validPassword);

  if (!validPassword) {
    console.log('❌ Invalid password');
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Gerar token
  const token = jwt.sign({ email }, JWT_SECRET || 'fallback-secret', { expiresIn: '24h' });

  console.log('✅ Login successful');
  res.status(200).json({ token, email });
}
