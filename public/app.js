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
let questionsList = []; // Lista temporária para criquiz

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
// POLLING - Atualizações do Jogo
// ============================================
function startPolling(gameCode, role) {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/game/poll?gameCode=${gameCode}`);
            if (!response) return;
            if (response.status === 304) return; // Not modified
            if (!response) return;

            const data = await response.json();
            handleGame(data, role);
        } catch (err) {
            console.log('Poll error (normal if 304):');
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
// MANIPULAÇÃO DO ESTADO DO JOGO
// ============================================
function handleGame(data, role) {
    // Debug - remover depois
    console.log('[handleGame]', { role, status: data.status, currentQuestion: data.currentQuestion });

    // JOGADOR - Tela de espera → Jogo iniciou
    if (role === 'player' && data.status === 'playing') {
        if (data.question && currentQuestion?.id !== data.question.id) {
            currentQuestion = data.question;
            showScreen('game-screen');
            showPlayerQuestion(data.question, data.timeLeft);
        }
        updatePlayerTimer(data.timeLeft);
    }

    // JOGADOR - Atualizar lista de jogadores na tela de espera
    if (role === 'player' && data.status === 'waiting' && data.players) {
        updateWaitingPlayers(data.players);
    }

    // ADMIN - Sala de espera → Atualizar jogadores
    if (role === 'admin' && data.status === 'waiting' && document.getElementById('admin-waiting-room')?.classList.contains('active')) {
        updateAdminWaitingPlayers(data.players);
    }

    // ADMIN - Jogo iniciou → Ir para tela de controle
    if (role === 'admin' && data.status === 'playing' && !document.getElementById('admin-game-control')?.classList.contains('active')) {
        showScreen('admin-game-control');
        startPolling(currentGame.code, 'admin');
    }

    // ADMIN - Atualizar pergunta atual
    if (role === 'admin' && data.status === 'playing' && data.question) {
        updateAdminQuestion(data);
    }

    // Ambos - Jogo terminou
    if (data.status === 'finished' && data.ranking) {
        stopPolling();
        if (role === 'player') {
            showPlayerResults(data.ranking);
        } else {
            showAdminFinalResults(data.ranking);
        }
    }

    // Atualizar timer
    if (data.timeLeft !== undefined) {
        updateTimerDisplay(data.timeLeft);
    }
}

// ============================================
// JOGADOR - Entrar no Jogo
// ============================================
async functionjoinGame() {
    const name = document.getElementById('player-name').value.trim();
    const email = document.getElementById('player-email').value.trim();
    const gameCode = document.getElementById('game-code').value.trim().toUpperCase();

    if (!name || !email || !gameCode) {
        alert('⚠️ Please fill in all fields!');
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
            alert(data.error || '❌ Error joining game');
            return;
        }

        currentPlayer = { id: data.playerId, name, email };
        currentGame = { code: gameCode };

        showScreen('waiting-screen');
        startPolling(gameCode, 'player');

    } catch (err) {
        alert('❌ Error joining game: ' + err.message);
    }
}

functionupdateWaitingPlayers(players) {
    document.getElementById('waiting-players').textContent = `Players: ${players.length}`;
    const container = document.getElementById('players-avatars');
    container.innerHTML = players.map(p =>
        `<div class="player-avatar" title="${p.name}">${p.name.charAt(0).toUpperCase()}</div>`
    ).join('');
}

// ============================================
// JOGADOR - Mostrar Pergunta
// ============================================
functionshowPlayerQuestion(question, timeLeft) {
    document.getElementById('current-q').textContent = question.questionNumber;
    document.getElementById('total-q').textContent = question.totalQuestions;
    document.getElementById('question-text').textContent = question.text;
    document.getElementById('timer-text').textContent = timeLeft || question.time;
    document.getElementById('timer-bar').style.width = '100%';

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

    // Guardar tempo de início
    currentQuestion.startTime = Date.now();
}

functionupdatePlayerTimer(timeLeft) {
    if (timeLeft === undefined) return;
    document.getElementById('timer-text').textContent = timeLeft;
    const maxTime = currentQuestion?.time || 30;
    const percentage = (timeLeft / maxTime) * 100;
    document.getElementById('timer-bar').style.width = percentage + '%';
}

functionupdateTimerDisplay(timeLeft) {
    // Placeholder para updates gerais de timer
}

// ============================================
// JOGADOR - Enviar Resposta
// ============================================
async functionsubmitAnswer(answerIndex) {
    if (!currentGame || !currentQuestion) return;

    // Desabilitar todos os botões
    document.querySelectorAll('.option').forEach(btn => {
        btn.disabled = true;
    });

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

        // Mostrar feedback visual
        const buttons = document.querySelectorAll('.option');
        buttons.forEach((btn, idx) => {
            btn.classList.remove('selected');
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
// JOGADOR - Mostrar Resultados
// ============================================
functionshowPlayerResults(ranking) {
    showScreen('podium-screen');

    const podium = document.getElementById('podium-container');
    const top3 = ranking.slice(0, 3);
    const positions = [1, 0, 2]; // 2º, 1º, 3º para visual

    podium.innerHTML = positions.map(pos => {
        const player = top3[pos];
        if (!player) return '';
        const placeClass = pos === 0 ? 'second' : pos === 1 ? 'first' : 'third';
        const avatarClass = pos === 1 ? 'first' : '';
        const medal = pos === 1 ? '🥇' : pos === 0 ? '🥈' : '🥉';

        return `
            <div class="podium-place">
                <div class="podium-avatar ${avatarClass}">${medal}</div>
                <div class="podium-block ${placeClass}">
                    <div class="podium-name">${player.name}</div>
                    <div class="podium-score">${player.score} pts</div>
                </div>
            </div>
        `;
    }).join('');

    // Mostrar cupom (placeholder)
    document.getElementById('coupon-section').style.display = 'block';
}

// ============================================
// ADMIN - Login
// ============================================
async functionadminLogin() {
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;

    if (!email || !password) {
        alert('⚠️ Please fill in all fields!');
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
            alert('❌ Invalid credentials!');
            return;
        }

        adminToken = data.token;
        localStorage.setItem('adminToken', adminToken);

        // Resetar lista de perguntas
        questionsList = [];
        updateQuestionsList();

        showScreen('admin-dashboard');

    } catch (err) {
        alert('❌ Login error: ' + err.message);
    }
}

functionlogoutAdmin() {
    adminToken = null;
    localStorage.removeItem('adminToken');
    currentGame = null;
    questionsList = [];
    stopPolling();
    updateQuestionsList();
    showScreen('home-screen');
}

// ============================================
// ADMIN - Criar Perguntas (Visual)
// ============================================
functionaddQuestion() {
    const text = document.getElementById('new-question-text').value.trim();
    const option0 = document.getElementById('option-0').value.trim();
    const option1 = document.getElementById('option-1').value.trim();
    const option2 = document.getElementById('option-2').value.trim();
    const option3 = document.getElementById('option-3').value.trim();

    const options = [option0, option1, option2, option3];
    const correctAnswer = parseInt(document.querySelector('input[name="correct-answer"]:checked')?.value || '0');
    const time = parseInt(document.getElementById('question-time').value);

    if (!text) {
        alert('⚠️ Please enter a question!');
        return;
    }

    if (options.some(o => !o)) {
        alert('⚠️ Please fill in all 4 options!');
        return;
    }

    questionsList.push({
        text,
        options,
        correctAnswer,
        time
    });

    // Limpar formulário
    document.getElementById('new-question-text').value = '';
    document.getElementById('option-0').value = '';
    document.getElementById('option-1').value = '';
    document.getElementById('option-2').value = '';
    document.getElementById('option-3').value = '';
    document.querySelector('input[name="correct-answer"][value="0"]').checked = true;
    document.getElementById('question-time').value = 30;
    document.getElementById('time-display').textContent = '30s';

    updateQuestionsList();
}

functionremoveQuestion(index) {
    questionsList.splice(index, 1);
    updateQuestionsList();
}

functionupdateQuestionsList() {
    const container = document.getElementById('questions-list');
    const createBtn = document.getElementById('create-game-btn');
    const errorMsg = document.getElementById('create-game-error');

    // Habilitar/desabilitar botão de criar
    if (questionsList.length === 0) {
        createBtn.disabled = true;
        errorMsg.style.display = 'block';
    } else {
        createBtn.disabled = false;
        errorMsg.style.display = 'none';
    }

    // Mostrar perguntas
    if (questionsList.length === 0) {
        container.innerHTML = `
            <div class="empty-questions">
                <div class="empty-questions-icon">📝</div>
                <p>No questions yet. Add your first question below!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = questionsList.map((q, index) => `
        <div class="question-item">
            <div class="question-header">
                <span class="question-number">Question ${index + 1}</span>
                <div class="question-actions">
                    <button class="btn btn-danger btn-small" onclick="removeQuestion(${index})">🗑️ Remove</button>
                </div>
            </div>
            <p style="color:#000; margin-bottom:10px; font-weight:600;">${q.text}</p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                ${q.options.map((opt, i) => `
                    <div style="padding:10px; background:${i === q.correctAnswer ? '#d4edda' : '#f5f5f5'};
                                border:2px solid ${i === q.correctAnswer ? '#28a745' : '#ddd'};
                                border-radius:8px; color:#000; font-size:0.9rem;">
                        ${LETTERS[i]}. ${opt} ${i === q.correctAnswer ? '✅' : ''}
                    </div>
                `).join('')}
            </div>
            <p style="color:#666; font-size:0.9rem;">⏱️ ${q.time} seconds</p>
        </div>
    `).join('');
}

