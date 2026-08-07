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
                // Verificar se é primeira pergunta e ainda não mostramos a animação
                if (data.question.questionNumber === 1 && !hasShownStartAnimation) {
                    console.log('[handleGameUpdate] Primeira pergunta - iniciando animação!');
                    // Primeira pergunta - mostrar animação de countdown
                    playStartAnimation(currentGame.code, 'player');
                    // Não mostrar a tela de jogo ainda - continuar na animação/espera
                    return;
                }

                showingRanking = false; // Resetar flag
                currentQuestion = data.question;
                hasAnsweredCurrent = false;
                console.log('[handleGameUpdate] Mostrando tela do jogo, pergunta:', data.question.questionNumber);
                showScreen('game-screen');
                renderPlayerQuestion(data.question);
            }

            // Se estiver na tela de jogo, atualizar timer
            const isOnGameScreen = document.getElementById('game-screen')?.classList.contains('active');
            if (isOnGameScreen && isSameQuestion) {
                updatePlayerTimer(data.timeLeft, data.question.time);

                // Quando o tempo acabou (timeLeft = 0)
                if (data.timeLeft === 0 && data.question.correctAnswer !== undefined && !showingRanking) {
                    // PASSO 1: Mostrar resposta correta/errada na tela do jogo
                    showCorrectAnswer(data.question.correctAnswer);

                    // PASSO 2: Esperar 3 segundos e depois mostrar ranking com resposta
                    if (data.ranking) {
                        showingRanking = true;

                        // Verificar se o jogador acertou
                        const myAnswer = data.question.myAnswer; // Se o backend enviar
                        const wasCorrect = playerAnswer === data.question.correctAnswer;

                        // Calcular pontos ganhos (se tiver na resposta)
                        let pointsEarned = 0;
                        if (wasCorrect && data.answers) {
                            const qIndex = data.currentQuestion;
                            const myAnswerData = data.answers[qIndex]?.[currentPlayer?.id];
                            pointsEarned = myAnswerData?.points || 0;
                        }

                        setTimeout(() => {
                            showInterimRanking(
                                data.ranking,
                                data.question,
                                data.question.correctAnswer,
                                wasCorrect,
                                pointsEarned
                            );
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
        // Verificar se é primeira pergunta e timer ainda não começou
        if (data.question?.questionNumber === 1 && data.timerNotStarted && !hasShownStartAnimation) {
            // Mostrar animação de countdown
            playStartAnimation(currentGame.code, 'admin');
            return; // Não mostrar tela de jogo ainda
        }

        // Verificar se o tempo acabou e precisamos mostrar o ranking intermediário
        if (data.timeLeft === 0 && data.ranking && data.question) {
            const isOnInterim = document.getElementById('admin-interim-ranking')?.classList.contains('active');
            if (!isOnInterim) {
                console.log('[handleGameUpdate] Tempo acabou - mostrando ranking intermediário');
                showAdminInterimRanking(data);
                return;
            }
        }

        console.log('[handleGameUpdate] Game is playing, switching to control screen');
        const isOnControl = document.getElementById('admin-game-control')?.classList.contains('active');
        const isOnInterim = document.getElementById('admin-interim-ranking')?.classList.contains('active');
        console.log('[handleGameUpdate] Is on control screen:', isOnControl);

        // Só mudar para tela de controle se não estiver no ranking intermediário
        if (!isOnControl && !isOnInterim) {
            console.log('[handleGameUpdate] Showing admin-game-control');
            showScreen('admin-game-control');
        }

        // Atualizar apenas se estiver na tela de controle
        if (isOnControl) {
            updateAdminGameView(data);
        }
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
function showInterimRanking(ranking, question, correctAnswer, wasCorrect, pointsEarned) {
    const myRank = ranking.findIndex(p => p.id === currentPlayer?.id) + 1;
    const myScore = ranking.find(p => p.id === currentPlayer?.id)?.score || 0;
    const top5 = ranking.slice(0, 5);

    // Mostrar pergunta e resposta
    const questionTextEl = document.getElementById('interim-question-text');
    const correctAnswerEl = document.getElementById('interim-correct-answer');
    const playerResultEl = document.getElementById('interim-player-result');

    if (questionTextEl && question) {
        questionTextEl.textContent = question.text;
    }

    if (correctAnswerEl && question && correctAnswer !== undefined) {
        const letter = LETTERS[correctAnswer];
        const text = question.options[correctAnswer];
        correctAnswerEl.innerHTML = `<span style="font-size: 1.5rem;">${letter}</span> - ${text}`;
    }

    if (playerResultEl) {
        if (wasCorrect) {
            playerResultEl.innerHTML = `🎉 <span style="color: #28a745;">Você acertou! +${pointsEarned} pontos</span>`;
        } else if (playerAnswer !== null) {
            const wrongLetter = LETTERS[playerAnswer];
            playerResultEl.innerHTML = `❌ <span style="color: #dc3545;">Você respondeu ${wrongLetter} (errado)</span>`;
        } else {
            playerResultEl.innerHTML = `⏱️ <span style="color: #666;">Tempo esgotado - sem resposta</span>`;
        }
    }

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

    if (!currentGame?.code) {
        alert('Nenhum jogo!');
        return;
    }

    const gameCode = currentGame.code;

    // 1. Chamar API imediatamente com delay de 4.5s para animação
    try {
        const response = await fetch('/api/game/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ gameCode: gameCode })
        });

        if (!response.ok) {
            const data = await response.json();
            alert(data.error || 'Erro ao iniciar');
            return;
        }

        console.log('[startGame] API chamada - jogo iniciado com delay');

        // 2. Mostrar animação para o admin (mesma dos players)
        // Admin vai ficar na animação junto com os players
        playStartAnimation(gameCode, 'admin');

    } catch (err) {
        console.error('[startGame] Erro:', err);
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

// Mostrar ranking intermediário para o admin (quando tempo acaba)
function showAdminInterimRanking(data) {
    const ranking = data.ranking || [];
    const question = data.question;
    const isLastQuestion = question.questionNumber === question.totalQuestions;

    console.log('[showAdminInterimRanking] Mostrando ranking para pergunta', question.questionNumber);

    // Atualizar número da pergunta
    document.getElementById('admin-interim-q-num').textContent = question.questionNumber;

    // Mostrar resposta correta
    const correctLetter = LETTERS[question.correctAnswer];
    const correctText = question.options[question.correctAnswer];
    document.getElementById('admin-interim-correct-answer').innerHTML =
        `<span style="font-size: 1.8rem;">${correctLetter}</span> - ${correctText}`;

    // Mostrar lista de jogadores
    const listContainer = document.getElementById('admin-interim-ranking-list');
    listContainer.innerHTML = ranking.map((p, i) => `
        <div class="ranking-item ${i < 3 ? 'top-' + (i + 1) : ''}">
            <div class="rank-position">#${i + 1}</div>
            <div class="rank-name">${p.name}</div>
            <div class="rank-score">${p.score} pts</div>
        </div>
    `).join('');

    // Mostrar mensagem de última pergunta se for o caso
    const nextBtn = document.getElementById('admin-next-q-btn');
    const lastMsg = document.getElementById('admin-last-q-msg');

    if (isLastQuestion) {
        nextBtn.textContent = '🏁 Ver Resultados Finais';
        nextBtn.style.background = '#28a745';
        lastMsg.style.display = 'block';
    } else {
        nextBtn.textContent = '▶️ Próxima Pergunta';
        nextBtn.style.background = '';
        lastMsg.style.display = 'none';
    }

    // Mostrar a tela
    showScreen('admin-interim-ranking');
}

// Admin avança para próxima pergunta manualmente
async function adminNextQuestionManual() {
    if (!currentGame?.code) return;

    console.log('[adminNextQuestionManual] Admin clicou para próxima pergunta');

    // Desabilitar o botão temporariamente
    const btn = document.getElementById('admin-next-q-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Carregando...';
    }

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
            if (btn) {
                btn.disabled = false;
                btn.textContent = '▶️ Próxima Pergunta';
            }
            return;
        }

        if (data.status === 'finished') {
            // Jogo terminou, o polling vai pegar isso
            console.log('[adminNextQuestionManual] Jogo finalizado');
            return;
        }

        // Voltar para tela de controle
        console.log('[adminNextQuestionManual] Avançando para próxima pergunta');
        showScreen('admin-game-control');

        // Reabilitar botão após um momento
        if (btn) {
            btn.disabled = false;
            btn.textContent = '▶️ Próxima Pergunta';
        }

    } catch (err) {
        alert('Erro: ' + err.message);
        if (btn) {
            btn.disabled = false;
            btn.textContent = '▶️ Próxima Pergunta';
        }
    }
}

// Função antiga - mantida para compatibilidade (não é mais usada diretamente)
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
    console.log('[playStartAnimation] Iniciando animação para:', role);

    const overlay = document.getElementById('start-animation');
    const numberEl = document.getElementById('countdown-number');
    const textEl = document.getElementById('countdown-text');
    const racingContainer = document.getElementById('racing-cars-container');

    if (!overlay || !numberEl || !textEl) {
        console.error('[playStartAnimation] Elementos não encontrados!');
        hasShownStartAnimation = true;
        return;
    }

    // Reset do estado da animação
    hasShownStartAnimation = false;

    // Limpar carros anteriores
    if (racingContainer) {
        racingContainer.innerHTML = '';
    }

    // Resetar estilos
    numberEl.style.fontSize = '';
    numberEl.style.display = 'block';

    // Mostrar overlay
    overlay.classList.add('active');
    console.log('[playStartAnimation] Overlay ativado');

    // Textos em português
    const messages = ['PREPARAR?', 'AJUSTAR...', 'VAI!'];
    const numbers = ['3', '2', '1'];

    // CONTAGEM 3-2-1
    for (let i = 0; i < 3; i++) {
        console.log(`[playStartAnimation] Contagem: ${numbers[i]}`);

        // Reset animation - forçar reflow
        numberEl.style.animation = 'none';
        void numberEl.offsetWidth; // Trigger reflow
        numberEl.style.animation = 'countdown_pop 0.8s ease-out';

        numberEl.textContent = numbers[i];
        textEl.textContent = messages[i];

        // Adicionar carros correndo
        addRacingCars(i);

        // Aguardar 1 segundo entre cada número
        await new Promise(r => setTimeout(r, 1000));
    }

    // GO! / VAI!
    console.log('[playStartAnimation] GO!');

    // Efeito especial do GO
    numberEl.style.display = 'none';
    textEl.innerHTML = '<div class="go-text">VAI!</div>';

    // Criar efeito de flash verde
    createGoEffect();

    // Adicionar carros extras no GO
    addRacingCars(3);

    // Aguardar o efeito do GO
    await new Promise(r => setTimeout(r, 1200));

    // Esconder overlay
    overlay.classList.remove('active');
    console.log('[playStartAnimation] Overlay escondido');

    // Reset elementos para próxima vez
    numberEl.style.display = 'block';
    numberEl.textContent = '3';
    textEl.textContent = 'PREPARAR?';

    hasShownStartAnimation = true;
    console.log('[playStartAnimation] Animação completa!');
}

// Adicionar carros 99 correndo na animação de início
function addRacingCars(countdownIndex) {
    const container = document.getElementById('racing-cars-container');
    if (!container) return;

    console.log('[addRacingCars] Adicionando carros 99 para contagem:', countdownIndex);

    // Imagens dos carros 99
    const carImages = [
        'car-pop.png',
        'car-taxi.png',
        'car-comfort.png',
        'car-eyeball.png'
    ];

    // Número de carros baseado na contagem
    const carCount = countdownIndex === 3 ? 5 : 2 + countdownIndex; // GO! tem mais carros

    for (let i = 0; i < carCount; i++) {
        const carImg = carImages[i % carImages.length];
        const img = document.createElement('img');
        img.src = carImg;
        img.className = 'race-car-99';
        img.alt = '';

        // Posições variadas
        const bottomPos = 25 + (i * 12) + (Math.random() * 8);
        const delay = i * 0.15;
        const duration = 2 + Math.random() * 0.5;

        img.style.cssText = `
            position: absolute;
            bottom: ${bottomPos}%;
            left: -200px;
            width: 140px;
            animation: race_start_99 ${duration}s ease-out forwards;
            animation-delay: ${delay}s;
            filter: drop-shadow(0 8px 20px rgba(0,0,0,0.6));
            z-index: 5;
        `;

        // Se imagem falhar, não mostrar nada
        img.onerror = () => {
            if (img.parentNode) img.parentNode.removeChild(img);
        };

        container.appendChild(img);

        // Remover após animação completar
        setTimeout(() => {
            if (img && img.parentNode) {
                img.parentNode.removeChild(img);
            }
        }, (duration + delay) * 1000 + 200);
    }

    console.log(`[addRacingCars] ${carCount} carros 99 adicionados`);
}

// Efeito especial do GO!
function createGoEffect() {
    const container = document.getElementById('start-animation');
    if (!container) return;

    console.log('[createGoEffect] Criando efeito GO!');

    // Flash de luz verde forte
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle, rgba(0,255,0,0.5) 0%, rgba(0,255,0,0.2) 40%, transparent 70%);
        animation: fadeOut 0.8s ease-out forwards;
        pointer-events: none;
        z-index: 100;
    `;
    container.appendChild(flash);

    // Ondas de choque
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            const shockwave = document.createElement('div');
            shockwave.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 50px;
                height: 50px;
                border: 4px solid #00FF00;
                border-radius: 50%;
                animation: shockwave_expand 1s ease-out forwards;
                pointer-events: none;
                z-index: 99;
            `;
            container.appendChild(shockwave);
            setTimeout(() => shockwave.remove(), 1000);
        }, i * 200);
    }

    // Partículas de celebração
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const particle = document.createElement('div');
            const angle = (Math.PI * 2 * i) / 20;
            const distance = 100 + Math.random() * 100;

            particle.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                width: 8px;
                height: 8px;
                background: ${Math.random() > 0.5 ? '#00FF00' : '#F5C500'};
                border-radius: 50%;
                animation: particle_burst 0.8s ease-out forwards;
                pointer-events: none;
                z-index: 98;
                --angle: ${angle}rad;
                --distance: ${distance}px;
            `;
            container.appendChild(particle);
            setTimeout(() => particle.remove(), 800);
        }, i * 30);
    }

    // Adicionar keyframes se não existirem
    if (!document.getElementById('go-effect-styles')) {
        const style = document.createElement('style');
        style.id = 'go-effect-styles';
        style.textContent = `
            @keyframes fadeOut {
                0% { opacity: 1; }
                100% { opacity: 0; }
            }
            @keyframes shockwave_expand {
                0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(15); opacity: 0; }
            }
            @keyframes particle_burst {
                0% {
                    transform: translate(-50%, -50%) scale(1);
                    opacity: 1;
                }
                100% {
                    transform: translate(
                        calc(-50% + cos(var(--angle)) * var(--distance)),
                        calc(-50% + sin(var(--angle)) * var(--distance))
                    ) scale(0);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => flash.remove(), 800);
}

