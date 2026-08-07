// Rota de polling para verificar estado do jogo - Agora com persistência no Supabase
const { getGame, updateGame } = require('../../lib/game-store');

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

  let game = await getGame(gameCode);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  // NOTA: Auto-advance removido - agora o admin controla manualmente
  // O jogo permanece no estado atual até o admin chamar /api/game/next
  if (game.status === 'playing' && game.currentQuestion >= 0 && game.questions) {
    const currentQ = game.questions[game.currentQuestion];
    if (currentQ) {
      // Usar questionStartedAt se disponível, senão fallback para updatedAt/startedAt
      const questionStartTime = new Date(game.questionStartedAt || game.updatedAt || game.startedAt).getTime();
      const now = Date.now();
      let elapsed = Math.floor((now - questionStartTime) / 1000);

      // Se o tempo ainda não começou (elapsed negativo), mostrar tempo cheio
      if (elapsed < 0) {
        elapsed = 0;
      }

      const timeLeft = Math.max(0, currentQ.time - elapsed);

      // Se acabou o tempo na última pergunta, finalizar jogo automaticamente
      // (apenas no último question, o resto é controlado pelo admin)
      if (timeLeft <= 0) {
        const nextQuestion = game.currentQuestion + 1;

        if (nextQuestion >= game.questions.length && game.status !== 'finished') {
          // FIM DO JOGO - Calcular resultados
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

          await updateGame(gameCode, {
            status: 'finished',
            currentQuestion: nextQuestion,
            timeLeft: 0,
            results: scores
          });

          // Recarregar o jogo atualizado
          game = await getGame(gameCode);
        }
        // NOTA: Não avança automaticamente para próxima pergunta - admin controla manualmente
      }
    }
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
    if (q) {
      // Usar questionStartedAt para calcular tempo
      const questionStartTime = new Date(game.questionStartedAt || game.updatedAt || game.startedAt).getTime();
      const now = Date.now();
      const timeUntilStart = Math.floor((questionStartTime - now) / 1000);
      let elapsed = Math.floor((now - questionStartTime) / 1000);

      // Se o tempo ainda não começou (elapsed negativo)
      const timerNotStarted = elapsed < 0;
      if (timerNotStarted) {
        elapsed = 0;
      }

      const timeLeft = Math.max(0, q.time - elapsed);

      response.question = {
        id: q.id,
        text: q.text,
        options: q.options,
        time: q.time,
        questionNumber: game.currentQuestion + 1,
        totalQuestions: game.questions.length
      };

      // Flag para indicar que o timer ainda não começou (animação em andamento)
      if (timerNotStarted) {
        response.timerNotStarted = true;
        response.timeUntilStart = timeUntilStart;
      }

      // Só mostrar a resposta correta quando o tempo acabar (timeLeft = 0)
      if (timeLeft === 0 && !timerNotStarted) {
        response.question.correctAnswer = q.correctAnswer;
        response.questionEnded = true; // Flag para indicar que a pergunta acabou
      }

      response.timeLeft = timeLeft;

      // Calcular ranking parcial
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
      response.ranking = scores;

      // Se a pergunta acabou (timeLeft = 0), indicar que é hora de mostrar ranking
      if (timeLeft === 0) {
        response.showRanking = true;
      }
    }
  }

  // Se jogo terminou, incluir ranking final
  if (game.status === 'finished' && game.results) {
    response.ranking = game.results;
  }

  res.json(response);
};
