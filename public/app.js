/**
 * ============================================
 * QUIZ 99 - CLIENTE COMPLETO
 * ============================================
 */

// Estado global
let currentGame = null;
let currentPlayer = null;
let currentQuestion = null;
let pollInterval = null;
let adminToken = null;
let questionsList = [];

// Letras para opções
const LETTERS = ['A', 'B', 'C', 'D'];

// ============================================
// UTILIDADES
// ============================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
}

// ============================================
// POLLING
// ============================================
function startPolling(gameCode, role) {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/game/poll?gameCode=${gameCode}`);
            if (response.status === 304) return;
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

// ============================================
// GAME STATE HANDLER
// ============================================
function handleGameUpdate(data, role) {
    console.log('[Game Update]', role, data.status);

    // PLAYER: Waiting -> Playing
    if (role === 'player' && data.status === 'playing' && data.question) {
        if (!currentQuestion || currentQuestion.id !== data.question.id) {
            currentQuestion = data.question;
            showScreen('game-screen');
            showPlayerQuestion(data.question);
        }
        updateTimer(data.timeLeft);
    }

    // PLAYER: Update waiting list
    if (role === 'player' && data.status === 'waiting') {
        updateWaitingPlayers(data.players);
    }

    // ADMIN: Waiting room
    if (role === 'admin' && data.status === 'waiting') {
        updateAdminWaitingPlayers(data.players);
    }

    // ADMIN: Game started
    if (role === 'admin' && data.status === 'playing') {
        const isOnGameControl = document.getElementById('admin-game-control')?.classList.contains('active');
        if (!isOnGameControl) {
            showScreen('admin-game-control');
        }
        updateAdminGameView(data);
    }

    // Game finished
    if (data.status === 'finished' && data.ranking) {
        stopPolling();
        if (role === 'player') {
            showPlayerFinalRanking(data.ranking);
        } else {
            showAdminFinalRanking(data.ranking);
        }
    }
}

// ============================================
// PLAYER FUNCTIONS
// ============================================
async function joinGame() {
    const name = document.getElementById('player-name').value.trim();
    const email = document.getElementById('player-email').value.trim();
    const gameCode = document.getElementById('game-code').value.trim().toUpperCase();

    if (!name || !email || !gameCode) {
        alert('Preencha todos os campos!');
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
            alert(data.error || 'Erro ao entrar no jogo');
            return;
        }

        currentPlayer = { id: data.playerId, name, email };
        currentGame = { code: gameCode };

        showScreen('waiting-screen');
        startPolling(gameCode, 'player');

    } catch (err) {
        alert('Erro: ' + err.message);
    }
}

function updateWaitingPlayers(players) {
    const count = players?.length || 0;
    document.getElementById('waiting-players').textContent = `Jogadores: ${count}`;
    const container = document.getElementById('players-avatars');
    if (container) {
        container.innerHTML = (players || []).map(p =>
            `<div class="player-avatar" title="${p.name}">${p.name.charAt(0).toUpperCase()}</div>`
        ).join('');
    }
}

function showPlayerQuestion(question) {
    document.getElementById('current-q').textContent = question.questionNumber;
    document.getElementById('total-q').textContent = question.totalQuestions;
    document.getElementById('question-text').textContent = question.text;

    const optionsGrid = document.getElementById('options-grid');
    optionsGrid.innerHTML = '';

    question.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'option';
        btn.innerHTML = `
            <span class="option-letter">${LETTERS[index]}</span>
            <span>${option}</span>
        `;
        btn.onclick = () => submitAnswer(index);
        optionsGrid.appendChild(btn);
    });

    currentQuestion.startTime = Date.now();
}

function updateTimer(timeLeft) {
    const timerEl = document.getElementById('timer-text');
    const barEl = document.getElementById('timer-bar');
    if (timerEl) timerEl.textContent = timeLeft || 30;
    if (barEl && currentQuestion) {
        const pct = ((timeLeft || 30) / currentQuestion.time) * 100;
        barEl.style.width = pct + '%';
    }
}

async function submitAnswer(answerIndex) {
    if (!currentGame || !currentQuestion) return;

    document.querySelectorAll('.option').forEach(btn => btn.disabled = true);

    const answerTime = Date.now() - (currentQuestion.startTime || Date.now());

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

        const buttons = document.querySelectorAll('.option');
        buttons.forEach((btn, idx) => {
            if (idx === currentQuestion.correctAnswer) {
                btn.classList.add('correct');
            } else if (idx === answerIndex && !data.isCorrect) {
                btn.classList.add('wrong');
            }
        });

    } catch (err) {
        console.error('Erro ao responder:', err);
    }
}

function showPlayerFinalRanking(ranking) {
    showScreen('podium-screen');

    const podium = document.getElementById('podium-container');
    const top3 = ranking.slice(0, 3);
    const order = [1, 0, 2];

    podium.innerHTML = order.map(pos => {
        const p = top3[pos];
        if (!p) return '';
        const cls = pos === 1 ? 'first' : pos === 0 ? 'second' : 'third';
        const medal = pos === 1 ? '🥇' : pos === 0 ? '🥈' : '🥉';
        return `
            <div class="podium-place">
                <div class="podium-avatar ${cls === 'first' ? 'first' : ''}">${medal}</div>
                <div class="podium-block ${cls}">
                    <div class="podium-name">${p.name}</div>
                    <div class="podium-score">${p.score} pts</div>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('coupon-section').style.display = 'block';
}