// ============================================
// ANIMAÇÃO DO PÓDIO FINAL
// ============================================

async function playPodiumAnimation(ranking) {
    console.log('[playPodiumAnimation] Iniciando animação do pódio com carros 99');

    const overlay = document.getElementById('podium-animation');
    const sparklesContainer = document.getElementById('sparkles-container');
    const podiumCarsContainer = document.getElementById('podium-cars-container');
    const floatingContainer = document.getElementById('podium-floating-cars');

    if (!overlay) {
        console.error('[playPodiumAnimation] Overlay não encontrado');
        return;
    }

    overlay.classList.add('active');

    // Criar faíscas
    if (sparklesContainer) createSparkles(sparklesContainer);

    // Criar estrelas de celebração
    createPodiumStars();

    // Criar carros 99 celebrando no pódio (agora com imagens reais!)
    if (podiumCarsContainer) createPodiumCars(podiumCarsContainer);

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
    if (sparklesContainer) sparklesContainer.innerHTML = '';
    if (podiumCarsContainer) podiumCarsContainer.innerHTML = '';
    if (floatingContainer) floatingContainer.innerHTML = '';
    const confettiContainer = document.getElementById('confetti-container');
    if (confettiContainer) confettiContainer.innerHTML = '';
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

// Criar carros 99 flutuantes na animação do pódio
function createPodiumCars(container) {
    console.log('[createPodiumCars] Criando carros 99 flutuantes');

    // Container para carros flutuantes
    const floatingContainer = document.getElementById('podium-floating-cars');
    if (!floatingContainer) {
        console.error('[createPodiumCars] Container não encontrado');
        return;
    }

    floatingContainer.innerHTML = ''; // Limpar anteriores

    // Array com os carros 99 e suas classes
    const cars99 = [
        { src: 'car-pop.png', class: 'pop', alt: '99 Pop' },
        { src: 'car-taxi.png', class: 'taxi', alt: '99 Taxi' },
        { src: 'car-comfort.png', class: 'comfort', alt: '99 Comfort' },
        { src: 'car-eyeball.png', class: 'eyeball', alt: '99 Empresas' }
    ];

    cars99.forEach((car, i) => {
        const img = document.createElement('img');
        img.src = car.src;
        img.alt = car.alt;
        img.className = `floating-car-99 ${car.class}`;

        // Forçar carregamento com timestamp para evitar cache
        img.src = `${car.src}?v=${Date.now()}`;

        // Evento quando imagem carrega
        img.onload = () => {
            console.log(`[createPodiumCars] Carro carregado: ${car.alt}`);
        };

        // Se imagem falhar, não mostrar nada (sem fallback de emoji)
        img.onerror = () => {
            console.log(`[createPodiumCars] Erro ao carregar: ${car.src}`);
            img.style.display = 'none';
        };

        floatingContainer.appendChild(img);
    });

    console.log('[createPodiumCars] Carros 99 adicionados ao pódio');
}

// Criar elementos de apoio em cenários específicos
function addTemplateElementsToScreen(screenId) {
    const screen = document.getElementById(screenId);
    if (!screen) return;

    // Verificar se já tem elementos
    if (screen.querySelector('.template-element-visible')) return;

    // Elementos disponíveis
    const elements = [
        { src: 'elemento-99-1.png', style: 'top: 5%; right: 3%; width: 250px;' },
        { src: 'elemento-99-2.png', style: 'bottom: 10%; left: 2%; width: 200px;' },
        { src: 'elemento-99-3.png', style: 'top: 20%; right: 5%; width: 180px;' },
        { src: 'elemento-99-4.png', style: 'bottom: 15%; left: 4%; width: 220px;' }
    ];

    // Adicionar 2 elementos aleatórios
    const shuffled = elements.sort(() => 0.5 - Math.random());
    shuffled.slice(0, 2).forEach(el => {
        const img = document.createElement('img');
        img.src = el.src;
        img.className = 'template-element-visible';
        img.style.cssText = el.style;
        img.alt = '';
        img.onerror = () => { if (img.parentNode) img.parentNode.removeChild(img); };
        screen.insertBefore(img, screen.firstChild);
    });
}

// Criar estrelas de celebração
function createPodiumStars() {
    const container = document.getElementById('podium-stars');
    if (!container) return;

    container.innerHTML = '';

    // Criar estrelas em posições aleatórias
    for (let i = 0; i < 15; i++) {
        const star = document.createElement('div');
        star.className = 'podium-star';
        star.style.left = (5 + Math.random() * 90) + '%';
        star.style.top = (5 + Math.random() * 60) + '%';
        star.style.animationDelay = (Math.random() * 2) + 's';
        star.style.animationDuration = (1.5 + Math.random() * 1) + 's';
        container.appendChild(star);

        // Remover após 8 segundos
        setTimeout(() => {
            if (star.parentNode) star.parentNode.removeChild(star);
        }, 8000);
    }
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
