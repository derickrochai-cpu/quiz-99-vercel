// Criar jogo via HTTP - Agora com persistência no Supabase
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { supabase, memoryGames, isSupabaseEnabled } = require('../../lib/supabase');

const JWT_SECRET = 'quiz99_secret_key_2024';

function getStorage() {
  return isSupabaseEnabled ? 'supabase' : 'memory';
}

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
  const gameId = uuidv4();

  const game = {
    id: gameId,
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
    answers: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    if (isSupabaseEnabled && supabase) {
      // Salvar no Supabase
      const { error } = await supabase
        .from('games')
        .insert({
          id: gameId,
          code: gameCode,
          title: title,
          questions: JSON.stringify(game.questions),
          status: 'waiting',
          current_question: -1,
          players: JSON.stringify([]),
          answers: JSON.stringify({}),
          created_at: game.createdAt,
          updated_at: game.updatedAt
        });

      if (error) {
        console.error('Erro ao salvar no Supabase:', error);
        // Fallback para memória se houver erro
        memoryGames.set(gameCode, game);
      }
    } else {
      // Usar memória como fallback
      memoryGames.set(gameCode, game);
    }

    res.json({
      success: true,
      gameCode,
      gameId,
      storage: getStorage()
    });
  } catch (err) {
    console.error('Erro ao criar jogo:', err);
    // Garantir que sempre gravemos algum lugar
    memoryGames.set(gameCode, game);

    res.json({
      success: true,
      gameCode,
      gameId,
      storage: 'memory (fallback)'
    });
  }
};
