/**
 * ============================================
 * QUIZ 99 - CLIENTE (HTTP POLLING VERSION)
 * ============================================
 * Lógica do frontend para o Quiz - Funciona na Vercel
 */

// Estado global
let currentGame = null;
let currentPlayer = null;
let currentQuestion = null;
let pollInterval = null;
let adminToken = null;

// ============================================
// NAVEGAÇAÇO ENTRE TELAS
// ============================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// ============================================
// POLLING - ATUALIZAÇÃO DO JOGO
// ============================================
function startPolling(gameCode, role) {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/game/poll?gameCode=${gameCode}`);
            if (!response.ok) return;

            const data = await response.json();
            handleGameUpdate(data, role);
        } catch (err) {
            console.log('Poll error:', err);
        }
    }, 1000);
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

function handleGameUpdate(data, role) {
    // Jogo iniciou
    if (data.status === 'playing' && data.question && !currentQuestion) {
        currentQuestion = data.question;
        if (role === 'player') {
            showScreen('game-screen');
            showQuestion(data.question);
        } else if (role === 'admin') {
            showAdminQuestion(data);
        }
    }

    // Nova pergunta
    if (data.status === 'playing' && data.question && data.question.id !== currentQuestion?.id) {
        currentQuestion = data.question;
        if (role === 'player') {
            showQuestion(data.question);
        } else if (role === 'admin') {
            showAdminQuestion(data);
        }
    }

    // Atualizar timer
    if (data.timeLeft !== undefined) {
        updateTimer(data.timeLeft);
    }

    // Atualizar lista de jogadores (admin)
    if (role === 'admin' && data.players) {
        updatePlayersList(data.players);
    }

    // Jogo terminou
    if (data.status === 'finished' && data.ranking) {
        stopPolling();
        if (role === 'player') {
            showRanking(data.ranking);
        } else {
            showAdminRanking(data.ranking);
        }
    }
}

// ============================================
// JOGADOR - ENTRAR NO JOGO
// ============================================
async function joinGame() {
    const name = document.getElementById('player-name').value.trim();
    const email = document.getElementById('player-email').value.trim();
    const gameCode = document.getElementById('game-code').value.trim().toUpperCase();

    if (!name || !email || !gameCode) {
        alert('Please fill in all fields!');
        return;
    }

    try {
        const response = await fetch('/api/game/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameCode, name, email })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Error joining game');
            return;
        }

        currentPlayer = { id: data.playerId, name, email };
        currentGame = { code: gameCode };

        showScreen('waiting-screen');
        startPolling(gameCode, 'player');

    } catch (err) {
        alert('Error joining game: ' + err.message);
    }
}

// ============================================
// ADMIN - LOGIN
// ============================================
async function adminLogin() {
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;

    if (!email || !password) {
        alert('Please fill in all fields!');
        return;
    }

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            alert('Invalid credentials!');
            return;
        }

        adminToken = data.token;
        localStorage.setItem('adminToken', adminToken);
        showScreen('admin-dashboard');
        loadAdminDashboard();

    } catch (err) {
        alert('Login error: ' + err.message);
    }
}

// ============================================
// ADMIN - CRIAR JOGO
// ============================================
async function createGame() {
    const title = document.getElementById('quiz-title').value.trim();
    const questionsText = document.getElementById('quiz-questions').value.trim();

    if (!title || !questionsText) {
        alert('Please fill in all fields!');
        return;
    }

    // Parse questions
    const questions = parseQuestions(questionsText);
    if (questions.length === 0) {
        alert('Invalid questions format!');
        return;
    }

    try {
        const response = await fetch('/api/game/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ title, questions })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Error creating game');
            return;
        }

        document.getElementById('created-game-code').value = data.gameCode;
        document.getElementById('game-info').style.display = 'block';

        currentGame = { code: data.gameCode };
        startPolling(data.gameCode, 'admin');

    } catch (err) {
        alert('Error creating game: ' + err.message);
    }
}

// ============================================
// ADMIN - INICIAR JOGO
// ============================================
async function startGame() {
    const gameCode = document.getElementById('created-game-code').value;

    if (!gameCode) {
        alert('Error: No game code found!');
        return;
    }

    try {
        const response = await fetch('/api/game/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ gameCode })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Error starting game');
            return;
        }

        // Polling vai detectar mudança de status

    } catch (err) {
        alert('Error starting game: ' + err.message);
    }
}

// ============================================
// JOGADOR - RESPONDER PERGUNTA
// ============================================
async function submitAnswer(answerIndex) {
    if (!currentGame || !currentQuestion) return;

    const startTime = currentQuestion.startTime || Date.now();
    const answerTime = Date.now() - startTime;

    try {
        const response = await fetch('/api/game/answer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Player-Id': currentPlayer?.id || 'anonymous'
            },
            body: JSON.stringify({
                gameCode: currentGame.code,
                questionId: currentQuestion.id,
                answer: answerIndex,
                answerTime
            })
        });

        const data = await response.json();

        // Mostrar feedback
        const buttons = document.querySelectorAll('.answer-btn');
        buttons.forEach((btn, idx) => {
            btn.disabled = true;
            if (idx === currentQuestion.correctAnswer) {
                btn.classList.add('correct');
            } else if (idx === answerIndex && !data.isCorrect) {
                btn.classList.add('wrong');
            }
        });

    } catch (err) {
        console.error('Submit answer error:', err);
    }
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================
function parseQuestions(text) {
    const questions = [];
    const blocks = text.split('\n\n');

    for (const block of blocks) {
        const lines = block.split('\n').filter(l => l.trim());
        if (lines.length < 6) continue;

        const text = lines[0];
        const options = lines.slice(1, 5);
        const correctLine = lines[5];
        const correctAnswer = parseInt(correctLine.replace(/[^0-3]/g, ''));
        const timeLine = lines[6] || '30';
        const time = parseInt(timeLine.replace(/[^0-9]/g, '')) || 30;

        if (options.length === 4 && !isNaN(correctAnswer)) {
            questions.push({ text, options, correctAnswer, time });
        }
    }

    return questions;
}

function showQuestion(question) {
    document.getElementById('question-text').textContent = question.text;
    const optionsDiv = document.getElementById('answer-options');
    optionsDiv.innerHTML = '';

    question.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.textContent = option;
        btn.onclick = () => submitAnswer(index);
        optionsDiv.appendChild(btn);
    });

    question.startTime = Date.now();
}

function showAdminQuestion(data) {
    // Implementar tela do admin com pergunta
    console.log('Admin question:', data.question);
}

function updateTimer(timeLeft) {
    const timerEl = document.getElementById('timer');
    if (timerEl) {
        timerEl.textContent = timeLeft;
    }
}

function updatePlayersList(players) {
    const listEl = document.getElementById('players-list');
    if (listEl) {
        listEl.innerHTML = players.map(p => `<div>${p.name}</div>`).join('');
    }
}

function showRanking(ranking) {
    console.log('Ranking:', ranking);
    showScreen('results-screen');
}

function showAdminRanking(ranking) {
    console.log('Admin ranking:', ranking);
}

function loadAdminDashboard() {
    adminToken = localStorage.getItem('adminToken');
    console.log('Admin dashboard loaded');
}

function logoutAdmin() {
    adminToken = null;
    localStorage.removeItem('adminToken');
    showScreen('admin-login');
}

// Inicializar
if (localStorage.getItem('adminToken')) {
    adminToken = localStorage.getItem('adminToken');
}
