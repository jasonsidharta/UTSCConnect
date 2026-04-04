// ============================================
// Quiz — Offline & Online Modes
// ============================================

let quizSubject = null;
let quizMode = null;
let quizQuestions = [];
let quizCurrentQ = 0;
let quizScore = 0;
let quizCorrect = 0;
let quizWrong = 0;
let quizTimer = null;
let quizTimeLeft = 0;
let quizStartTime = 0;
let quizAnswers = []; // stores user answers for each question (offline)
let quizSolutions = []; // pre-fetched AI solutions for each question

// Online state
let quizMatchId = null;
let quizOpponent = null;
let quizMyScore = 0;
let quizOpponentScore = 0;

// --- Show Quiz Sections ---
function showQuizSection(id) {
    ["quiz-subject-select", "quiz-mode-select", "quiz-waiting", "quiz-play", "quiz-results"].forEach(s => {
        const el = document.getElementById(s);
        if (el) el.style.display = "none";
    });
    const el = document.getElementById(id);
    if (el) el.style.display = "block";
}

// --- Subject Select ---
function showQuizSubjects() {
    showQuizSection("quiz-subject-select");
}

function selectQuizSubject(subject) {
    quizSubject = subject;
    document.getElementById("quiz-mode-title").textContent = subject.toUpperCase();
    showQuizSection("quiz-mode-select");
}

// --- Mode Select ---
function selectQuizMode(mode) {
    quizMode = mode;
    if (mode === "offline") startOfflineQuiz();
    else startOnlineQuiz();
}

// ==========================================
// OFFLINE MODE
// ==========================================
// Pre-fetch AI solutions for all questions in background
async function prefetchSolutions() {
    quizSolutions = new Array(quizQuestions.length).fill(null);

    for (let i = 0; i < quizQuestions.length; i++) {
        const q = quizQuestions[i];
        const endpoint = quizSubject === "mata37" ? "/api/get-solution" : "/api/get-solution";
        try {
            const res = await fetch("/api/get-solution", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    subject: quizSubject,
                    problem: q.descLatex || q.description || q.name,
                    name: q.name,
                    signature: q.signature || "",
                }),
            });
            const data = await res.json();
            if (data.ok) {
                quizSolutions[i] = data.solution;
            }
        } catch (e) { /* will fallback to live check */ }
    }
    console.log("Solutions pre-fetched:", quizSolutions.filter(s => s).length, "/", quizQuestions.length);
}

async function startOfflineQuiz() {
    quizCurrentQ = 0;
    quizScore = 0;
    quizCorrect = 0;
    quizWrong = 0;
    quizAnswers = [];
    quizSolutions = [];

    try {
        const res = await fetch(`/api/quiz-questions?subject=${quizSubject}&count=5`);
        const data = await res.json();
        if (!data.ok || data.questions.length === 0) { alert("No questions available."); return; }
        quizQuestions = data.questions;
        quizAnswers = new Array(quizQuestions.length).fill("");
    } catch (e) { alert("Failed to load questions."); return; }

    // Start pre-fetching solutions in background (don't await)
    prefetchSolutions();

    showQuizSection("quiz-play");
    document.getElementById("quiz-opponent-bar").style.display = "none";
    document.getElementById("quiz-my-score").textContent = "";
    quizStartTime = Date.now();

    quizTimeLeft = 600;
    updateTimerDisplay();
    quizTimer = setInterval(() => {
        quizTimeLeft--;
        updateTimerDisplay();
        if (quizTimeLeft <= 0) { clearInterval(quizTimer); submitOfflineQuiz(); }
    }, 1000);

    showQuizQuestion(0);
}

