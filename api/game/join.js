// Entrar no jogo via HTTP - Agora com persistência no Supabase
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

  const { gameCode, name, email } = req.body;

  if (!gameCode || !name || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const game = await getGame(gameCode);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  if (game.status !== 'waiting') {
    return res.status(400).json({ error: 'Game already started' });
  }

  // Verificar email duplicado
  const existingPlayer = game.players.find(p => p.email === email);
  if (existingPlayer) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const player = {
    id: Date.now().toString(),
    name,
    email,
    joinedAt: Date.now()
  };

  // Adicionar jogador
  const updatedPlayers = [...game.players, player];
  await updateGame(gameCode, { players: updatedPlayers });

  res.json({
    success: true,
    playerId: player.id,
    gameCode
  });
};
