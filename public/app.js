/**
 * ============================================
 * QUIZ 99 - CLIENTE COMPLETO
 * ============================================
 */

let currentGame = null;
let currentPlayer = null;
let currentQuestion = null;
let pollInterval = null;
let adminToken = null;
let questionsList = [];
let hasAnsweredCurrent = false;
let showingRanking = false; // Flag para controlar exibição do ranking

const LETTERS = ['A', 'B', 'C', 'D'];

// ============================================
// NAVIGATION
// ============================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
}

// ============================================
// POLLING
// ============================================
function startPolling(gameCode, role) {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => pollGame(gameCode, role), 1000);
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

async function pollGame(gameCode, role) {
    try {
        const response = await fetch(`/api/game/poll?gameCode=${gameCode}&t=${Date.now()}`);
        if (!response.ok) return;
        const data = await response.json();
        handleGameUpdate(data, role);
    } catch (err) {
        console.log('Poll error:', err.message);
    }
}

// ============================================
// GAME STATE
// ============================================
function handleGameUpdate(data, role) {
    // Player - Game started
    if (role === 'player' && data.status === 'playing') {
        if (data.question) {
            const isNewQuestion = !currentQuestion || currentQuestion.id !== data.question.id;
            const isSameQuestion = currentQuestion && currentQuestion.id === data.question.id;
            const questionJustEnded = data.timeLeft === 0 && data.showRanking;

            // Se a pergunta acabou (timeLeft = 0), mostrar ranking
            if (questionJustEnded && !showingRanking && data.ranking) {
                showingRanking = true;
                showInterimRanking(data.ranking);
                return; // Não processar mais nada - esperar próxima pergunta
            }

            // Se temos uma nova pergunta (número diferente ou ID diferente)
            if (isNewQuestion) {
                showingRanking = false; // Resetar flag
                currentQuestion = data.question;
                hasAnsweredCurrent = false;
                showScreen('game-screen');
                renderPlayerQuestion(data.question);
            }

            // Se estiver na tela de jogo, atualizar timer
            const isOnGameScreen = document.getElementById('game-screen')?.classList.contains('active');
            if (isOnGameScreen && isSameQuestion) {
                updatePlayerTimer(data.timeLeft, data.question.time);

                // Se o tempo acabou (timeLeft = 0) e temos resposta correta, mostrar
                if (data.timeLeft === 0 && data.question.correctAnswer !== undefined) {
                    showCorrectAnswer(data.question.correctAnswer);
                }
            }
        }
    }

    // Player - Waiting room
    if (role === 'player' && data.status === 'waiting') {
        updateWaitingPlayers(data.players);
    }

    // Admin - Waiting room
    if (role === 'admin' && data.status === 'waiting') {
        updateAdminWaitingPlayers(data.players);
    }

    // Admin - Game playing
    if (role === 'admin' && data.status === 'playing') {
        const isOnControl = document.getElementById('admin-game-control')?.classList.contains('active');
        if (!isOnControl) {
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
// PLAYER
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
            alert(data.error || 'Erro ao entrar');
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
    const countEl = document.getElementById('waiting-players');
    const container = document.getElementById('players-avatars');
    if (countEl) countEl.textContent = `Jogadores: ${count}`;
    if (container) {
        container.innerHTML = (players || []).map(p =>
            `<div class="player-avatar" title="${p.name}">${p.name.charAt(0).toUpperCase()}</div>`
        ).join('');
    }
}

function renderPlayerQuestion(question) {
    document.getElementById('current-q').textContent = question.questionNumber;
    document.getElementById('total-q').textContent = question.totalQuestions;
    document.getElementById('question-text').textContent = question.text;

    const grid = document.getElementById('options-grid');
    grid.innerHTML = '';

    question.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option';
        btn.id = `option-${idx}`;
        btn.innerHTML = `<span class="option-letter">${LETTERS[idx]}</span><span>${opt}</span>`;
        btn.onclick = function() { submitAnswer(idx); };
        grid.appendChild(btn);
    });

    // Timer começa do máximo
    document.getElementById('timer-bar').style.width = '100%';
}

function updatePlayerTimer(timeLeft, maxTime) {
    const t = timeLeft || 0;
    const max = maxTime || 30;
    const el = document.getElementById('timer-text');
    const bar = document.getElementById('timer-bar');
    if (el) el.textContent = t;
    if (bar) bar.style.width = ((t / max) * 100) + '%';
}