function showQuizQuestion(idx) {
    if (idx < 0 || idx >= quizQuestions.length) return;

    // Save current answer before switching
    saveCurrentAnswer();

    quizCurrentQ = idx;
    const q = quizQuestions[idx];
    const total = quizQuestions.length;

    document.getElementById("quiz-q-number").textContent = `Question ${idx + 1} of ${total}`;
    document.getElementById("quiz-q-diff").textContent = q.difficulty;
    document.getElementById("quiz-q-diff").className = "diff-badge " + q.difficulty.toLowerCase();
    document.getElementById("quiz-q-name").textContent = q.name;

    const descEl = document.getElementById("quiz-q-desc");
    if (q.descLatex && typeof katex !== "undefined") {
        try { descEl.innerHTML = katex.renderToString(q.descLatex, { throwOnError: false, displayMode: true }); }
        catch(e) { descEl.textContent = q.description || q.descLatex; }
    } else {
        descEl.textContent = q.description || q.name;
    }

    const answerInput = document.getElementById("quiz-answer");
    const codeInput = document.getElementById("quiz-code");
    if (quizSubject === "mata37") {
        answerInput.style.display = "block";
        codeInput.style.display = "none";
        answerInput.value = quizAnswers[idx] || "";
    } else {
        answerInput.style.display = "none";
        codeInput.style.display = "block";
        codeInput.value = quizAnswers[idx] || q.starterCode || "";
    }

    document.getElementById("quiz-feedback").style.display = "none";

    // Navigation buttons for offline
    if (quizMode === "offline") {
        document.getElementById("quiz-prev-btn").style.display = idx > 0 ? "inline-block" : "none";
        document.getElementById("quiz-next-btn").style.display = idx < total - 1 ? "inline-block" : "none";
        document.getElementById("quiz-submit-btn").style.display = idx === total - 1 ? "inline-block" : "none";
        document.getElementById("quiz-submit-btn").disabled = false;
    } else {
        // Online: only submit, no prev/next
        document.getElementById("quiz-prev-btn").style.display = "none";
        document.getElementById("quiz-next-btn").style.display = "none";
        document.getElementById("quiz-submit-btn").style.display = "inline-block";
        document.getElementById("quiz-submit-btn").disabled = false;
    }
}

function saveCurrentAnswer() {
    if (quizCurrentQ < 0 || quizCurrentQ >= quizQuestions.length) return;
    if (quizSubject === "mata37") {
        quizAnswers[quizCurrentQ] = document.getElementById("quiz-answer").value;
    } else {
        quizAnswers[quizCurrentQ] = document.getElementById("quiz-code").value;
    }
}

function prevQuizQuestion() {
    saveCurrentAnswer();
    if (quizCurrentQ > 0) showQuizQuestion(quizCurrentQ - 1);
}

function nextQuizQuestion() {
    saveCurrentAnswer();
    if (quizCurrentQ < quizQuestions.length - 1) showQuizQuestion(quizCurrentQ + 1);
}

