// js/game.js

// === Estado del juego ===
let timeLeft = 60;
let score = 0;
let timerId = null;
let gameActive = false;
let correctAnswer = null;
let currentLevel = 1;

// Usuario actual (si está logueado)
let currentUser = null;

// URL base del backend Flask
const API_BASE = window.location.origin;


// Referencias al DOM (juego)
const timeSpan = document.getElementById("time");
const scoreSpan = document.getElementById("score");
const questionBox = document.getElementById("question");
const messageBox = document.getElementById("message");
const startBtn = document.getElementById("startBtn");
const answerButtons = document.querySelectorAll(".answer");
const levelSelect = document.getElementById("levelSelect");

// Referencias al DOM (auth + ranking)
const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const authMessage = document.getElementById("authMessage");
const authSection = document.getElementById("authSection");
const userInfo = document.getElementById("userInfo");
const currentUserName = document.getElementById("currentUserName");
const currentUserBestScore = document.getElementById("currentUserBestScore");
const logoutBtn = document.getElementById("logoutBtn");
const rankingList = document.getElementById("rankingList");

// ============================
//   Configuración por nivel
// ============================
function getConfigForLevel(level) {
    switch (level) {
        case 1:
            return { min: 1, max: 10, operations: ["+"] };
        case 2:
            return { min: 1, max: 20, operations: ["+", "-"] };
        case 3:
        default:
            return { min: 1, max: 20, operations: ["+", "-", "×"] };
    }
}

// ============================
//   Juego: iniciar partida
// ============================
function startGame() {
    timeLeft = 60;
    score = 0;
    gameActive = true;
    correctAnswer = null;
    messageBox.textContent = "";
    messageBox.style.color = "";
    scoreSpan.textContent = score;
    timeSpan.textContent = timeLeft;
    questionBox.textContent = "Preparando la primera operación...";

    startBtn.textContent = "Reiniciar partida";

    generateQuestion();

    if (timerId) {
        clearInterval(timerId);
    }

    timerId = setInterval(() => {
        timeLeft--;
        timeSpan.textContent = timeLeft;

        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

// ============================
//   Juego: finalizar partida
// ============================
function endGame() {
    gameActive = false;
    clearInterval(timerId);
    timerId = null;

    questionBox.textContent = "⏰ Tiempo agotado";
    messageBox.textContent = `Tu puntuación final es: ${score} puntos`;
    messageBox.style.color = "#fff";

    // Si hay usuario logueado → enviar score al backend
    if (currentUser) {
        sendScoreToServer(score);
    }
}

// ======================================
//   Juego: generar operación aleatoria
// ======================================
function generateQuestion() {
    if (!gameActive) return;

    const config = getConfigForLevel(currentLevel);

    const a = getRandomInt(config.min, config.max);
    const b = getRandomInt(config.min, config.max);

    const operations = config.operations;
    const op = operations[getRandomInt(0, operations.length - 1)];

    let result;
    let text;

    switch (op) {
        case "+":
            result = a + b;
            text = `${a} + ${b}`;
            break;
        case "-":
            result = a - b;
            text = `${a} - ${b}`;
            break;
        case "×":
            result = a * b;
            text = `${a} × ${b}`;
            break;
    }

    correctAnswer = result;
    questionBox.textContent = `¿Cuánto es ${text}?`;

    const answers = generateAnswers(result);

    answerButtons.forEach((btn, index) => {
        btn.textContent = answers[index];
        btn.dataset.value = answers[index];
    });
}

// ==================================================
function generateAnswers(correct) {
    const answers = new Set();
    answers.add(correct);

    while (answers.size < 4) {
        const offset = getRandomInt(-10, 10);
        const candidate = correct + offset;
        if (candidate !== correct && candidate >= -50 && candidate <= 400) {
            answers.add(candidate);
        }
    }

    const answersArray = Array.from(answers);
    shuffleArray(answersArray);
    return answersArray;
}

// =======================================
function handleAnswerClick(event) {
    if (!gameActive) return;

    const clickedValue = Number(event.target.dataset.value);

    if (clickedValue === correctAnswer) {
        score += 10;
        messageBox.textContent = "✅ ¡Correcto!";
        messageBox.style.color = "limegreen";
    } else {
        score -= 5;
        if (score < 0) score = 0;
        messageBox.textContent = `❌ Incorrecto. La respuesta correcta era ${correctAnswer}.`;
        messageBox.style.color = "crimson";
    }

    scoreSpan.textContent = score;
    generateQuestion();
}

// =======================
//   Funciones auxiliares
// =======================
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// =======================
//   Auth: UI helpers
// =======================
function setLoggedInUser(user) {
    currentUser = user;
    authSection.style.display = "none";
    userInfo.style.display = "block";
    currentUserName.textContent = user.username;
    currentUserBestScore.textContent = user.best_score ?? 0;
    authMessage.textContent = "";
}

function setLoggedOut() {
    currentUser = null;
    authSection.style.display = "block";
    userInfo.style.display = "none";
    currentUserName.textContent = "";
    currentUserBestScore.textContent = 0;
}

// =======================
//   Auth: llamadas API
// =======================
async function registerUser() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        authMessage.textContent = "Usuario y contraseña obligatorios";
        authMessage.style.color = "orange";
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (!data.success) {
            authMessage.textContent = data.error || "Error en el registro";
            authMessage.style.color = "crimson";
            return;
        }

        authMessage.textContent = "✅ Registro correcto. Sesión iniciada.";
        authMessage.style.color = "limegreen";
        setLoggedInUser(data.user);

    } catch (err) {
        console.error(err);
        authMessage.textContent = "Error de conexión con el servidor";
        authMessage.style.color = "crimson";
    }
}

async function loginUser() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        authMessage.textContent = "Usuario y contraseña obligatorios";
        authMessage.style.color = "orange";
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (!data.success) {
            authMessage.textContent = data.error || "Error al iniciar sesión";
            authMessage.style.color = "crimson";
            return;
        }

        authMessage.textContent = "✅ Login correcto.";
        authMessage.style.color = "limegreen";
        setLoggedInUser(data.user);

    } catch (err) {
        console.error(err);
        authMessage.textContent = "Error de conexión con el servidor";
        authMessage.style.color = "crimson";
    }
}