// ============================================
// ADMIN LOGIN
// ============================================
async function adminLogin() {
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;

    if (!email || !password) {
        alert('Preencha email e senha!');
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
            alert('Credenciais inválidas!');
            return;
        }

        adminToken = data.token;
        localStorage.setItem('adminToken', adminToken);
        questionsList = [];
        renderQuestionsList();
        showScreen('admin-dashboard');

    } catch (err) {
        alert('Erro no login: ' + err.message);
    }
}

function logoutAdmin() {
    adminToken = null;
    localStorage.removeItem('adminToken');
    currentGame = null;
    questionsList = [];
    stopPolling();
    showScreen('home-screen');
}

// ============================================
// QUESTION BUILDER
// ============================================
function addQuestion() {
    const text = document.getElementById('new-question-text').value.trim();
    const opts = [
        document.getElementById('option-0').value.trim(),
        document.getElementById('option-1').value.trim(),
        document.getElementById('option-2').value.trim(),
        document.getElementById('option-3').value.trim()
    ];

    const correct = parseInt(document.querySelector('input[name="correct-answer"]:checked')?.value || '0');
    const time = parseInt(document.getElementById('question-time').value);

    if (!text) {
        alert('Digite a pergunta!');
        return;
    }

    if (opts.some(o => !o)) {
        alert('Preencha todas as 4 opções!');
        return;
    }

    questionsList.push({ text, options: opts, correctAnswer: correct, time });

    // Clear form
    document.getElementById('new-question-text').value = '';
    document.getElementById('option-0').value = '';
    document.getElementById('option-1').value = '';
    document.getElementById('option-2').value = '';
    document.getElementById('option-3').value = '';
    document.querySelector('input[name="correct-answer"][value="0"]').checked = true;

    renderQuestionsList();
}

function removeQuestion(index) {
    questionsList.splice(index, 1);
    renderQuestionsList();
}