// Submit all answers at end (offline)
async function submitOfflineQuiz() {
    saveCurrentAnswer();
    clearInterval(quizTimer);
    const timeUsed = Math.floor((Date.now() - quizStartTime) / 1000);

    showQuizSection("quiz-results");
    document.getElementById("quiz-result-title").textContent = "Checking answers...";
    document.getElementById("quiz-result-body").innerHTML = '<div class="ai-loading">Grading with AI...</div>';

    quizScore = 0;
    quizCorrect = 0;
    quizWrong = 0;
    const results = [];

    // Check all answers — use pre-fetched solutions for speed, fallback to live AI
    const checkPromises = quizQuestions.map(async (q, i) => {
        const answer = (quizAnswers[i] || "").trim();
        const solution = quizSolutions[i] || null;

        if (!answer) {
            return { q, answer: "(no answer)", correct: false, explanation: "No answer submitted.", solution };
        }

        // If we have a pre-fetched solution, use the quick check endpoint
        if (solution) {
            try {
                const res = await fetch("/api/quick-check", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ subject: quizSubject, problem: q.descLatex || q.description || q.name, answer, solution }),
                });
                const data = await res.json();
                if (data.ok) {
                    const text = data.response.trim();
                    const isCorrect = text.toUpperCase().startsWith("CORRECT");
                    const explanation = text.replace(/^(CORRECT|WRONG)\s*/i, "");
                    return { q, answer, correct: isCorrect, explanation, solution };
                }
            } catch (e) { /* fallback below */ }
        }

        // Fallback: live AI check
        const endpoint = quizSubject === "mata37" ? "/api/check-math" : "/api/check-code";
        const body = quizSubject === "mata37"
            ? { problem: q.descLatex || q.name, answer }
            : { code: answer, problem_name: q.name, description: q.description || "", signature: q.signature || "" };

        try {
            const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const data = await res.json();
            if (data.ok) {
                const text = data.response.trim();
                const isCorrect = text.toUpperCase().startsWith("CORRECT");
                const explanation = text.replace(/^(CORRECT|WRONG)\s*/i, "");
                return { q, answer, correct: isCorrect, explanation, solution };
            }
        } catch (e) {}
        return { q, answer, correct: false, explanation: "Check failed.", solution };
    });

    // Run all checks in parallel for speed
    const checkResults = await Promise.all(checkPromises);

    for (const r of checkResults) {
        if (r.correct) {
            quizCorrect++;
            const pts = { "EASY": 100, "MEDIUM": 200, "HARD": 400 }[r.q.difficulty] || 100;
            quizScore += pts;
            r.pts = pts;
        } else {
            quizWrong++;
            quizScore -= 100;
        }
        results.push(r);
    }

    // Save result
    fetch("/api/quiz-results", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            username: currentUser, subject: quizSubject, mode: "offline",
            score: quizScore, total_questions: quizQuestions.length,
            correct: quizCorrect, wrong: quizWrong, time_used: timeUsed,
        }),
    }).catch(() => {});

    // Show results with solutions
    let html = `
        <div class="quiz-stat"><span>Score</span><strong>${quizScore}</strong></div>
        <div class="quiz-stat correct"><span>Correct</span><strong>${quizCorrect}</strong></div>
        <div class="quiz-stat wrong"><span>Wrong</span><strong>${quizWrong}</strong></div>
        <div class="quiz-stat"><span>Time</span><strong>${formatTime(timeUsed)}</strong></div>
    `;

    html += '<div style="margin-top:20px;text-align:left;">';
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const badge = r.correct
            ? '<span class="diff-badge easy" style="font-size:12px;">CORRECT</span>'
            : '<span class="diff-badge hard" style="font-size:12px;">WRONG</span>';

        let qDesc = r.q.name;
        if (r.q.descLatex && typeof katex !== "undefined") {
            try { qDesc = katex.renderToString(r.q.descLatex, { throwOnError: false }); } catch(e) {}
        }

        const explanation = typeof formatAIResponse === "function" ? formatAIResponse(r.explanation) : r.explanation;

        let solutionHtml = "";
        if (r.solution) {
            let rendered = r.solution;
            if (typeof formatAIResponse === "function") rendered = formatAIResponse(r.solution);
            solutionHtml = `<div style="margin-top:8px;padding:10px;background:#F0FFF0;border:2px solid #2E7D32;border-radius:8px;font-size:13px;color:#2E7D32;"><strong>Solution:</strong><br>${rendered}</div>`;
        }

        html += `
            <div class="quiz-solution-card">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <strong>Q${i + 1}: ${r.q.name}</strong>
                    ${badge}
                </div>
                <div style="font-size:14px;color:#555;margin-bottom:6px;">${qDesc}</div>
                <div style="font-size:13px;color:#888;">Your answer: <code>${r.answer}</code></div>
                <div style="font-size:13px;margin-top:6px;">${explanation}</div>
                ${solutionHtml}
            </div>
        `;
    }
    html += '</div>';

    document.getElementById("quiz-result-title").textContent = "Quiz Complete!";
    document.getElementById("quiz-result-body").innerHTML = html;
}