async function sendScoreToServer(scoreValue) {
    if (!currentUser) return;

    try {
        const res = await fetch(`${API_BASE}/api/score`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: currentUser.id, score: scoreValue }),
        });

        const data = await res.json();

        if (!data.success) {
            console.warn("No se pudo guardar el score:", data.error);
            return;
        }

        // Actualizar mejor score del usuario
        currentUser.best_score = data.best_score;
        currentUserBestScore.textContent = data.best_score;

        // Actualizar ranking
        if (data.ranking) {
            renderRanking(data.ranking);
        }

    } catch (err) {
        console.error(err);
    }
}


async function loadRanking() {
    try {
        const res = await fetch(`${API_BASE}/api/ranking`);
        const data = await res.json();
        if (data.success && data.ranking) {
            renderRanking(data.ranking);
        }
    } catch (err) {
        console.error(err);
    }
}

function renderRanking(ranking) {
    rankingList.innerHTML = "";
    ranking.forEach((item, index) => {
        const li = document.createElement("li");
        li.textContent = `${index + 1}. ${item.username} — ${item.best_score} puntos`;
        rankingList.appendChild(li);
    });
}

// =======================
//   Listeners iniciales
// =======================
startBtn.addEventListener("click", startGame);

answerButtons.forEach((btn) => {
    btn.addEventListener("click", handleAnswerClick);
});

levelSelect.addEventListener("change", (e) => {
    currentLevel = Number(e.target.value);
});

loginBtn.addEventListener("click", (e) => {
    e.preventDefault();
    loginUser();
});

registerBtn.addEventListener("click", (e) => {
    e.preventDefault();
    registerUser();
});

logoutBtn.addEventListener("click", () => {
    setLoggedOut();
});

// Cargar ranking al inicio
loadRanking();
