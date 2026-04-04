// ============================================
// Chess — Multiplayer with 5-min timer
// ============================================

// Piece encoding: uppercase = white, lowercase = black
const INITIAL_BOARD = [
    ["r","n","b","q","k","b","n","r"],
    ["p","p","p","p","p","p","p","p"],
    ["","","","","","","",""],
    ["","","","","","","",""],
    ["","","","","","","",""],
    ["","","","","","","",""],
    ["P","P","P","P","P","P","P","P"],
    ["R","N","B","Q","K","B","N","R"],
];

const PIECE_SYMBOLS = {
    "K":"♔","Q":"♕","R":"♖","B":"♗","N":"♘","P":"♙",
    "k":"♚","q":"♛","r":"♜","b":"♝","n":"♞","p":"♟",
};

let chessBoard = [];
let chessSelected = null; // {row, col}
let chessMyColor = null; // "white" or "black"
let chessTurn = "white";
let chessMatchId = null;
let chessOpponent = null;
let chessTimerW = 300; // 5 min in seconds
let chessTimerB = 300;
let chessTimerInterval = null;
let chessGameOver = false;
let chessValidMoves = [];

// --- Show chess sections ---
function showChessSection(id) {
    ["chess-menu","chess-waiting","chess-game","chess-result"].forEach(s => {
        const el = document.getElementById(s);
        if (el) el.style.display = "none";
    });
    const el = document.getElementById(id);
    if (el) el.style.display = "block";
}

function showChessMenu() {
    showChessSection("chess-menu");
}

function startChessOnline() {
    showChessSection("chess-waiting");
    socket.emit("chess_join_waiting", { username: currentUser });
}

function cancelChessWaiting() {
    socket.emit("chess_leave_waiting");
    showChessMenu();
}

// --- Board rendering ---
function renderBoard() {
    const boardEl = document.getElementById("chess-board");
    if (!boardEl) return;
    boardEl.innerHTML = "";

    const flipped = chessMyColor === "black";

    for (let ri = 0; ri < 8; ri++) {
        for (let ci = 0; ci < 8; ci++) {
            const r = flipped ? 7 - ri : ri;
            const c = flipped ? 7 - ci : ci;
            const sq = document.createElement("div");
            const isLight = (r + c) % 2 === 0;
            sq.className = "chess-sq " + (isLight ? "sq-light" : "sq-dark");

            // Highlight selected
            if (chessSelected && chessSelected.row === r && chessSelected.col === c) {
                sq.classList.add("sq-selected");
            }

            // Highlight valid moves
            if (chessValidMoves.some(m => m.row === r && m.col === c)) {
                sq.classList.add("sq-valid");
            }

            const piece = chessBoard[r][c];
            if (piece) {
                const span = document.createElement("span");
                span.className = "chess-piece " + (piece === piece.toUpperCase() ? "piece-white" : "piece-black");
                span.textContent = PIECE_SYMBOLS[piece] || piece;
                sq.appendChild(span);
            }

            sq.addEventListener("click", () => onSquareClick(r, c));
            boardEl.appendChild(sq);
        }
    }
}

// --- Square click ---
function onSquareClick(row, col) {
    if (chessGameOver) return;
    const isMyTurn = (chessTurn === chessMyColor);
    if (!isMyTurn) return;

    const piece = chessBoard[row][col];

    if (chessSelected) {
        // Try to move
        const isValid = chessValidMoves.some(m => m.row === row && m.col === col);
        if (isValid) {
            // Send move to server
            socket.emit("chess_move", {
                match_id: chessMatchId,
                from: { row: chessSelected.row, col: chessSelected.col },
                to: { row, col },
            });
            chessSelected = null;
            chessValidMoves = [];
            renderBoard();
            return;
        }

        // Deselect if clicking empty or opponent piece without valid move
        chessSelected = null;
        chessValidMoves = [];
    }

    // Select own piece
    if (piece && isOwnPiece(piece)) {
        chessSelected = { row, col };
        chessValidMoves = getValidMoves(row, col);
        renderBoard();
    } else {
        renderBoard();
    }
}

function isOwnPiece(piece) {
    if (chessMyColor === "white") return piece === piece.toUpperCase();
    return piece === piece.toLowerCase();
}

function isWhitePiece(piece) { return piece && piece === piece.toUpperCase(); }
function isBlackPiece(piece) { return piece && piece === piece.toLowerCase(); }

