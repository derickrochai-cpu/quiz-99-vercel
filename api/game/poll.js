// Rota de polling para verificar estado do jogo - Agora com persistência no Supabase
const { getGame } = require('../../lib/game-store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gameCode } = req.query;
  if (!gameCode) {
    return res.status(400).json({ error: 'Game code required' });
  }

  const game = await getGame(gameCode);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  // Retornar estado atual do jogo
  const response = {
    status: game.status,
    playerCount: game.players ? game.players.length : 0,
    players: game.players || [],
    currentQuestion: game.currentQuestion,
    totalQuestions: game.questions ? game.questions.length : 0
  };

  // Se jogo em andamento, incluir pergunta atual
  if (game.status === 'playing' && game.currentQuestion >= 0 && game.questions) {
    const q = game.questions[game.currentQuestion];
    response.question = {
      id: q.id,
      text: q.text,
      options: q.options,
      time: q.time,
      questionNumber: game.currentQuestion + 1,
      totalQuestions: game.questions.length
    };
    response.timeLeft = game.timeLeft || q.time;
  }

  // Se jogo terminou, incluir ranking
  if (game.status === 'finished' && game.results) {
    response.ranking = game.results;
  }

  res.json(response);
};