function showCorrectAnswer(correctIndex) {
    const buttons = document.querySelectorAll('.option');
    buttons.forEach((btn, idx) => {
        btn.disabled = true;
        if (idx === correctIndex) {
            btn.classList.add('correct');
        }
    });
}

async function submitAnswer(answerIndex) {
    if (!currentGame || !currentQuestion || hasAnsweredCurrent) return;

    hasAnsweredCurrent = true;

    // Desabilitar TODOS os botões para evitar múltiplas respostas
    const buttons = document.querySelectorAll('.option');
    buttons.forEach(btn => btn.disabled = true);

    // Marcar o botão clicado como selecionado (mas não mostra se está correto ainda)
    const clickedBtn = document.getElementById(`option-${answerIndex}`);
    if (clickedBtn) {
        clickedBtn.classList.add('selected');
    }

    const answerTime = Date.now() - (currentQuestion.startTime || Date.now());
    currentQuestion.startTime = currentQuestion.startTime || Date.now();

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

        // NÃO mostrar feedback visual de correto/errado ainda
        // Só quando o tempo acabar
        console.log('Resposta enviada:', data);

    } catch (err) {
        console.error('Erro ao responder:', err);
    }
}

// Mostrar ranking intermediário entre perguntas
function showInterimRanking(ranking) {
    const myRank = ranking.findIndex(p => p.id === currentPlayer?.id) + 1;
    const myScore = ranking.find(p => p.id === currentPlayer?.id)?.score || 0;
    const top5 = ranking.slice(0, 5);

    document.getElementById('interim-my-position').innerHTML =
        `Sua posição: <strong>#${myRank}</strong> | Pontos: <strong>${myScore}</strong>`;

    document.getElementById('interim-ranking-list').innerHTML = top5.map((p, i) => `
        <div class="ranking-item ${i < 3 ? 'top-' + (i + 1) : ''}">
            <div class="rank-position">#${i + 1}</div>
            <div class="rank-name">${p.name}</div>
            <div class="rank-score">${p.score} pts</div>
        </div>
    `).join('');

    showScreen('interim-ranking-screen');
}

// APIs de cupons (Supabase)
const COUPONS_API = '/api/coupons';

// Buscar cupom do jogador no Supabase
async function getPlayerCoupon() {
    if (!currentPlayer || !currentGame) return null;

    try {
        const response = await fetch(`${COUPONS_API}/get?playerEmail=${encodeURIComponent(currentPlayer.email)}&gameCode=${encodeURIComponent(currentGame.code)}`);

        const data = await response.json();
        if (data.success) {
            return data.coupon;
        }
    } catch (err) {
        console.log('Erro ao buscar cupom:', err);
    }
    return null;
}

// Atribuir cupom ao jogador no Supabase
async function assignCouponToPlayer(playerPosition, playerScore) {
    if (!currentPlayer || !currentGame) return null;

    try {
        const response = await fetch(`${COUPONS_API}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerEmail: currentPlayer.email,
                playerName: currentPlayer.name,
                gameCode: currentGame.code,
                position: playerPosition,
                score: playerScore
            })
        });

        const data = await response.json();
        if (data.success) {
            return data.coupon;
        }
    } catch (err) {
        console.log('Erro ao atribuir cupom:', err);
    }
    return null;
}

async function showPlayerFinalRanking(ranking) {
    showScreen('podium-screen');

    const myRank = ranking.findIndex(p => p.id === currentPlayer?.id) + 1;
    const myScore = ranking.find(p => p.id === currentPlayer?.id)?.score || 0;

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
                <div class="podium-avatar ${pos === 1 ? 'first' : ''}">${medal}</div>
                <div class="podium-block ${cls}">
                    <div class="podium-name">${p.name}</div>
                    <div class="podium-score">${p.score} pts</div>
                </div>
            </div>`;
    }).join('');

    // Buscar ou atribuir cupom
    let coupon = await getPlayerCoupon();
    if (!coupon) {
        coupon = await assignCouponToPlayer(myRank, myScore);
    }

    // Mostrar cupom
    if (coupon) {
        document.getElementById('coupon-discount').textContent = coupon.discount;
        document.getElementById('coupon-code').textContent = coupon.code;
        document.getElementById('coupon-section').style.display = 'block';
    } else {
        document.getElementById('coupon-section').innerHTML = `
            <div class="coupon-title">🎉 Parabéns!</div>
            <p style="color:#000; font-size:1.2rem;">Você terminou na posição #${myRank}!</p>
            <p style="color:#666;">Infelizmente não há cupons disponíveis no momento.</p>
        `;
        document.getElementById('coupon-section').style.display = 'block';
    }
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

    if (!text) { alert('Digite a pergunta!'); return; }
    if (opts.some(o => !o)) { alert('Preencha todas as opções!'); return; }

    questionsList.push({ text, options: opts, correctAnswer: correct, time });

    // Clear
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

    if (btn) btn.disabled = questionsList.length === 0;
    if (error) error.style.display = questionsList.length === 0 ? 'block' : 'none';

    if (!container) return;

    if (questionsList.length === 0) {
        container.innerHTML = `
            <div class="empty-questions">
                <div class="empty-questions-icon">📝</div>
                <p>Nenhuma pergunta ainda. Adicione sua primeira pergunta!</p>
            </div>`;
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
                    <div style="padding:10px;background:${idx === q.correctAnswer ? '#d4edda' : '#f5f5f5'};border:2px solid ${idx === q.correctAnswer ? '#28a745' : '#ddd'};border-radius:8px;color:#000;">
                        ${LETTERS[idx]}. ${opt} ${idx === q.correctAnswer ? '✅' : ''}
                    </div>
                `).join('')}
            </div>
            <p style="color:#666;font-size:0.9rem;">⏱️ ${q.time} segundos</p>
        </div>
    `).join('');
}

