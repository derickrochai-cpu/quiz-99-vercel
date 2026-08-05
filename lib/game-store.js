// Helper para buscar e atualizar jogos no Supabase ou memória
const { supabase, memoryGames, isSupabaseEnabled } = require('./supabase');

async function getGame(gameCode) {
  // Primeiro tenta memória (mais rápido)
  if (memoryGames.has(gameCode)) {
    return memoryGames.get(gameCode);
  }

  // Se Supabase estiver habilitado, busca lá
  if (isSupabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('code', gameCode)
      .single();

    if (error || !data) {
      return null;
    }

    // Converte do formato do banco para o formato da aplicação
    const game = {
      id: data.id,
      code: data.code,
      title: data.title,
      questions: typeof data.questions === 'string' ? JSON.parse(data.questions) : data.questions,
      status: data.status,
      currentQuestion: data.current_question,
      players: typeof data.players === 'string' ? JSON.parse(data.players) : (data.players || []),
      answers: typeof data.answers === 'string' ? JSON.parse(data.answers) : (data.answers || {}),
      timeLeft: data.time_left,
      startedAt: data.started_at,
      createdAt: data.created_at
    };

    // Cache em memória para acesso rápido
    memoryGames.set(gameCode, game);
    return game;
  }

  return null;
}

async function updateGame(gameCode, updates) {
  // Atualiza em memória sempre
  const existingGame = memoryGames.get(gameCode);
  if (existingGame) {
    Object.assign(existingGame, updates, { updatedAt: new Date().toISOString() });
  } else if (updates.id) {
    memoryGames.set(gameCode, { ...updates, updatedAt: new Date().toISOString() });
  }

  // Atualiza no Supabase se habilitado
  if (isSupabaseEnabled && supabase) {
    const dbUpdates = {
      status: updates.status,
      current_question: updates.currentQuestion,
      players: updates.players ? JSON.stringify(updates.players) : undefined,
      answers: updates.answers ? JSON.stringify(updates.answers) : undefined,
      time_left: updates.timeLeft,
      started_at: updates.startedAt,
      updated_at: new Date().toISOString()
    };

    // Remove campos undefined
    Object.keys(dbUpdates).forEach(key => {
      if (dbUpdates[key] === undefined) delete dbUpdates[key];
    });

    const { error } = await supabase
      .from('games')
      .update(dbUpdates)
      .eq('code', gameCode);

    if (error) {
      console.error('Erro ao atualizar no Supabase:', error);
    }
  }

  return memoryGames.get(gameCode);
}

async function deleteGame(gameCode) {
  memoryGames.delete(gameCode);

  if (isSupabaseEnabled && supabase) {
    await supabase
      .from('games')
      .delete()
      .eq('code', gameCode);
  }
}

module.exports = {
  getGame,
  updateGame,
  deleteGame
};
