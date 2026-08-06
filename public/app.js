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
let playerAnswer = null; // Guarda a resposta do jogador
let showingRanking = false; // Flag para controlar exibição do ranking
let hasShownStartAnimation = false; // Flag para animação de início

const LETTERS = ['A', 'B', 'C', 'D'];

// Emojis para animações
const VEHICLE_EMOJIS = ['🚕', '🏍️', '🚗', '🛵', '🚙', '🏎️', '🚓', '🚑'];
const CAR_99 = '🚕';
const MOTO_99 = '🏍️';

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
        console.log('[pollGame] Response:', { status: data.status, role });
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

            // Se temos uma nova pergunta (número diferente ou ID diferente)
            if (isNewQuestion) {
                // Primeira pergunta? Mostrar animação de início!
                if (!hasShownStartAnimation && data.question.questionNumber === 1) {
                    playStartAnimation(currentGame.code, 'player').then(() => {
                        showingRanking = false;
                        currentQuestion = data.question;
                        hasAnsweredCurrent = false;
                        showScreen('game-screen');
                        renderPlayerQuestion(data.question);
                    });
                    return; // Não continuar - animação vai chamar o resto
                }

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

                // Quando o tempo acabou (timeLeft = 0)
                if (data.timeLeft === 0 && data.question.correctAnswer !== undefined && !showingRanking) {
                    // PASSO 1: Mostrar resposta correta/errada
                    showCorrectAnswer(data.question.correctAnswer);

                    // PASSO 2: Esperar 3 segundos e depois mostrar ranking
                    if (data.ranking) {
                        showingRanking = true;
                        setTimeout(() => {
                            showInterimRanking(data.ranking);
                        }, 3000); // 3 segundos para ver o resultado
                    }
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
    console.log('[handleGameUpdate] Admin check:', { role, status: data.status });
    if (role === 'admin' && data.status === 'playing') {
        console.log('[handleGameUpdate] Game is playing, switching to control screen');
        const isOnControl = document.getElementById('admin-game-control')?.classList.contains('active');
        console.log('[handleGameUpdate] Is on control screen:', isOnControl);
        if (!isOnControl) {
            console.log('[handleGameUpdate] Showing admin-game-control');
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

    // Atualizar avatares
    if (container) {
        container.innerHTML = (players || []).map(p =>
            `<div class="player-avatar" title="${p.name}">${p.name.charAt(0).toUpperCase()}</div>`
        ).join('');
    }

    // Animar grade de largada conforme jogadores entram
    updateStartingGrid(players);

    // Animar semáforo baseado no número de jogadores
    animateTrafficLight(count);
}

// Atualizar grade de largada de forma segura
function updateStartingGrid(players) {
    const gridContainer = document.getElementById('starting-grid');
    if (!gridContainer) return;

    const vehicles = ['🏎️', '🏍️', '🚕', '🚗', '🛵'];
    const playerCount = players?.length || 0;

    // Reconstruir a grade inteira
    let html = '';
    for (let i = 0; i < 5; i++) {
        const player = players?.[i];
        const isFilled = !!player;
        const avatar = isFilled ? player.name.charAt(0).toUpperCase() : vehicles[i];

        html += `
            <div class="grid-position ${isFilled ? 'filled' : ''}" style="
                animation: ${isFilled && !gridContainer.children[i]?.classList.contains('filled') ? 'grid_pop 0.5s ease-out' : 'none'};
            ">
                <span class="position-number">${i + 1}</span>
                <span class="avatar">${avatar}</span>
            </div>
        `;
    }

    gridContainer.innerHTML = html;
}

// Animar semáforo
let trafficLightInterval = null;
function animateTrafficLight(playerCount) {
    const red = document.getElementById('light-red');
    const yellow = document.getElementById('light-yellow');
    const green = document.getElementById('light-green');

    if (!red || !yellow || !green) return;

    // Limpar intervalo anterior se existir
    if (trafficLightInterval) {
        clearInterval(trafficLightInterval);
        trafficLightInterval = null;
    }

    // Reset
    [red, yellow, green].forEach(l => l.classList.remove('active'));

    if (playerCount === 0) {
        red.classList.add('active');
    } else if (playerCount < 3) {
        // Piscando amarelo - quase lá
        yellow.classList.add('active');
        red.classList.add('active');
    } else {
        // Verde! Pronto para começar
        green.classList.add('active');

        // Efeito de "calor do motor" com 3+ jogadores
        trafficLightInterval = setInterval(() => {
            if (!green.classList.contains('active')) {
                clearInterval(trafficLightInterval);
                trafficLightInterval = null;
                return;
            }
            // Piscar verde rapidinho
            green.style.opacity = Math.random() > 0.5 ? '1' : '0.7';
        }, 100);
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
    console.log('[showCorrectAnswer] Correct:', correctIndex, 'Player:', playerAnswer);

    const buttons = document.querySelectorAll('.option');
    buttons.forEach((btn, idx) => {
        btn.disabled = true;

        // Remove classe selecionada anterior
        btn.classList.remove('selected');

        if (idx === correctIndex) {
            // ✅ Alternativa CORRETA em VERDE
            btn.classList.add('correct');
        } else if (idx === playerAnswer && playerAnswer !== correctIndex) {
            // ❌ Alternativa ERRADA do jogador em VERMELHO
            btn.classList.add('wrong');
        }
    });

    // Reset para próxima pergunta
    playerAnswer = null;
}

async function submitAnswer(answerIndex) {
    if (!currentGame || !currentQuestion || hasAnsweredCurrent) return;

    hasAnsweredCurrent = true;
    playerAnswer = answerIndex; // Guarda a resposta do jogador
    console.log('[submitAnswer] Player answer stored:', answerIndex);

    // Desabilitar TODOS os botões para evitar múltiplas respostas
    const buttons = document.querySelectorAll('.option');
    buttons.forEach(btn => btn.disabled = true);

    // Marcar o botão clicado como selecionado (visível mas neutro)
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
        console.log('[submitAnswer] Response from server:', data);

        // NÃO mostrar feedback visual de correto/errado ainda
        // Só quando o tempo acabar (o polling vai chamar showCorrectAnswer)

    } catch (err) {
        console.error('[submitAnswer] Error:', err);
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

    // Animar carros na pista baseado no ranking
    animateRaceTrack(ranking);
}

// Animar carros na pista do ranking intermediário
function animateRaceTrack(ranking) {
    const maxScore = ranking[0]?.score || 1;
    const trackLength = 80; // 80% da largura

    const cars = ['mini-car-1', 'mini-car-2', 'mini-car-3'];
    const emojis = ['🚕', '🏍️', '🚗'];

    cars.forEach((carId, idx) => {
        const car = document.getElementById(carId);
        if (!car) return;

        const player = ranking[idx];
        if (player) {
            const progress = (player.score / maxScore) * trackLength;
            car.textContent = emojis[idx];
            car.style.left = (5 + progress) + '%';

            // Se for o primeiro colocado, adicionar efeito especial
            if (idx === 0) {
                car.style.filter = 'drop-shadow(0 0 10px #F5C500)';
                car.style.animation = 'leader_pulse 0.5s ease-in-out infinite alternate';
            }
        }
    });
}

// Adicionar keyframe para o carro líder
const style = document.createElement('style');
style.textContent = `
@keyframes leader_pulse {
    from { transform: scale(1); }
    to { transform: scale(1.1); }
}
`;
document.head.appendChild(style);

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
    // PRIMEIRO: Mostrar animação elaborada do pódio
    await playPodiumAnimation(ranking);

    // DEPOIS: Mostrar tela normal do pódio com cupom
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
    const gridContainer = document.getElementById('admin-starting-grid');

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

    // Atualizar grade de largada do admin
    if (gridContainer) {
        const vehicles = ['🏎️', '🏍️', '🚕', '🚗', '🛵', '🚙', '🏎️', '🏍️'];
        gridContainer.innerHTML = players.slice(0, 8).map((p, i) => `
            <div class="admin-grid-row" style="
                display: flex;
                align-items: center;
                gap: 15px;
                padding: 12px;
                background: ${i === 0 ? 'rgba(245,197,0,0.2)' : 'rgba(255,255,255,0.05)'};
                border-radius: 10px;
                border-left: 4px solid ${i === 0 ? '#F5C500' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#666'};
                animation: slide_in 0.5s ease-out ${i * 0.1}s both;
            ">
                <span style="font-weight: 900; color: ${i === 0 ? '#F5C500' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#666'}; font-size: 1.3rem;">P${i + 1}</span>
                <span style="font-size: 2rem;">${vehicles[i]}</span>
                <span style="color: #fff; flex: 1; font-weight: 600;">${p.name}</span>
                <span style="color: ${i === 0 ? '#F5C500' : '#666'}; font-size: 0.9rem;">${i === 0 ? '🏆 POLE' : ''}</span>
            </div>
        `).join('');

        // Adicionar vagas vazias se menos de 3 jogadores
        for (let i = players.length; i < 3; i++) {
            gridContainer.innerHTML += `
                <div class="admin-grid-row" style="
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    padding: 12px;
                    background: rgba(255,255,255,0.03);
                    border-radius: 10px;
                    border-left: 4px dashed #444;
                    opacity: 0.5;
                ">
                    <span style="font-weight: 900; color: #444; font-size: 1.3rem;">P${i + 1}</span>
                    <span style="font-size: 2rem; filter: grayscale(1);">🏎️</span>
                    <span style="color: #666; flex: 1; font-style: italic;">Empty slot...</span>
                </div>
            `;
        }
    }
}

// Adicionar keyframe para slide in
const adminStyle = document.createElement('style');
adminStyle.textContent = `
@keyframes slide_in {
    from {
        opacity: 0;
        transform: translateX(-50px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}
`;
document.head.appendChild(adminStyle);

async function startGame() {
    console.log('[startGame] ===========================');
    console.log('[startGame] Button clicked');
    console.log('[startGame] currentGame:', JSON.stringify(currentGame));
    console.log('[startGame] adminToken present:', !!adminToken);

    if (!currentGame?.code) {
        console.error('[startGame] ERROR: No currentGame.code!');
        alert('Nenhum jogo!');
        return;
    }

    const gameCode = currentGame.code;
    console.log('[startGame] Game code:', gameCode);

    try {
        console.log('[startGame] Sending POST to /api/game/start');
        const requestBody = { gameCode: gameCode };
        console.log('[startGame] Request body:', JSON.stringify(requestBody));

        const response = await fetch('/api/game/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify(requestBody)
        });

        console.log('[startGame] Response received');
        console.log('[startGame] Response status:', response.status);

        const data = await response.json();
        console.log('[startGame] Response data:', JSON.stringify(data));

        if (!response.ok) {
            console.error('[startGame] ERROR: Response not OK');
            alert(data.error || 'Erro ao iniciar');
            return;
        }

        console.log('[startGame] SUCCESS: Game started!');

    } catch (err) {
        console.error('[startGame] EXCEPTION:', err);
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

// ============================================
// ANIMAÇÕES ELABORADAS
// ============================================

// Animação de contagem regressiva no início do jogo
async function playStartAnimation(gameCode, role) {
    const overlay = document.getElementById('start-animation');
    const numberEl = document.getElementById('countdown-number');
    const textEl = document.getElementById('countdown-text');

    // PARAR o polling durante a animação
    stopPolling();

    overlay.classList.add('active');

    const messages = ['READY?', 'SET...', 'GO!'];
    const numbers = ['3', '2', '1', 'GO!'];

    // Motor roncando - tocar som aqui se tiver áudio

    for (let i = 0; i < 4; i++) {
        // Reset animation
        numberEl.style.animation = 'none';
        numberEl.offsetHeight; // Trigger reflow
        numberEl.style.animation = 'countdown_pop 1s ease-out';

        if (i < 3) {
            numberEl.textContent = numbers[i];
            textEl.textContent = messages[i] || '';

            // Adicionar carros acelerando
            addRacingCars(i);
        } else {
            // GO!
            numberEl.textContent = '';
            numberEl.style.fontSize = '12rem';
            textEl.innerHTML = '<div class="go-text">GO!</div>';

            // Efeito de zoom total
            createGoEffect();
        }

        await new Promise(r => setTimeout(r, 1000));
    }

    // Aguardar mais um pouco para o efeito do GO
    await new Promise(r => setTimeout(r, 800));

    overlay.classList.remove('active');
    hasShownStartAnimation = true;

    // RESTART do polling após a animação
    startPolling(gameCode, role);
}

// Adicionar carros correndo na animação de início
function addRacingCars(countdownIndex) {
    const container = document.querySelector('.racing-cars-animation');

    // Criar mais carros para cada número
    const cars = ['🚕', '🏍️', '🚗', '🛵', '🚙'];
    cars.forEach((car, i) => {
        const el = document.createElement('div');
        el.className = 'race-car';
        el.textContent = car;
        el.style.bottom = (10 + i * 8) + '%';
        el.style.left = (10 + i * 15) + '%';
        el.style.animationDuration = (0.8 + Math.random() * 0.4) + 's';
        el.style.animationDelay = (i * 0.05) + 's';
        el.style.fontSize = (3 + Math.random() * 2) + 'rem';

        container.appendChild(el);

        // Remover após animação
        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 1200);
    });
}

// Efeito especial do GO!
function createGoEffect() {
    const container = document.getElementById('start-animation');

    // Flash de luz verde
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle, rgba(0,255,0,0.3) 0%, transparent 70%);
        animation: fadeOut 0.5s ease-out forwards;
        pointer-events: none;
    `;
    container.appendChild(flash);

    setTimeout(() => flash.remove(), 500);
}

// ============================================
// ANIMAÇÃO DO PÓDIO FINAL
// ============================================

async function playPodiumAnimation(ranking) {
    const overlay = document.getElementById('podium-animation');
    const sparklesContainer = document.getElementById('sparkles-container');
    const podiumCarsContainer = document.getElementById('podium-cars-container');

    overlay.classList.add('active');

    // Criar faíscas
    createSparkles(sparklesContainer);

    // Criar carros celebrando no pódio
    createPodiumCars(podiumCarsContainer);

    // Criar confete
    createConfetti();

    // Criar fogos de artifício
    createFireworks();

    // Aguardar efeitos iniciais
    await new Promise(r => setTimeout(r, 500));

    // Renderizar o pódio com animação
    renderAnimatedPodium(ranking);

    // Continuar animações por 8 segundos
    await new Promise(r => setTimeout(r, 8000));

    // Limpar e voltar para a tela normal do pódio
    overlay.classList.remove('active');
    sparklesContainer.innerHTML = '';
    podiumCarsContainer.innerHTML = '';
    document.getElementById('confetti-container').innerHTML = '';
}

// Criar faíscas caindo
function createSparkles(container) {
    for (let i = 0; i < 30; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle';
        sparkle.style.left = (Math.random() * 100) + '%';
        sparkle.style.animationDelay = (Math.random() * 3) + 's';
        sparkle.style.animationDuration = (2 + Math.random() * 2) + 's';
        sparkle.style.background = `hsl(${40 + Math.random() * 20}, 100%, 50%)`;
        container.appendChild(sparkle);
    }
}

// Carros celebrando no pódio
function createPodiumCars(container) {
    const vehicles = ['🚕', '🏍️', '🚗', '🛵'];
    vehicles.forEach((v, i) => {
        const car = document.createElement('div');
        car.className = 'podium-car';
        car.textContent = v;
        car.style.left = (15 + i * 25) + '%';
        car.style.animationDelay = (i * 0.3) + 's';
        container.appendChild(car);

        // Adicionar fumaça
        setInterval(() => {
            if (!car.parentNode) return;
            const smoke = document.createElement('div');
            smoke.className = 'smoke';
            smoke.style.left = (parseInt(car.style.left) + 5) + '%';
            smoke.style.bottom = '5%';
            container.appendChild(smoke);
            setTimeout(() => smoke.remove(), 1000);
        }, 500 + i * 200);
    });
}

// Criar confete
function createConfetti() {
    const container = document.getElementById('confetti-container');

    for (let i = 0; i < 150; i++) {
        setTimeout(() => {
            if (!container) return;
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = (Math.random() * 100) + '%';
            confetti.style.animationDelay = (Math.random() * 2) + 's';
            confetti.style.animationDuration = (3 + Math.random() * 2) + 's';
            confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';

            // Cores 99
            const colors = ['#F5C500', '#FFD700', '#FFFFFF', '#FFA500', '#000000'];
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];

            // Tamanhos variados
            const size = 8 + Math.random() * 12;
            confetti.style.width = size + 'px';
            confetti.style.height = size + 'px';

            container.appendChild(confetti);

            setTimeout(() => confetti.remove(), 6000);
        }, i * 30);
    }
}

// Criar fogos de artifício
function createFireworks() {
    const overlay = document.getElementById('podium-animation');
    const colors = ['#F5C500', '#FFD700', '#FF6B6B', '#4ECDC4', '#FFFFFF'];

    const launchFirework = () => {
        const x = 10 + Math.random() * 80;
        const y = 20 + Math.random() * 40;
        const color = colors[Math.floor(Math.random() * colors.length)];

        // Ponto de explosão
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: absolute;
                width: 6px;
                height: 6px;
                background: ${color};
                border-radius: 50%;
                left: ${x}%;
                top: ${y}%;
                pointer-events: none;
            `;

            const angle = (Math.PI * 2 * i) / 20;
            const velocity = 100 + Math.random() * 100;

            particle.animate([
                { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                { transform: `translate(${Math.cos(angle) * velocity}px, ${Math.sin(angle) * velocity}px) scale(0)`, opacity: 0 }
            ], {
                duration: 1000,
                easing: 'ease-out'
            });

            overlay.appendChild(particle);
            setTimeout(() => particle.remove(), 1000);
        }
    };

    // Lançar múltiplos fogos
    for (let i = 0; i < 8; i++) {
        setTimeout(launchFirework, i * 800);
    }
}

// Renderizar pódio animado
function renderAnimatedPodium(ranking) {
    const overlay = document.getElementById('podium-animation');

    // Criar container do pódio
    const podiumDiv = document.createElement('div');
    podiumDiv.className = 'podium-enhanced';

    const medals = ['🥈', '🥇', '🥉'];
    const classes = ['second', 'first', 'third'];
    const top3 = ranking.slice(0, 3);

    // Ordem: 2º, 1º, 3º
    const order = [1, 0, 2];

    order.forEach((pos, idx) => {
        const player = top3[pos];
        if (!player) return;

        const place = document.createElement('div');
        place.className = 'podium-place-enhanced';

        place.innerHTML = `
            <div class="podium-avatar-enhanced ${classes[idx]}">
                ${medals[idx]}
            </div>
            <div class="podium-block-enhanced ${classes[idx]}">
                <div class="podium-name-enhanced">${escapeHtml(player.name)}</div>
                <div class="podium-score-enhanced">${player.score} pts</div>
                <div class="podium-rank-number">${pos + 1}</div>
            </div>
        `;

        podiumDiv.appendChild(place);
    });

    // Mensagem de vitória
    const victoryMsg = document.createElement('div');
    victoryMsg.className = 'victory-message';
    victoryMsg.innerHTML = '<h2>🏆 RACE FINISHED! 🏆</h2>';

    // Container central
    const content = document.createElement('div');
    content.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        z-index: 10;
    `;

    content.appendChild(victoryMsg);
    content.appendChild(podiumDiv);

    overlay.appendChild(content);

    // Remover após a animação
    setTimeout(() => {
        if (content.parentNode) content.parentNode.removeChild(content);
    }, 8000);
}

// Helper para escapar HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
