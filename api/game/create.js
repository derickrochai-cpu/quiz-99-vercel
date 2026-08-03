// Criar jogo via HTTP
const { v4: uuidv4 } = require('uuid');
const { games } = require('./state');
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

  // Verificar token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = authHeader.substring(7);
    jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { title, questions } = req.body;

  if (!title || !questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: 'Invalid game data' });
  }

  // Gerar código do jogo
  const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const game = {
    id: uuidv4(),
    code: gameCode,
    title,
    questions: questions.map(q => ({
      id: uuidv4(),
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      time: q.time || 30
    })),
    status: 'waiting',
    currentQuestion: -1,
    players: [],
    answers: new Map(),
    createdAt: Date.now()
  };

  games.set(gameCode, game);

  res.json({
    success: true,
    gameCode,
    gameId: game.id
  });
};
