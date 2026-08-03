/**
 * ============================================
 * QUIZ 99 - CLIENTE
 * ============================================
 * Lógica do frontend para o Quiz
 */

const socket = io();

// Estado global
let currentGame = null;
let currentPlayer = null;
let currentQuestion = null;
let timerInterval = null;

// ============================================
// NAVEGAÇÃO ENTRE TELAS
// ============================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// ============================================
// JOGADOR - ENTRAR NO JOGO
// ============================================
function joinGame() {
    const name = document.getElementById('player-name').value.trim();
    const email = document.getElementById('player-email').value.trim();
    const gameCode = document.getElementById('game-code').value.trim().toUpperCase();

    if (!name || !email || !gameCode) {
        alert('Please fill in all fields!');
        return;
    }

    if (!email.includes('@')) {
        alert('Please enter a valid email!');
        return;
    }

    currentPlayer = { name, email };

    socket.emit('join-game', {
        gameCode,
        name,
        email
    });
}

// ============================================
// ADMIN - LOGIN
// ============================================
function adminLogin() {
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;

    if (!email || !password) {
        alert('Please fill in all fields!');
        return;
    }

    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.token) {
            localStorage.setItem('adminToken', data.token);
            showScreen('admin-dashboard');
            loadAdminDashboard();
        } else {
            alert('Invalid credentials!');
        }
    })
    .catch(err => {
        alert('Login error: ' + err.message);
    });
}

function logoutAdmin() {
    localStorage.removeItem('adminToken');
    showScreen('home-screen');
}

// ============================================
// ADMIN - CRIAR JOGO
// ============================================
let questionCount = 0;

function addQuestion() {
    questionCount++;
    const container = document.getElementById('questions-container');

    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-item';
    questionDiv.innerHTML = `
        <div class="question-header">
            <span class="question-number">Question ${questionCount}</span>
            <button onclick="this.parentElement.parentElement.remove()" style="background:#dc3545;color:white;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;">Remove</button>
        </div>
        <div class="input-group">
            <label>Question Text</label>
            <input type="text" class="q-text" placeholder="Enter your question...">
        </div>
        <div class="input-group">
            <label>Option A</label>
            <input type="text" class="q-opt-0" placeholder="Option A">
        </div>
        <div class="input-group">
            <label>Option B</label>
            <input type="text" class="q-opt-1" placeholder="Option B">
        </div>
        <div class="input-group">
            <label>Option C</label>
            <input type="text" class="q-opt-2" placeholder="Option C">
        </div>
        <div class="input-group">
            <label>Option D</label>
            <input type="text" class="q-opt-3" placeholder="Option D">
        </div>
        <div class="input-group">
            <label>Correct Answer (0=A, 1=B, 2=C, 3=D)</label>
            <input type="number" class="q-correct" min="0" max="3" value="0">
        </div>
        <div class="input-group">
            <label>Time (seconds)</label>
            <input type="number" class="q-time" min="5" max="60" value="30">
        </div>
    `;

    container.appendChild(questionDiv);
}

function createGame() {
    const title = document.getElementById('quiz-title').value.trim();

    if (!title) {
        alert('Please enter a quiz title!');
        return;
    }

    const questions = [];
    document.querySelectorAll('.question-item').forEach(item => {
        const text = item.querySelector('.q-text').value.trim();
        const options = [
            item.querySelector('.q-opt-0').value.trim(),
            item.querySelector('.q-opt-1').value.trim(),
            item.querySelector('.q-opt-2').value.trim(),
            item.querySelector('.q-opt-3').value.trim()
        ];
        const correctAnswer = parseInt(item.querySelector('.q-correct').value);
        const time = parseInt(item.querySelector('.q-time').value);

        if (text && options.every(opt => opt)) {
            questions.push({ text, options, correctAnswer, time });
        }
    });

    if (questions.length === 0) {
        alert('Please add at least one question!');
        return;
    }

    const token = localStorage.getItem('adminToken');

    fetch('/api/game/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, questions })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            document.getElementById('created-game-code').value = data.gameCode;
            document.getElementById('game-info').style.display = 'block';

            // Conectar como admin
            socket.emit('admin-join', {
                gameCode: data.gameCode,
                token
            });
        }
    })
    .catch(err => {
        alert('Error creating game: ' + err.message);
    });
}

function startGame() {
    const gameCode = document.getElementById('created-game-code').value;
    socket.emit('start-game', { gameCode });
}

// ============================================
// SOCKET EVENTS
// ============================================

// Jogador entrou
socket.on('joined', (data) => {
    currentGame = { code: data.gameCode };
    showScreen('waiting-screen');
});

// Erro
socket.on('error', (data) => {
    alert(data.message);
});

// Jogadores atualizados
socket.on('player-count', (data) => {
    document.getElementById('waiting-players').textContent = `Players: ${data.count}`;
});

// Novo jogador
socket.on('player-joined', (data) => {
    updatePlayersList(data.players);
});

// Jogo iniciado
socket.on('game-started', () => {
    showScreen('game-screen');
});

// Nova pergunta
socket.on('question', (data) => {
    currentQuestion = data.question;
    showQuestion(data);
});

// Timer
socket.on('timer', (data) => {
    updateTimer(data.timeLeft, data.total);
});