// ============================================
// CREATE & MANAGE GAME
// ============================================
async function createGame() {
    const title = document.getElementById('quiz-title').value.trim();
    if (!title) { alert('Digite um título!'); return; }
    if (questionsList.length === 0) { alert('Adicione pelo menos 1 pergunta!'); return; }

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
    const count = players?.length || 0;
    const countEl = document.getElementById('admin-player-count');
    const container = document.getElementById('admin-waiting-players');
    const msg = document.getElementById('no-players-msg');

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
    console.log('[startGame] Button clicked');
    console.log('[startGame] currentGame:', currentGame);
    console.log('[startGame] adminToken:', adminToken ? 'Present' : 'Missing');

    if (!currentGame?.code) {
        alert('Nenhum jogo!');
        return;
    }

    try {
        console.log('[startGame] Sending request...');
        const response = await fetch('/api/game/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ gameCode: currentGame.code })
        });

        console.log('[startGame] Response status:', response.status);
        const data = await response.json();
        console.log('[startGame] Response data:', data);

        if (!response.ok) {
            alert(data.error || 'Erro ao iniciar');
            return;
        }

        console.log('[startGame] Game started successfully');

    } catch (err) {
        console.error('[startGame] Error:', err);
        alert('Erro: ' + err.message);
    }
}

// ============================================
// ADMIN GAME CONTROLS
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

    // O quiz avança automaticamente quando o tempo acaba (timer = 0)
    // Mostrar status aos jogadores
    document.getElementById('admin-answered-count').textContent = `${data.playerCount} jogadores conectados`;
}

async function adminNextQuestion() {
    if (!currentGame?.code) return;

    try {
        const response = await fetch('/api/game/next', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ gameCode: currentGame.code })
        });

        const data = await response.json();
        if (!response.ok) {
            alert(data.error || 'Erro ao avançar');
            return;
        }

        if (data.status === 'finished') {
            // Game ended, polling will catch this and show results
        }

    } catch (err) {
        alert('Erro: ' + err.message);
    }
}

async function adminEndGame() {
    if (!currentGame?.code) return;

    if (!confirm('Tem certeza que deseja encerrar o quiz?')) return;

    try {
        // Forçar finalização pulando todas as perguntas
        const response = await fetch('/api/game/next', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ gameCode: currentGame.code })
        });

        const data = await response.json();
        if (!response.ok && !data.status === 'finished') {
            // Se retornou finished, é sucesso
            alert(data.error || 'Erro ao encerrar');
        }

    } catch (err) {
        alert('Erro: ' + err.message);
    }
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
                <div class="podium-avatar ${pos === 1 ? 'first' : ''}">${medal}</div>
                <div class="podium-block ${cls}">
                    <div class="podium-name">${p.name}</div>
                    <div class="podium-score">${p.score} pts</div>
                </div>
            </div>`;
    }).join('');

    const list = document.getElementById('admin-final-list');
    if (list) {
        list.innerHTML = ranking.map((p, i) => `
            <div class="ranking-item ${i < 3 ? 'top-' + (i + 1) : ''}">
                <div class="rank-position">#${i + 1}</div>
                <div class="rank-name">${p.name}</div>
                <div class="rank-score">${p.score} pts</div>
            </div>
        `).join('');
    }
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
