// Iniciar jogo via HTTP - Com persistência no Supabase
const { getGame, updateGame } = require('../../lib/game-store');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'quiz99_secret_key_2024';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[start] Request received:', req.body);

  // Verificar token
  const authHeader = req.headers.authorization;
  console.log('[start] Auth header:', authHeader ? 'Present' : 'Missing');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = authHeader.substring(7);
    jwt.verify(token, JWT_SECRET);
    console.log('[start] Token verified');
  } catch (err) {
    console.log('[start] Token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { gameCode } = req.body;
  console.log('[start] Game code:', gameCode);

  if (!gameCode) {
    return res.status(400).json({ error: 'Game code required' });
  }

  const game = await getGame(gameCode);
  console.log('[start] Game found:', game ? 'Yes' : 'No');

  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  // Iniciar jogo
  const now = new Date().toISOString();
  const updates = {
    status: 'playing',
    currentQuestion: 0,
    startedAt: Date.now(),
    updatedAt: now,
    questionStartedAt: now,  // Marca quando a primeira pergunta começou
    answers: {},
    timeLeft: game.questions[0].time
  };

  await updateGame(gameCode, updates);
  console.log('[start] Game started successfully:', gameCode);

  res.json({ success: true, status: 'playing' });
};