// ============================================
// ADMIN - Criar Jogo
// ============================================
async functioncreateGame() {
    const title = document.getElementById('quiz-title').value.trim();

    if (!title) {
        alert('⚠️ Please enter a quiz title!');
        return;
    }

    if (questionsList.length === 0) {
        alert('⚠️ Add at least 1 question!');
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
            alert(data.error || '❌ Error creating game');
            return;
        }

        currentGame = { code: data.gameCode, title };

        // Mostrar código na tela de espera
        document.getElementById('admin-game-code').textContent = data.gameCode;

        showScreen('admin-waiting-room');
        startPolling(data.gameCode, 'admin');

    } catch (err) {
        alert('❌ Error creating game: ' + err.message);
    }
}

functionupdateAdminWaitingPlayers(players) {
    const countEl = document.getElementById('admin-player-count');
    const container = document.getElementById('admin-waiting-players');
    const noMsg = document.getElementById('no-players-msg');

    if (countEl) countEl.textContent = players?.length || 0;

    if (!container) return;

    if (!players || players.length === 0) {
        container.innerHTML = '';
        if (noMsg) noMsg.style.display = 'block';
        return;
    }

    if (noMsg) noMsg.style.display = 'none';
    container.innerHTML = players.map(p =>
        `<div class="player-avatar" title="${p.name}">${p.name.charAt(0).toUpperCase()}</div>`
    ).join('');
}