// Online submit (unchanged)
async function submitQuizAnswer() {
    submitOfflineQuiz();
}

// ==========================================
// ONLINE MODE
// ==========================================
function startOnlineQuiz() {
    showQuizSection("quiz-waiting");
    document.getElementById("quiz-waiting-subject").textContent = quizSubject.toUpperCase();

    // Make sure socket is connected before emitting
    if (socket.connected) {
        socket.emit("quiz_join_waiting", { subject: quizSubject, username: currentUser });
        console.log("[Quiz] Emitted quiz_join_waiting as", currentUser, "for", quizSubject, "sid:", socket.id);
    } else {
        console.log("[Quiz] Socket not connected, waiting...");
        socket.once("connect", () => {
            socket.emit("quiz_join_waiting", { subject: quizSubject, username: currentUser });
            console.log("[Quiz] Emitted quiz_join_waiting (after reconnect) as", currentUser);
        });
    }
}

function cancelQuizWaiting() {
    socket.emit("quiz_leave_waiting", { subject: quizSubject });
    showQuizSubjects();
}

// Match found
socket.on("quiz_match_found", (data) => {
    quizMatchId = data.match_id;
    quizQuestions = data.questions;
    quizOpponent = data.opponent;
    quizMyScore = 0;
    quizOpponentScore = 0;
    quizCurrentQ = 0;

    showQuizSection("quiz-play");
    document.getElementById("quiz-opponent-bar").style.display = "flex";
    document.getElementById("quiz-opponent-name").textContent = `vs ${quizOpponent}`;
    document.getElementById("quiz-my-score").textContent = "You: 0";
    document.getElementById("quiz-opp-score").textContent = `${quizOpponent}: 0`;

    showOnlineQuestion(0);
});

function showOnlineQuestion(idx) {
    if (idx >= quizQuestions.length) return;
    quizCurrentQ = idx;
    const q = quizQuestions[idx];

    showQuizQuestion(idx);
    document.getElementById("quiz-next-btn").style.display = "none";

    // Per-question timer
    clearInterval(quizTimer);
    const times = { "EASY": 120, "MEDIUM": 180, "HARD": 300 };
    quizTimeLeft = times[q.difficulty] || 180;
    updateTimerDisplay();
    quizTimer = setInterval(() => {
        quizTimeLeft--;
        updateTimerDisplay();
        if (quizTimeLeft <= 0) {
            clearInterval(quizTimer);
            socket.emit("quiz_time_up", { match_id: quizMatchId, question_idx: quizCurrentQ });
        }
    }, 1000);
}

// Override submit for online mode
async function submitOnlineAnswer() {
    const q = quizQuestions[quizCurrentQ];
    let answer;
    if (quizSubject === "mata37") {
        answer = document.getElementById("quiz-answer").value.trim();
    } else {
        answer = document.getElementById("quiz-code").value.trim();
    }
    if (!answer) return;

    document.getElementById("quiz-submit-btn").disabled = true;
    document.getElementById("quiz-feedback").style.display = "block";
    document.getElementById("quiz-feedback").innerHTML = '<div class="ai-loading">Checking...</div>';

    socket.emit("quiz_submit_answer", {
        match_id: quizMatchId, question_idx: quizCurrentQ, answer,
    });
}

// Question solved by someone
socket.on("quiz_question_solved", (data) => {
    clearInterval(quizTimer);
    quizMyScore = data.p1_score;
    quizOpponentScore = data.p2_score;

    // Figure out which score is mine
    // (server sends p1/p2 scores, we need to know if we're p1 or p2)
    document.getElementById("quiz-my-score").textContent = `You: ${data.p1_score}`;
    document.getElementById("quiz-opp-score").textContent = `${quizOpponent}: ${data.p2_score}`;

    const fb = document.getElementById("quiz-feedback");
    fb.style.display = "block";
    fb.innerHTML = `<div class="result-badge correct">SOLVED by ${data.solver}</div>
        <div class="ai-response">+${data.points} points to ${data.solver}</div>`;

    // Auto advance after 2 seconds
    setTimeout(() => {
        if (quizCurrentQ + 1 < quizQuestions.length) {
            showOnlineQuestion(quizCurrentQ + 1);
        }
    }, 2000);
});

