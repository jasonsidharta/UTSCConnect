// ============================================
// Authentication + Main Menu
// ============================================

let currentUser = null;
let currentRole = "user"; // "user" or "contributor"

// --- Tab Switching ---
document.querySelectorAll(".auth-tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        const formId = tab.dataset.tab === "signup" ? "signup-form" : "login-form";
        document.getElementById("signup-form").style.display = tab.dataset.tab === "signup" ? "block" : "none";
        document.getElementById("login-form").style.display = tab.dataset.tab === "login" ? "block" : "none";
        document.getElementById("auth-error").textContent = "";
    });
});

// --- Sign Up ---
document.getElementById("signup-btn").addEventListener("click", doSignup);
document.getElementById("signup-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSignup();
});

async function doSignup() {
    const username = document.getElementById("signup-username").value.trim();
    const password = document.getElementById("signup-password").value;
    const errorEl = document.getElementById("auth-error");
    errorEl.textContent = "";

    if (!username || !password) {
        errorEl.textContent = "Please enter username and password.";
        return;
    }

    try {
        const res = await fetch("/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (data.ok) {
            loginSuccess(data.username, data.role);
        } else {
            errorEl.textContent = data.error || "Sign up failed.";
        }
    } catch (err) {
        errorEl.textContent = "Connection error.";
    }
}

// --- Log In ---
document.getElementById("login-btn").addEventListener("click", doLogin);
document.getElementById("login-username").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("login-password").focus();
});
document.getElementById("login-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
});

async function doLogin() {
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;
    const errorEl = document.getElementById("auth-error");
    errorEl.textContent = "";

    if (!username || !password) {
        errorEl.textContent = "Please enter username and password.";
        return;
    }

    try {
        const res = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (data.ok) {
            loginSuccess(data.username, data.role);
        } else {
            errorEl.textContent = data.error || "Login failed.";
        }
    } catch (err) {
        errorEl.textContent = "Connection error.";
    }
}

// --- Login Success → Show Menu ---
function loginSuccess(username, role) {
    currentUser = username;
    currentRole = role || "user";
    localStorage.setItem("got_user", username);
    localStorage.setItem("got_role", currentRole);
    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("main-menu").style.display = "flex";
    const roleLabel = currentRole === "contributor" ? " (Contributor)" : "";
    document.getElementById("menu-welcome").textContent = `Welcome, ${username}!${roleLabel}`;
    document.getElementById("user-avatar").textContent = username.charAt(0).toUpperCase();
    loadLeaderboard();
}

async function loadLeaderboard() {
    try {
        const res = await fetch("/api/leaderboard");
        const data = await res.json();
        const list = document.getElementById("leaderboard-list");
        if (!list) return;
        if (!data.ok || data.leaderboard.length === 0) {
            list.innerHTML = '<p style="color:#888;font-size:13px;">No solves yet. Be the first!</p>';
            return;
        }
        list.innerHTML = "";
        data.leaderboard.forEach((entry, i) => {
            const row = document.createElement("div");
            row.className = "lb-row" + (entry.username === currentUser ? " lb-me" : "");
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
            row.innerHTML = `<span class="lb-rank">${medal}</span><span class="lb-name">${entry.username}</span><span class="lb-pts">${entry.points} pts</span>`;
            list.appendChild(row);
        });
    } catch(e) {}
}

// --- Log Out ---
document.getElementById("logout-btn").addEventListener("click", () => {
    currentUser = null;
    currentRole = "user";
    localStorage.removeItem("got_user");
    localStorage.removeItem("got_role");
    document.getElementById("main-menu").style.display = "none";
    document.getElementById("auth-screen").style.display = "flex";
    document.getElementById("signup-username").value = "";
    document.getElementById("signup-password").value = "";
    document.getElementById("login-username").value = "";
    document.getElementById("auth-error").textContent = "";
});

// --- Menu Cards ---
document.querySelectorAll(".menu-card").forEach(card => {
    card.addEventListener("click", () => {
        const page = card.dataset.page;
        if (page === "uconnect") {
            document.getElementById("main-menu").style.display = "none";
            document.getElementById("uconnect-select").style.display = "flex";
        } else if (page === "practice") {
            document.getElementById("main-menu").style.display = "none";
            document.getElementById("practice-section").style.display = "block";
            showPracticeCourses();
        } else if (page === "games") {
            document.getElementById("main-menu").style.display = "none";
            document.getElementById("games-section").style.display = "block";
            showChessMenu();
        } else if (page === "quiz") {
            document.getElementById("main-menu").style.display = "none";
            document.getElementById("quiz-section").style.display = "block";
            showQuizSubjects();
        } else {
            document.getElementById("main-menu").style.display = "none";
            document.getElementById("placeholder-page").style.display = "flex";
            document.getElementById("placeholder-title").textContent =
                page.charAt(0).toUpperCase() + page.slice(1) + " — Coming Soon";
        }
    });
});

// --- Placeholder back ---
document.getElementById("placeholder-back").addEventListener("click", () => {
    document.getElementById("placeholder-page").style.display = "none";
    document.getElementById("main-menu").style.display = "flex";
});

// --- Uconnect: Character Select → Enter World ---
document.getElementById("enter-world-btn").addEventListener("click", () => {
    document.getElementById("uconnect-select").style.display = "none";
    // startGame is defined in game.js
    if (typeof startGame === "function") {
        startGame(currentUser, selectedCharacter);
    }
});

document.getElementById("back-to-menu-btn").addEventListener("click", () => {
    document.getElementById("uconnect-select").style.display = "none";
    document.getElementById("main-menu").style.display = "flex";
});

// --- Auto-login from localStorage ---
window.addEventListener("DOMContentLoaded", () => {
    const saved = localStorage.getItem("got_user");
    if (saved) {
        // Verify user still exists
        fetch("/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: saved }),
        })
        .then(r => r.json())
        .then(data => {
            if (data.ok) {
                loginSuccess(data.username, data.role);
            } else {
                localStorage.removeItem("got_user");
                localStorage.removeItem("got_role");
            }
        })
        .catch(() => {
            localStorage.removeItem("got_user");
        });
    }
});