// Resultado da pergunta
socket.on('question-results', (data) => {
    showResults(data);
});

// Mostrar ranking
socket.on('show-ranking', (data) => {
    showRanking(data.ranking);
});

// Jogo terminou
socket.on('game-ended', (data) => {
    showPodium(data.top3);
    getCoupon(data.position);
});

// ============================================
// FUNÇÕES DO JOGO
// ============================================

function showQuestion(data) {
    document.getElementById('current-q').textContent = data.questionNumber;
    document.getElementById('total-q').textContent = data.totalQuestions;
    document.getElementById('question-text').textContent = data.question.text;

    const optionsGrid = document.getElementById('options-grid');
    optionsGrid.innerHTML = '';

    const letters = ['A', 'B', 'C', 'D'];
    data.question.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'option';
        btn.innerHTML = `
            <span class="option-letter">${letters[index]}</span>
            <span>${option}</span>
        `;
        btn.onclick = () => answerQuestion(index);
        optionsGrid.appendChild(btn);
    });
}

function answerQuestion(answer) {
    if (!currentQuestion) return;

    // Desabilitar todas as opções
    document.querySelectorAll('.option').forEach(btn => {
        btn.disabled = true;
    });

    // Marcar selecionada
    document.querySelectorAll('.option')[answer].classList.add('selected');

    socket.emit('answer-question', {
        gameCode: currentGame.code,
        questionId: currentQuestion.id,
        answer,
        answerTime: Date.now() - questionStartTime
    });
}

let questionStartTime;

function updateTimer(timeLeft, total) {
    document.getElementById('timer-text').textContent = timeLeft;
    document.getElementById('timer-bar').style.width = `${(timeLeft / total) * 100}%`;

    if (timeLeft === total) {
        questionStartTime = Date.now();
    }
}

function showResults(data) {
    const options = document.querySelectorAll('.option');
    options.forEach((btn, index) => {
        btn.disabled = true;
        if (index === data.correctAnswer) {
            btn.classList.add('correct');
        } else if (btn.classList.contains('selected') && index !== data.correctAnswer) {
            btn.classList.add('wrong');
        }
    });

    setTimeout(() => {
        showRanking(data.ranking);
    }, 3000);
}

function showRanking(ranking) {
    showScreen('ranking-screen');

    const list = document.getElementById('ranking-list');
    list.innerHTML = '';

    ranking.forEach(player => {
        const item = document.createElement('div');
        item.className = `ranking-item ${player.position <= 3 ? 'top-' + player.position : ''}`;
        item.innerHTML = `
            <div class="rank-position">#${player.position}</div>
            <div class="rank-name">${player.name}</div>
            <div class="rank-score">${player.score} pts</div>
        `;
        list.appendChild(item);
    });
}

function showPodium(top3) {
    showScreen('podium-screen');

    const container = document.getElementById('podium-container');
    container.innerHTML = '';

    const positions = [
        { place: 2, data: top3[1], height: 200 },
        { place: 1, data: top3[0], height: 250 },
        { place: 3, data: top3[2], height: 150 }
    ];

    positions.forEach(pos => {
        if (pos.data) {
            const podium = document.createElement('div');
            podium.className = 'podium-place';
            podium.innerHTML = `
                <div class="podium-avatar ${pos.place === 1 ? 'first' : ''}">
                    ${pos.place === 1 ? '👑' : pos.place === 2 ? '🥈' : '🥉'}
                </div>
                <div class="podium-block ${pos.place === 1 ? 'first' : pos.place === 2 ? 'second' : 'third'}">
                    <div class="podium-name">${pos.data.name}</div>
                    <div class="podium-score">${pos.data.score} pts</div>
                </div>
            `;
            container.appendChild(podium);
        }
    });

    // Mostrar cupom
    document.getElementById('coupon-section').style.display = 'block';
}

function getCoupon(position) {
    // Buscar cupom do Google Apps Script
    fetch(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getCoupon`)
        .then(res => res.json())
        .then(data => {
            if (data.success && data.coupon) {
                document.getElementById('coupon-code').textContent = data.coupon.code;
                document.getElementById('coupon-discount').textContent = data.coupon.discount;

                // Atribuir cupom ao jogador
                assignCoupon(data.coupon);
            }
        });
}

function assignCoupon(coupon) {
    const playerEmail = currentPlayer?.email;
    const playerName = currentPlayer?.name;

    if (!playerEmail) return;

    fetch(`${CONFIG.GOOGLE_SCRIPT_URL}?action=assignCoupon`, {
        method: 'POST',
        body: JSON.stringify({
            playerEmail,
            playerName,
            gameCode: currentGame?.code,
            position: currentQuestion?.questionNumber
        })
    });
}

function updatePlayersList(players) {
    const container = document.getElementById('players-avatars');
    container.innerHTML = '';

    players.forEach(player => {
        const avatar = document.createElement('div');
        avatar.className = 'player-avatar';
        avatar.textContent = player.name.charAt(0).toUpperCase();
        container.appendChild(avatar);
    });
}

function loadAdminDashboard() {
    // Carregar dashboard do admin
    addQuestion(); // Adicionar primeira pergunta por padrão
}

// Configuração
const CONFIG = {
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec'
};