socket.on("quiz_wrong_answer", (data) => {
    document.getElementById("quiz-submit-btn").disabled = false;
    document.getElementById("quiz-my-score").textContent = `You: ${data.p1_score}`;
    document.getElementById("quiz-opp-score").textContent = `${quizOpponent}: ${data.p2_score}`;

    const fb = document.getElementById("quiz-feedback");
    fb.style.display = "block";
    const explanation = (data.ai_response || "").replace(/^(CORRECT|WRONG)\s*/i, "");
    fb.innerHTML = `<div class="result-badge wrong">WRONG</div>
        <div class="ai-response">-100 points. Try again!<br>${typeof formatAIResponse === "function" ? formatAIResponse(explanation) : explanation}</div>`;
});

socket.on("quiz_next_question", (data) => {
    clearInterval(quizTimer);
    document.getElementById("quiz-my-score").textContent = `You: ${data.p1_score}`;
    document.getElementById("quiz-opp-score").textContent = `${quizOpponent}: ${data.p2_score}`;

    if (data.question_idx < quizQuestions.length) {
        showOnlineQuestion(data.question_idx);
    }
});

socket.on("quiz_already_solved", () => {
    document.getElementById("quiz-feedback").innerHTML = '<div class="ai-response">Already solved! Waiting for next question...</div>';
});

socket.on("quiz_match_end", (data) => {
    clearInterval(quizTimer);
    showQuizSection("quiz-results");

    let resultText;
    if (data.winner === "draw") {
        resultText = "Draw!";
    } else if (data.winner === currentUser) {
        resultText = "You Win!";
    } else {
        resultText = "You Lose!";
    }

    const reason = data.reason ? ` (${data.reason})` : "";

    document.getElementById("quiz-result-title").textContent = resultText + reason;
    document.getElementById("quiz-result-body").innerHTML = `
        <div class="quiz-stat"><span>${data.p1_name}</span><strong>${data.p1_score} pts</strong></div>
        <div class="quiz-stat"><span>${data.p2_name}</span><strong>${data.p2_score} pts</strong></div>
        <div class="quiz-stat"><span>Winner</span><strong>${data.winner === "draw" ? "Draw" : data.winner}</strong></div>
    `;
});

// --- Helpers ---
function updateTimerDisplay() {
    const el = document.getElementById("quiz-timer");
    if (el) el.textContent = formatTime(quizTimeLeft);
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

// Wire submit button to correct mode
function handleQuizSubmit() {
    if (quizMode === "online") submitOnlineAnswer();
    else submitOfflineQuiz();
}

// --- Quit Quiz ---
function quitQuiz() {
    if (!confirm("Are you sure you want to quit?")) return;
    clearInterval(quizTimer);

    if (quizMode === "online" && quizMatchId) {
        socket.emit("quiz_quit", { match_id: quizMatchId });
        showQuizSubjects();
    } else {
        // Offline — submit what you have
        submitOfflineQuiz();
    }
}

socket.on("quiz_opponent_quit", (data) => {
    clearInterval(quizTimer);
    showQuizSection("quiz-results");
    document.getElementById("quiz-result-title").textContent = "You Win!";
    document.getElementById("quiz-result-body").innerHTML = `
        <div class="quiz-stat"><span>Result</span><strong>Opponent quit</strong></div>
        <div class="quiz-stat"><span>Your Score</span><strong>${data.your_score} pts</strong></div>
    `;
});
