const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configurações - HARDCODED para funcionar na Vercel
const JWT_SECRET = 'quiz99_secret_key_2024';
const ADMIN_EMAIL = 'admin@99app.com';
const ADMIN_PASSWORD = 'admin123';

// Banco de dados em memória
const db = {
  games: new Map(),
  players: new Map(),
  admins: new Map()
};

// ============================================
// ROTAS API
// ============================================

// Login Admin
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;

  // Validação simples sem bcrypt
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, email });
});

// Criar jogo
app.post('/api/game/create', (req, res) => {
  const { title, questions } = req.body;
  const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const game = {
    id: uuidv4(),
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
    players: new Map(),
    scores: new Map(),
    createdAt: new Date()
  };

  db.games.set(gameCode, game);

  res.json({
    success: true,
    gameCode,
    gameId: game.id
  });
});

// Verificar status do jogo
app.get('/api/game/:code/status', (req, res) => {
  const game = db.games.get(req.params.code);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  res.json({
    status: game.status,
    currentQuestion: game.currentQuestion,
    totalQuestions: game.questions.length,
    playerCount: game.players.size
  });
});

// ============================================
// SOCKET.IO - TEMPO REAL
// ============================================

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Jogador entra no jogo
  socket.on('join-game', ({ gameCode, name, email }) => {
    const game = db.games.get(gameCode);

    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    if (game.status !== 'waiting') {
      socket.emit('error', { message: 'Game already started' });
      return;
    }

    // Verificar se email já está em uso
    for (const [_, player] of game.players) {
      if (player.email === email) {
        socket.emit('error', { message: 'Email already registered in this game' });
        return;
      }
    }

    const player = {
      id: socket.id,
      name,
      email,
      socketId: socket.id,
      joinedAt: Date.now()
    };

    game.players.set(socket.id, player);
    game.scores.set(socket.id, {
      score: 0,
      correctAnswers: 0,
      totalTime: 0,
      answers: []
    });

    socket.join(gameCode);
    socket.gameCode = gameCode;

    socket.emit('joined', {
      playerId: socket.id,
      gameCode,
      playerName: name
    });

    // Notificar admin
    io.to(`admin-${gameCode}`).emit('player-joined', {
      playerCount: game.players.size,
      players: Array.from(game.players.values()).map(p => ({
        name: p.name,
        email: p.email
      }))
    });

    // Notificar todos os jogadores
    io.to(gameCode).emit('player-count', { count: game.players.size });
  });

  // Admin conecta
  socket.on('admin-join', ({ gameCode, token }) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const game = db.games.get(gameCode);

      if (!game) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      socket.join(`admin-${gameCode}`);
      socket.adminGameCode = gameCode;

      socket.emit('admin-joined', {
        gameCode,
        status: game.status,
        players: Array.from(game.players.values()).map(p => ({
          name: p.name,
          email: p.email
        })),
        quiz: game
      });

    } catch (err) {
      socket.emit('error', { message: 'Invalid token' });
    }
  });

  // Iniciar jogo
  socket.on('start-game', ({ gameCode }) => {
    console.log('🎮 Start game requested:', gameCode);
    console.log('   Socket ID:', socket.id);

    const game = db.games.get(gameCode);
    if (!game) {
      console.log('   ❌ Game not found');
      return socket.emit('error', { message: 'Game not found' });
    }

    console.log('   ✅ Game found, starting...');
    game.status = 'playing';
    game.currentQuestion = 0;

    io.to(gameCode).emit('game-started');
    console.log('   ✅ Game-started event emitted to room:', gameCode);

    // Enviar primeira pergunta
    sendQuestion(gameCode);
  });

  // Responder pergunta
  socket.on('answer-question', ({ gameCode, questionId, answer, answerTime }) => {
    const game = db.games.get(gameCode);
    if (!game || game.status !== 'playing') return;

    const currentQuestion = game.questions[game.currentQuestion];
    if (!currentQuestion || currentQuestion.id !== questionId) return;

    const isCorrect = answer === currentQuestion.correctAnswer;
    const responseTime = Math.min(answerTime, currentQuestion.time * 1000);

    // Armazenar resposta
    if (!game.answers) game.answers = new Map();
    if (!game.answers.has(game.currentQuestion)) {
      game.answers.set(game.currentQuestion, new Map());
    }

    game.answers.get(game.currentQuestion).set(socket.id, {
      playerId: socket.id,
      answer,
      isCorrect,
      responseTime,
      timestamp: Date.now()
    });

    // Calcular pontuação
    const scores = game.scores.get(socket.id);
    if (isCorrect) {
      // Pontuação base + bônus por velocidade
      const timeBonus = Math.round((1 - responseTime / (currentQuestion.time * 1000)) * 100);
      scores.score += 100 + timeBonus;
      scores.correctAnswers++;
    }
    scores.totalTime += responseTime;

    socket.emit('answer-received', { isCorrect });
  });

  // Próxima pergunta
  socket.on('next-question', ({ gameCode }) => {
    const game = db.games.get(gameCode);
    if (!game) return;

    // Mostrar ranking antes da próxima
    showRanking(gameCode);

    setTimeout(() => {
      game.currentQuestion++;

      if (game.currentQuestion >= game.questions.length) {
        endGame(gameCode);
      } else {
        sendQuestion(gameCode);
      }
    }, 5000); // 5 segundos para ver ranking
  });

  // Desconectar
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);

    if (socket.gameCode) {
      const game = db.games.get(socket.gameCode);
      if (game && game.status === 'waiting') {
        game.players.delete(socket.id);
        game.scores.delete(socket.id);

        io.to(`admin-${socket.gameCode}`).emit('player-left', {
          playerCount: game.players.size,
          players: Array.from(game.players.values()).map(p => ({
            name: p.name,
            email: p.email
          }))
        });
      }
    }
  });
});

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function sendQuestion(gameCode) {
  const game = db.games.get(gameCode);
  if (!game) return;

  const question = game.questions[game.currentQuestion];
  game.answers.set(game.currentQuestion, new Map());

  // Enviar para jogadores (sem resposta correta)
  io.to(gameCode).emit('question', {
    questionNumber: game.currentQuestion + 1,
    totalQuestions: game.questions.length,
    question: {
      id: question.id,
      text: question.text,
      options: question.options,
      time: question.time
    }
  });

  // Enviar para admin (com resposta correta)
  io.to(`admin-${gameCode}`).emit('admin-question', {
    questionNumber: game.currentQuestion + 1,
    totalQuestions: game.questions.length,
    question: {
      id: question.id,
      text: question.text,
      options: question.options,
      time: question.time,
      correctAnswer: question.correctAnswer
    },
    playerCount: game.players.size
  });

  // Timer
  let timeLeft = question.time;
  const interval = setInterval(() => {
    timeLeft--;

    io.to(gameCode).emit('timer', { timeLeft, total: question.time });
    io.to(`admin-${gameCode}`).emit('timer', { timeLeft, total: question.time });

    if (timeLeft <= 0) {
      clearInterval(interval);
      showResults(gameCode);
    }
  }, 1000);
}

