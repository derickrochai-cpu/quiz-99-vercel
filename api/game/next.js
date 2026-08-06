// Avançar para próxima pergunta ou encerrar jogo (Admin)
const { getGame, updateGame } = require('../../lib/game-store');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'quiz99_secret_key_2024';

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

  const { gameCode } = req.body;
  if (!gameCode) {
    return res.status(400).json({ error: 'Game code required' });
  }

  const game = await getGame(gameCode);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  if (game.status !== 'playing') {
    return res.status(400).json({ error: 'Game not in progress' });
  }

  const nextQuestion = game.currentQuestion + 1;

  if (nextQuestion >= game.questions.length) {
    // Fim do jogo
    await updateGame(gameCode, {
      status: 'finished',
      currentQuestion: nextQuestion,
      timeLeft: 0
    });

    // Calcular resultados finais
    const scores = [];
    game.players.forEach(player => {
      let score = 0;
      let correct = 0;

      Object.entries(game.answers || {}).forEach(([qIndex, questionAnswers]) => {
        const answer = questionAnswers[player.id];
        if (answer && answer.isCorrect) {
          score += answer.points || 100;
          correct++;
        }
      });

      scores.push({
        id: player.id,
        name: player.name,
        score,
        correctAnswers: correct
      });
    });

    scores.sort((a, b) => b.score - a.score);
    await updateGame(gameCode, { results: scores });

    res.json({ success: true, status: 'finished', message: 'Game ended' });
  } else {
    // Próxima pergunta - iniciar timer imediatamente
    await updateGame(gameCode, {
      currentQuestion: nextQuestion,
      timeLeft: game.questions[nextQuestion].time,
      questionStartedAt: new Date().toISOString() // Iniciar timer agora
    });

    res.json({
      success: true,
      status: 'playing',
      currentQuestion: nextQuestion,
      message: 'Next question'
    });
  }
};
