// Enviar resposta via HTTP - Agora com persistência no Supabase
const { getGame, updateGame } = require('../../lib/game-store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gameCode, questionId, answer, answerTime } = req.body;
  const playerId = req.headers['x-player-id'] || 'anonymous';

  if (!gameCode || questionId === undefined || answer === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const game = await getGame(gameCode);
  if (!game || game.status !== 'playing') {
    return res.status(400).json({ error: 'Game not active' });
  }

  const currentQ = game.questions[game.currentQuestion];
  if (!currentQ || currentQ.id !== questionId) {
    return res.status(400).json({ error: 'Invalid question' });
  }

  const isCorrect = answer === currentQ.correctAnswer;
  const timeBonus = isCorrect ? Math.round((1 - Math.min(answerTime, currentQ.time * 1000) / (currentQ.time * 1000)) * 100) : 0;
  const points = isCorrect ? 100 + timeBonus : 0;

  // Salvar resposta
  const answers = { ...game.answers };
  if (!answers[game.currentQuestion]) {
    answers[game.currentQuestion] = {};
  }
  answers[game.currentQuestion][playerId] = {
    answer,
    isCorrect,
    points,
    time: answerTime
  };

  await updateGame(gameCode, { answers });

  res.json({
    success: true,
    isCorrect,
    points
  });
};