function renderQuestionsList() {
    const container = document.getElementById('questions-list');
    const btn = document.getElementById('create-game-btn');
    const error = document.getElementById('create-game-error');

    btn.disabled = questionsList.length === 0;
    error.style.display = questionsList.length === 0 ? 'block' : 'none';

    if (questionsList.length === 0) {
        container.innerHTML = `
            <div class="empty-questions">
                <div class="empty-questions-icon">📝</div>
                <p>Nenhuma pergunta ainda. Adicione sua primeira pergunta abaixo!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = questionsList.map((q, i) => `
        <div class="question-item">
            <div class="question-header">
                <span class="question-number">Pergunta ${i + 1}</span>
                <button class="btn btn-danger btn-small" onclick="removeQuestion(${i})">🗑️ Remover</button>
            </div>
            <p style="color:#000;margin-bottom:10px;font-weight:600;">${q.text}</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                ${q.options.map((opt, idx) => `
                    <div style="padding:10px;background:${idx === q.correctAnswer ? '#d4edda' : '#f5f5f5'};border:2px solid ${idx === q.correctAnswer ? '#28a745' : '#ddd'};border-radius:8px;color:#000;font-size:0.9rem;">
                        ${LETTERS[idx]}. ${opt} ${idx === q.correctAnswer ? '✅' : ''}
                    </div>
                `).join('')}
            </div>
            <p style="color:#666;font-size:0.9rem;">⏱️ ${q.time} segundos</p>
        </div>
    `).join('');
}

// ============================================
// CREATE & START GAME
// ============================================
async function createGame() {
    const title = document.getElementById('quiz-title').value.trim();

    if (!title) {
        alert('Digite um título para o quiz!');
        return;
    }

    if (questionsList.length === 0) {
        alert('Adicione pelo menos 1 pergunta!');
        return;
    }

    try {
        const response = await fetch('/api/game/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ title, questions: questionsList })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Erro ao criar jogo');
            return;
        }

        currentGame = { code: data.gameCode, title };
        document.getElementById('admin-game-code').textContent = data.gameCode;
        showScreen('admin-waiting-room');
        startPolling(data.gameCode, 'admin');

    } catch (err) {
        alert('Erro: ' + err.message);
    }
}

function updateAdminWaitingPlayers(players) {
    const countEl = document.getElementById('admin-player-count');
    const container = document.getElementById('admin-waiting-players');
    const msg = document.getElementById('no-players-msg');

    const count = players?.length || 0;
    if (countEl) countEl.textContent = count;

    if (!container) return;

    if (!players || players.length === 0) {
        container.innerHTML = '';
        if (msg) msg.style.display = 'block';
        return;
    }

    if (msg) msg.style.display = 'none';
    container.innerHTML = players.map(p =>
        `<div class="player-avatar" title="${p.name}">${p.name.charAt(0).toUpperCase()}</div>`
    ).join('');
}

async function startGame() {
    if (!currentGame?.code) {
        alert('Nenhum jogo encontrado!');
        return;
    }

    try {
        const response = await fetch('/api/game/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ gameCode: currentGame.code })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Erro ao iniciar jogo');
            return;
        }

    } catch (err) {
        alert('Erro: ' + err.message);
    }
}

// ============================================
// ADMIN GAME VIEW
// ============================================
function updateAdminGameView(data) {
    const q = data.question;
    if (!q) return;

    document.getElementById('admin-current-q').textContent = q.questionNumber;
    document.getElementById('admin-timer').textContent = (data.timeLeft || q.time) + 's';
    document.getElementById('admin-q-progress').textContent = `Pergunta ${q.questionNumber} de ${q.totalQuestions}`;
    document.getElementById('admin-question-text').textContent = q.text;

    const optsContainer = document.getElementById('admin-options-display');
    optsContainer.innerHTML = q.options.map((opt, idx) => `
        <div class="admin-option ${idx === q.correctAnswer ? 'correct' : ''}">
            <div class="admin-option-letter">${LETTERS[idx]}</div>
            <span style="color:#000;font-weight:600;">${opt}</span>
        </div>
    `).join('');

    document.getElementById('admin-correct-ans').textContent = `${LETTERS[q.correctAnswer]} - ${q.options[q.correctAnswer]}`;

    const answers = data.answers || {};
    const currentAnswers = answers[data.currentQuestion] || {};
    const answeredCount = Object.keys(currentAnswers).length;
    document.getElementById('admin-answered-count').textContent = `${answeredCount}/${data.playerCount}`;
}

function adminNextQuestion() {
    // Placeholder para funcionalidade futura
}

function showAdminFinalRanking(ranking) {
    showScreen('admin-final-ranking');

    const podium = document.getElementById('admin-podium');
    const top3 = ranking.slice(0, 3);
    const order = [1, 0, 2];

    podium.innerHTML = order.map(pos => {
        const p = top3[pos];
        if (!p) return '';
        const cls = pos === 1 ? 'first' : pos === 0 ? 'second' : 'third';
        const medal = pos === 1 ? '🥇' : pos === 0 ? '🥈' : '🥉';
        return `
            <div class="podium-place">
                <div class="podium-avatar ${cls === 'first' ? 'first' : ''}">${medal}</div>
                <div class="podium-block ${cls}">
                    <div class="podium-name">${p.name}</div>
                    <div class="podium-score">${p.score} pts</div>
                </div>
            </div>
        `;
    }).join('');

    const list = document.getElementById('admin-final-list');
    list.innerHTML = ranking.map((p, i) => `
        <div class="ranking-item ${i < 3 ? 'top-' + (i + 1) : ''}">
            <div class="rank-position">#${i + 1}</div>
            <div class="rank-name">${p.name}</div>
            <div class="rank-score">${p.score} pts</div>
        </div>
    `).join('');
}

function adminBackToDashboard() {
    currentGame = null;
    questionsList = [];
    renderQuestionsList();
    showScreen('admin-dashboard');
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('adminToken');
    if (saved) adminToken = saved;
});
