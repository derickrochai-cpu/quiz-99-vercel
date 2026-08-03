// Iniciar jogo via HTTP
const { games, gameTimers } = require('./state');
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

  const game = games.get(gameCode);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  // Iniciar jogo
  game.status = 'playing';
  game.currentQuestion = 0;
  game.startedAt = Date.now();
  game.answers = new Map();

  // Timer para primeira pergunta
  startQuestionTimer(gameCode, game.questions[0].time);

  res.json({ success: true, status: 'playing' });
};

function startQuestionTimer(gameCode, time) {
  const { games, gameTimers } = require('./state');

  // Limpar timer anterior
  if (gameTimers.has(gameCode)) {
    clearInterval(gameTimers.get(gameCode));
  }

  let timeLeft = time;

  const timer = setInterval(() => {
    timeLeft--;

    const game = games.get(gameCode);
    if (!game || game.status !== 'playing') {
      clearInterval(timer);
      gameTimers.delete(gameCode);
      return;
    }

    game.timeLeft = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(timer);
      nextQuestionOrEnd(gameCode);
    }
  }, 1000);

  gameTimers.set(gameCode, timer);
}

function nextQuestionOrEnd(gameCode) {
  const { games, gameTimers } = require('./state');
  const game = games.get(gameCode);
  if (!game) return;

  game.currentQuestion++;

  if (game.currentQuestion >= game.questions.length) {
    // Fim do jogo
    game.status = 'finished';
    calculateFinalResults(gameCode);
  } else {
    // Próxima pergunta
    startQuestionTimer(gameCode, game.questions[game.currentQuestion].time);
  }
}

function calculateFinalResults(gameCode) {
  const { games, gameResults } = require('./state');
  const game = games.get(gameCode);
  if (!game) return;

  const scores = [];
  game.players.forEach(player => {
    let score = 0;
    let correct = 0;

    game.answers.forEach((questionAnswers, qIndex) => {
      const answer = questionAnswers.get(player.id);
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
  gameResults.set(gameCode, scores);
}