// --- Move validation (client-side for UI hints) ---
function getValidMoves(row, col) {
    const piece = chessBoard[row][col];
    if (!piece) return [];
    const moves = [];
    const isWhite = isWhitePiece(piece);
    const type = piece.toLowerCase();

    const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
    const isEmpty = (r, c) => inBounds(r, c) && !chessBoard[r][c];
    const isEnemy = (r, c) => {
        if (!inBounds(r, c) || !chessBoard[r][c]) return false;
        return isWhite ? isBlackPiece(chessBoard[r][c]) : isWhitePiece(chessBoard[r][c]);
    };
    const canMove = (r, c) => isEmpty(r, c) || isEnemy(r, c);

    if (type === "p") {
        const dir = isWhite ? -1 : 1;
        const startRow = isWhite ? 6 : 1;
        if (isEmpty(row + dir, col)) {
            moves.push({ row: row + dir, col });
            if (row === startRow && isEmpty(row + 2 * dir, col))
                moves.push({ row: row + 2 * dir, col });
        }
        if (isEnemy(row + dir, col - 1)) moves.push({ row: row + dir, col: col - 1 });
        if (isEnemy(row + dir, col + 1)) moves.push({ row: row + dir, col: col + 1 });
    }

    if (type === "r" || type === "q") {
        for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
            for (let i = 1; i < 8; i++) {
                const r = row + dr * i, c = col + dc * i;
                if (!inBounds(r, c)) break;
                if (isEmpty(r, c)) moves.push({ row: r, col: c });
                else if (isEnemy(r, c)) { moves.push({ row: r, col: c }); break; }
                else break;
            }
        }
    }

    if (type === "b" || type === "q") {
        for (const [dr, dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
            for (let i = 1; i < 8; i++) {
                const r = row + dr * i, c = col + dc * i;
                if (!inBounds(r, c)) break;
                if (isEmpty(r, c)) moves.push({ row: r, col: c });
                else if (isEnemy(r, c)) { moves.push({ row: r, col: c }); break; }
                else break;
            }
        }
    }

    if (type === "n") {
        for (const [dr, dc] of [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]) {
            const r = row + dr, c = col + dc;
            if (inBounds(r, c) && canMove(r, c)) moves.push({ row: r, col: c });
        }
    }

    if (type === "k") {
        for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]) {
            const r = row + dr, c = col + dc;
            if (inBounds(r, c) && canMove(r, c)) moves.push({ row: r, col: c });
        }
    }

    return moves;
}

// --- Timer ---
function startChessTimer() {
    clearInterval(chessTimerInterval);
    chessTimerInterval = setInterval(() => {
        if (chessGameOver) { clearInterval(chessTimerInterval); return; }
        if (chessTurn === "white") chessTimerW--;
        else chessTimerB--;

        updateChessTimerDisplay();

        if (chessTimerW <= 0) {
            chessTimerW = 0;
            socket.emit("chess_timeout", { match_id: chessMatchId, loser: "white" });
            clearInterval(chessTimerInterval);
        }
        if (chessTimerB <= 0) {
            chessTimerB = 0;
            socket.emit("chess_timeout", { match_id: chessMatchId, loser: "black" });
            clearInterval(chessTimerInterval);
        }
    }, 1000);
}

function updateChessTimerDisplay() {
    const fmt = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`;
    const myTime = chessMyColor === "white" ? chessTimerW : chessTimerB;
    const oppTime = chessMyColor === "white" ? chessTimerB : chessTimerW;
    document.getElementById("chess-my-timer").textContent = fmt(myTime);
    document.getElementById("chess-opp-timer").textContent = fmt(oppTime);

    // Highlight active timer
    document.getElementById("chess-my-timer").classList.toggle("timer-active", chessTurn === chessMyColor);
    document.getElementById("chess-opp-timer").classList.toggle("timer-active", chessTurn !== chessMyColor);
}

function updateTurnDisplay() {
    const el = document.getElementById("chess-turn");
    if (chessTurn === chessMyColor) {
        el.textContent = "Your turn";
        el.style.color = "#1B7A1B";
    } else {
        el.textContent = "Opponent's turn";
        el.style.color = "#BE123C";
    }
}

// --- Socket Events ---
socket.on("chess_match_found", (data) => {
    chessMatchId = data.match_id;
    chessMyColor = data.color;
    chessOpponent = data.opponent;
    chessBoard = JSON.parse(JSON.stringify(INITIAL_BOARD));
    chessTurn = "white";
    chessTimerW = 300;
    chessTimerB = 300;
    chessGameOver = false;
    chessSelected = null;
    chessValidMoves = [];

    showChessSection("chess-game");
    document.getElementById("chess-my-name").textContent = `${currentUser} (${chessMyColor})`;
    document.getElementById("chess-opp-name").textContent = `${chessOpponent} (${chessMyColor === "white" ? "black" : "white"})`;

    renderBoard();
    updateChessTimerDisplay();
    updateTurnDisplay();
    startChessTimer();
});

socket.on("chess_move_made", (data) => {
    const { from, to, turn, timerW, timerB } = data;

    // Apply move
    const piece = chessBoard[from.row][from.col];
    chessBoard[to.row][to.col] = piece;
    chessBoard[from.row][from.col] = "";

    // Pawn promotion
    if (piece === "P" && to.row === 0) chessBoard[to.row][to.col] = "Q";
    if (piece === "p" && to.row === 7) chessBoard[to.row][to.col] = "q";

    chessTurn = turn;
    chessTimerW = timerW;
    chessTimerB = timerB;

    chessSelected = null;
    chessValidMoves = [];
    renderBoard();
    updateChessTimerDisplay();
    updateTurnDisplay();
});

socket.on("chess_game_over", (data) => {
    chessGameOver = true;
    clearInterval(chessTimerInterval);

    showChessSection("chess-result");
    let title;
    if (data.winner === currentUser) title = "You Win!";
    else if (data.winner === "draw") title = "Draw!";
    else title = "You Lose!";

    document.getElementById("chess-result-title").textContent = title;
    document.getElementById("chess-result-body").innerHTML = `
        <div class="quiz-stat"><span>${data.white_player} (White)</span><strong>${data.winner === data.white_player ? "Winner" : ""}</strong></div>
        <div class="quiz-stat"><span>${data.black_player} (Black)</span><strong>${data.winner === data.black_player ? "Winner" : ""}</strong></div>
        <div class="quiz-stat"><span>Reason</span><strong>${data.reason || ""}</strong></div>
    `;
});

function resignChess() {
    if (!confirm("Are you sure you want to resign?")) return;
    socket.emit("chess_resign", { match_id: chessMatchId });
}