// ============================================
// ADMIN - Iniciar Jogo
// ============================================
async functionstartGame() {
    if (!currentGame?.code) {
        alert('⚠️ No game found!');
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
            alert(data.error || '❌ Error starting game');
            return;
        }

        // Tela de controle será mostrada pelo polling

    } catch (err) {
        alert('❌ Error starting game: ' + err.message);
    }
}

// ============================================
// ADMIN - Tela de Controle do Jogo
// ============================================
functionupdateAdminQuestion(data) {
    const question = data.question;
    if (!question) return;

    // Atualizar progresso
    document.getElementById('admin-current-q').textContent = question.questionNumber;
    document.getElementById('admin-timer').textContent = (data.timeLeft || question.time) + 's';
    document.getElementById('admin-q-progress').textContent = `Question ${question.questionNumber} of ${question.totalQuestions}`;

    // Texto da pergunta
    document.getElementById('admin-question-text').textContent = question.text;

    // Opções destacando a correta
    const optionsContainer = document.getElementById('admin-options-display');
    optionsContainer.innerHTML = question.options.map((opt, idx) => `
        <div class="admin-option ${idx === question.correctAnswer ? 'correct' : ''}">
            <div class="admin-option-letter">${LETTERS[idx]}</div>
            <span style="color:#000; font-weight:600;">${opt}</span>
        </div>
    `).join('');

    // Mostrar resposta correta em texto
    document.getElementById('admin-correct-ans').textContent = `${LETTERS[question.correctAnswer]} - ${question.options[question.correctAnswer]}`;

    // Atualizar contagem de respostas
    const answers = data.answers || {};
    const currentAnswers = answers[data.currentQuestion] || {};
    const answeredCount = Object.keys(currentAnswers).length;
    document.getElementById('admin-answered-count').textContent = `${answeredCount}/${data.playerCount}`;
}

functionadminNextQuestion() {
    // Placeholder - o timer automático já avança as perguntas
    // Podemos adicionar funcionalidade de pular manualmente depois
}

// ============================================
// ADMIN - Resultados Finais
// ============================================
functionshowAdminFinalResults(ranking) {
    showScreen('admin-final-ranking');

    // Pódio
    const podium = document.getElementById('admin-podium');
    const top3 = ranking.slice(0, 3);
    const positions = [1, 0, 2];

    podium.innerHTML = positions.map(pos => {
        const player = top3[pos];
        if (!player) return '';
        const placeClass = pos === 0 ? 'second' : pos === 1 ? 'first' : 'third';
        const avatarClass = pos === 1 ? 'first' : '';
        const medal = pos === 1 ? '🥇' : pos === 0 ? '🥈' : '🥉';

        return `
            <div class="podium-place">
                <div class="podium-avatar ${avatarClass}">${medal}</div>
                <div class="podium-block ${placeClass}">
                    <div class="podium-name">${player.name}</div>
                    <div class="podium-score">${player.score} pts</div>
                </div>
            </div>
        `;
    }).join('');

    // Lista completa
    const list = document.getElementById('admin-final-list');
    list.innerHTML = ranking.map((p, i) => `
        <div class="ranking-item ${i < 3 ? 'top-' + (i + 1) : ''}">
            <div class="rank-position">#${i + 1}</div>
            <div class="rank-name">${p.name}</div>
            <div class="rank-score">${p.score} pts</div>
        </div>
    `).join('');
}

functionadminBackToDashboard() {
    currentGame = null;
    questionsList = [];
    updateQuestionsList();
    showScreen('admin-dashboard');
}

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Restaurar token do admin se existir
    const savedToken = localStorage.getItem('adminToken');
    if (savedToken) {
        adminToken = savedToken;
    }
});