function showResults(gameCode) {
  const game = db.games.get(gameCode);
  if (!game) return;

  const question = game.questions[game.currentQuestion];
  const answers = game.answers.get(game.currentQuestion) || new Map();

  // Estatísticas
  const stats = { total: game.players.size, answered: answers.size, correct: 0, distribution: [0, 0, 0, 0] };

  answers.forEach(ans => {
    if (ans.isCorrect) stats.correct++;
    if (ans.answer >= 0 && ans.answer < 4) {
      stats.distribution[ans.answer]++;
    }
  });

  // Ranking parcial
  const ranking = calculateRanking(game);

  io.to(gameCode).emit('question-results', {
    correctAnswer: question.correctAnswer,
    ranking: ranking.slice(0, 5).map((r, index) => ({
      position: index + 1,
      name: r.name,
      score: r.score,
      isMe: false
    })),
    stats
  });

  io.to(`admin-${gameCode}`).emit('admin-question-results', {
    correctAnswer: question.correctAnswer,
    ranking,
    stats,
    answers: Array.from(answers.entries()).map(([playerId, ans]) => ({
      playerName: game.players.get(playerId)?.name || 'Unknown',
      ...ans
    }))
  });
}

function showRanking(gameCode) {
  const game = db.games.get(gameCode);
  if (!game) return;

  const ranking = calculateRanking(game);

  io.to(gameCode).emit('show-ranking', {
    ranking: ranking.slice(0, 10).map((r, index) => ({
      position: index + 1,
      name: r.name,
      score: r.score,
      correctAnswers: r.correctAnswers
    }))
  });
}

function calculateRanking(game) {
  const playersWithScores = Array.from(game.players.entries()).map(([id, player]) => ({
    id,
    name: player.name,
    ...game.scores.get(id)
  }));

  // Ordenar por pontuação (decrescente) e tempo (crescente)
  return playersWithScores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.totalTime - b.totalTime;
  });
}

function endGame(gameCode) {
  const game = db.games.get(gameCode);
  if (!game) return;

  game.status = 'finished';

  const finalRanking = calculateRanking(game);
  const top3 = finalRanking.slice(0, 3).map((r, index) => ({
    position: index + 1,
    name: r.name,
    score: r.score,
    correctAnswers: r.correctAnswers,
    email: game.players.get(r.id)?.email || ''
  }));

  // Enviar resultado final
  io.to(gameCode).emit('game-ended', {
    ranking: finalRanking.map((r, index) => ({
      position: index + 1,
      name: r.name,
      score: r.score,
      correctAnswers: r.correctAnswers
    })),
    top3
  });

  io.to(`admin-${gameCode}`).emit('admin-game-ended', {
    ranking: finalRanking,
    top3
  });
}

// ============================================
// INICIAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚕 Quiz 99 server running on port ${PORT}`);
});
