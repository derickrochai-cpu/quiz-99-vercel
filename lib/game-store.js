// Helper para buscar e atualizar jogos no Supabase ou memória
const { supabase, memoryGames, isSupabaseEnabled } = require('./supabase');

async function getGame(gameCode) {
  // SEMPRE busca do Supabase primeiro se disponível (para ter dados atualizados)
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
      questions: parseJson(data.questions),
      status: data.status,
      currentQuestion: data.current_question,
      players: parseJson(data.players) || [],
      answers: parseJson(data.answers) || {},
      timeLeft: data.time_left,
      startedAt: data.started_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      results: parseJson(data.results)
    };

    // Atualiza cache em memória
    memoryGames.set(gameCode, game);
    return game;
  }

  // Fallback: busca da memória
  if (memoryGames.has(gameCode)) {
    return memoryGames.get(gameCode);
  }

  return null;
}

// Helper para parsear JSON de forma segura
function parseJson(value) {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (e) {
      return value;
    }
  }
  return value;
}

async function updateGame(gameCode, updates) {
  // Atualiza em memória primeiro
  const existingGame = memoryGames.get(gameCode);
  if (existingGame) {
    Object.assign(existingGame, updates, { updatedAt: new Date().toISOString() });
  }

  // Atualiza no Supabase se habilitado
  if (isSupabaseEnabled && supabase) {
    const dbUpdates = {
      status: updates.status,
      current_question: updates.currentQuestion,
      players: updates.players,
      answers: updates.answers,
      time_left: updates.timeLeft,
      started_at: updates.startedAt ? new Date(updates.startedAt).toISOString() : undefined,
      results: updates.results,
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
      console.error('[updateGame] Erro ao atualizar no Supabase:', error);
    } else {
      console.log('[updateGame] Jogo atualizado:', gameCode, 'campos:', Object.keys(dbUpdates));
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
