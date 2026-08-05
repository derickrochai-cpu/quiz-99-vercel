// Iniciar jogo via HTTP - Com persistência no Supabase
const { getGame, updateGame } = require('../../lib/game-store');
const { memoryTimers } = require('../../lib/supabase');
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

  const { gameCode } = req.body;
  if (!gameCode) {
    return res.status(400).json({ error: 'Game code required' });
  }

  const game = await getGame(gameCode);
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
    answers: {},
    timeLeft: game.questions[0].time
  };

  await updateGame(gameCode, updates);

  // Timer para primeira pergunta
  startQuestionTimer(gameCode, game.questions[0].time);

  res.json({ success: true, status: 'playing' });
};

function startQuestionTimer(gameCode, time) {
  // Limpar timer anterior
  if (memoryTimers.has(gameCode)) {
    clearInterval(memoryTimers.get(gameCode));
  }

  let timeLeft = time;

  const timer = setInterval(async () => {
    timeLeft--;

    const game = await getGame(gameCode);
    if (!game || game.status !== 'playing') {
      clearInterval(timer);
      memoryTimers.delete(gameCode);
      return;
    }

    await updateGame(gameCode, { timeLeft });

    if (timeLeft <= 0) {
      clearInterval(timer);
      nextQuestionOrEnd(gameCode);
    }
  }, 1000);

  memoryTimers.set(gameCode, timer);
}

async function nextQuestionOrEnd(gameCode) {
  const game = await getGame(gameCode);
  if (!game) return;

  const nextQuestion = game.currentQuestion + 1;

  if (nextQuestion >= game.questions.length) {
    // Fim do jogo
    await updateGame(gameCode, { status: 'finished', currentQuestion: nextQuestion });
    calculateFinalResults(gameCode);
  } else {
    // Próxima pergunta
    await updateGame(gameCode, { currentQuestion: nextQuestion });
    startQuestionTimer(gameCode, game.questions[nextQuestion].time);
  }
}

async function calculateFinalResults(gameCode) {
  const game = await getGame(gameCode);
  if (!game) return;

  const scores = [];
  game.players.forEach(player => {
    let score = 0;
    let correct = 0;

    Object.entries(game.answers).forEach(([qIndex, questionAnswers]) => {
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

  // Salvar resultados no jogo
  await updateGame(gameCode, { results: scores });
}
