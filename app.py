import random
import sqlite3
import os
import requests as http_requests
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
from werkzeug.security import generate_password_hash, check_password_hash

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

app = Flask(__name__)
app.config["SECRET_KEY"] = "gameoftears-secret"
socketio = SocketIO(app, cors_allowed_origins="*")

# --- Database Setup ---
DB_PATH = os.path.join(os.path.dirname(__file__), "users.db")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS contributors (
            username TEXT PRIMARY KEY
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS custom_topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course TEXT NOT NULL,
            topic_key TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            icon TEXT DEFAULT 'T',
            color TEXT DEFAULT '#B89AD4',
            created_by TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS custom_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course TEXT NOT NULL,
            topic TEXT NOT NULL,
            name TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            desc_latex TEXT NOT NULL,
            answer TEXT NOT NULL,
            solution_latex TEXT,
            hint TEXT,
            created_by TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS quiz_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            subject TEXT NOT NULL,
            mode TEXT NOT NULL,
            score INTEGER DEFAULT 0,
            total_questions INTEGER DEFAULT 5,
            correct INTEGER DEFAULT 0,
            wrong INTEGER DEFAULT 0,
            time_used INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS online_matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player1 TEXT,
            player2 TEXT,
            subject TEXT,
            player1_score INTEGER DEFAULT 0,
            player2_score INTEGER DEFAULT 0,
            winner TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS practice_solves (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            course TEXT NOT NULL,
            topic TEXT NOT NULL,
            problem_id TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            points INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(username, problem_id)
        )
    """)
    # Seed default contributor
    conn.execute("INSERT OR IGNORE INTO contributors (username) VALUES (?)", ("jeje",))
    conn.commit()
    conn.close()


init_db()

# Store all connected players: {sid: player_data}
players = {}

COLORS = [
    "#e74c3c", "#3498db", "#2ecc71", "#f39c12",
    "#9b59b6", "#1abc9c", "#e67e22", "#e84393",
    "#00cec9", "#fdcb6e", "#6c5ce7", "#ff7675",
]

SPAWN_RANGE = 50
MAP_SIZE = 200


def random_spawn():
    spots = [(0, 0), (0, 55), (0, -55), (55, 0), (-55, 0),
             (25, 0), (-25, 0), (0, 25), (0, -25)]
    s = random.choice(spots)
    return {"x": s[0] + random.uniform(-3, 3), "y": 1.0, "z": s[1] + random.uniform(-3, 3)}


def create_player(sid):
    pos = random_spawn()
    return {
        "id": sid,
        "username": f"Player_{sid[:5]}",
        "color": random.choice(COLORS),
        "character": "default",
        "x": pos["x"],
        "y": pos["y"],
        "z": pos["z"],
        "ry": 0,
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"ok": False, "error": "Username and password required"}), 400
    if len(username) > 20:
        return jsonify({"ok": False, "error": "Username too long (max 20)"}), 400
    if len(password) < 3:
        return jsonify({"ok": False, "error": "Password too short (min 3)"}), 400

    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, generate_password_hash(password)),
        )
        conn.commit()
        is_contrib = conn.execute(
            "SELECT 1 FROM contributors WHERE username = ?", (username,)
        ).fetchone() is not None
        return jsonify({"ok": True, "username": username, "role": "contributor" if is_contrib else "user"})
    except sqlite3.IntegrityError:
        return jsonify({"ok": False, "error": "Username already taken"}), 409
    finally:
        conn.close()


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"ok": False, "error": "Username and password required"}), 400

    conn = sqlite3.connect(DB_PATH)
    row = conn.execute(
        "SELECT username, password_hash FROM users WHERE username = ?", (username,)
    ).fetchone()

    if not row:
        conn.close()
        return jsonify({"ok": False, "error": "User not found. Please sign up first."}), 404

    if not check_password_hash(row[1], password):
        conn.close()
        return jsonify({"ok": False, "error": "Wrong password."}), 401

    is_contrib = conn.execute(
        "SELECT 1 FROM contributors WHERE username = ?", (username,)
    ).fetchone() is not None
    conn.close()
    return jsonify({"ok": True, "username": row[0], "role": "contributor" if is_contrib else "user"})


@app.route("/verify", methods=["POST"])
def verify():
    """Check if a username exists (for auto-login from localStorage)."""
    data = request.get_json()
    username = (data.get("username") or "").strip()
    if not username:
        return jsonify({"ok": False}), 400
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute("SELECT username FROM users WHERE username = ?", (username,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"ok": False}), 404
    is_contrib = conn.execute("SELECT 1 FROM contributors WHERE username = ?", (username,)).fetchone() is not None
    conn.close()
    return jsonify({"ok": True, "username": row[0], "role": "contributor" if is_contrib else "user"})


@app.route("/api/custom-topics", methods=["GET"])
def get_custom_topics():
    course = request.args.get("course", "mata37")
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT id, course, topic_key, title, description, icon, color, created_by FROM custom_topics WHERE course = ?",
        (course,)
    ).fetchall()
    conn.close()
    topics = []
    for r in rows:
        topics.append({
            "id": r[0], "course": r[1], "topic_key": r[2], "title": r[3],
            "description": r[4] or "", "icon": r[5] or "T", "color": r[6] or "#B89AD4",
            "created_by": r[7],
        })
    return jsonify({"ok": True, "topics": topics})


@app.route("/api/custom-topics", methods=["POST"])
def add_custom_topic():
    data = request.get_json()
    username = (data.get("username") or "").strip()

    conn = sqlite3.connect(DB_PATH)
    is_contrib = conn.execute(
        "SELECT 1 FROM contributors WHERE username = ?", (username,)
    ).fetchone() is not None
    if not is_contrib:
        conn.close()
        return jsonify({"ok": False, "error": "Only contributors can add topics."}), 403

    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    icon = (data.get("icon") or title[0:1].upper() if title else "T").strip()
    color = (data.get("color") or "#B89AD4").strip()
    course = (data.get("course") or "mata37").strip()
    topic_key = "custom_" + title.lower().replace(" ", "_")

    if not title:
        conn.close()
        return jsonify({"ok": False, "error": "Title is required."}), 400

    try:
        conn.execute(
            "INSERT INTO custom_topics (course, topic_key, title, description, icon, color, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (course, topic_key, title, description, icon, color, username),
        )
        conn.commit()
        conn.close()
        return jsonify({"ok": True, "topic_key": topic_key})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"ok": False, "error": "Topic already exists."}), 409


@app.route("/api/custom-topics/<int:tid>", methods=["DELETE"])
def delete_custom_topic(tid):
    data = request.get_json()
    username = (data.get("username") or "").strip()

    conn = sqlite3.connect(DB_PATH)
    is_contrib = conn.execute(
        "SELECT 1 FROM contributors WHERE username = ?", (username,)
    ).fetchone() is not None
    if not is_contrib:
        conn.close()
        return jsonify({"ok": False, "error": "Only contributors can delete topics."}), 403

    # Get topic_key before deleting
    row = conn.execute("SELECT topic_key FROM custom_topics WHERE id = ?", (tid,)).fetchone()
    if row:
        conn.execute("DELETE FROM custom_questions WHERE topic = ?", (row[0],))
    conn.execute("DELETE FROM custom_topics WHERE id = ?", (tid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/custom-questions", methods=["GET"])
def get_custom_questions():
    course = request.args.get("course", "mata37")
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT id, course, topic, name, difficulty, desc_latex, answer, solution_latex, hint, created_by FROM custom_questions WHERE course = ?",
        (course,)
    ).fetchall()
    conn.close()
    questions = []
    for r in rows:
        questions.append({
            "id": f"custom_{r[0]}", "course": r[1], "topic": r[2],
            "name": r[3], "difficulty": r[4], "descLatex": r[5],
            "answer": r[6], "solutionLatex": r[7] or "", "hint": r[8] or "",
            "created_by": r[9],
        })
    return jsonify({"ok": True, "questions": questions})


@app.route("/api/custom-questions", methods=["POST"])
def add_custom_question():
    data = request.get_json()
    username = (data.get("username") or "").strip()

    # Check contributor
    conn = sqlite3.connect(DB_PATH)
    is_contrib = conn.execute(
        "SELECT 1 FROM contributors WHERE username = ?", (username,)
    ).fetchone() is not None

    if not is_contrib:
        conn.close()
        return jsonify({"ok": False, "error": "Only contributors can add questions."}), 403

    name = (data.get("name") or "").strip()
    difficulty = (data.get("difficulty") or "EASY").strip().upper()
    desc_latex = (data.get("descLatex") or "").strip()
    answer = (data.get("answer") or "").strip()
    solution_latex = (data.get("solutionLatex") or "").strip()
    hint = (data.get("hint") or "").strip()
    course = (data.get("course") or "mata37").strip()
    topic = (data.get("topic") or "integration").strip()

    if not name or not desc_latex:
        conn.close()
        return jsonify({"ok": False, "error": "Name and description are required."}), 400

    conn.execute(
        "INSERT INTO custom_questions (course, topic, name, difficulty, desc_latex, answer, solution_latex, hint, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (course, topic, name, difficulty, desc_latex, answer, solution_latex, hint, username),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/custom-questions/<int:qid>", methods=["DELETE"])
def delete_custom_question(qid):
    data = request.get_json()
    username = (data.get("username") or "").strip()

    conn = sqlite3.connect(DB_PATH)
    is_contrib = conn.execute(
        "SELECT 1 FROM contributors WHERE username = ?", (username,)
    ).fetchone() is not None

    if not is_contrib:
        conn.close()
        return jsonify({"ok": False, "error": "Only contributors can delete questions."}), 403

    conn.execute("DELETE FROM custom_questions WHERE id = ?", (qid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/practice-solve", methods=["POST"])
def practice_solve():
    data = request.get_json()
    username = (data.get("username") or "").strip()
    problem_id = (data.get("problem_id") or "").strip()
    course = (data.get("course") or "").strip()
    topic = (data.get("topic") or "").strip()
    difficulty = (data.get("difficulty") or "EASY").strip().upper()
    points = {"EASY": 100, "MEDIUM": 200, "HARD": 400}.get(difficulty, 100)

    if not username or not problem_id:
        return jsonify({"ok": False}), 400

    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            "INSERT OR IGNORE INTO practice_solves (username, course, topic, problem_id, difficulty, points) VALUES (?, ?, ?, ?, ?, ?)",
            (username, course, topic, problem_id, difficulty, points)
        )
        conn.commit()
    except:
        pass
    conn.close()
    return jsonify({"ok": True, "points": points})


@app.route("/api/leaderboard", methods=["GET"])
def leaderboard():
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT username, SUM(points) as total FROM practice_solves GROUP BY username ORDER BY total DESC LIMIT 20"
    ).fetchall()
    conn.close()
    return jsonify({"ok": True, "leaderboard": [{"username": r[0], "points": r[1]} for r in rows]})


@app.route("/api/get-solution", methods=["POST"])
def get_solution():
    """Pre-fetch AI solution for a question (called in background while user works)."""
    data = request.get_json()
    subject = data.get("subject", "mata37")
    problem = data.get("problem", "")
    name = data.get("name", "")
    signature = data.get("signature", "")

    if subject == "mata37":
        prompt = f"""Solve this calculus problem step by step. Show your work using LaTeX (wrap math in $...$).

Problem: {problem}

Give:
1. The final answer
2. Brief step-by-step solution"""
    else:
        prompt = f"""Write the correct C implementation for this function.

Function: {name}
{f'Signature: {signature}' if signature else ''}
Description: {problem}

Give the complete correct code."""

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        resp = http_requests.post(url, json={"contents": [{"parts": [{"text": prompt}]}]}, timeout=20)
        resp_data = resp.json()
        if "candidates" in resp_data and len(resp_data["candidates"]) > 0:
            text = resp_data["candidates"][0]["content"]["parts"][0]["text"]
            return jsonify({"ok": True, "solution": text})
        return jsonify({"ok": False, "error": "No response"}), 500
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/quick-check", methods=["POST"])
def quick_check():
    """Fast check using pre-fetched solution — compares student answer against known solution."""
    data = request.get_json()
    subject = data.get("subject", "mata37")
    problem = data.get("problem", "")
    answer = data.get("answer", "")
    solution = data.get("solution", "")

    if subject == "mata37":
        prompt = f"""You are a strict calculus grader. Compare the student's answer to the correct solution.

Problem: {problem}
Correct solution: {solution}
Student's answer: {answer}

Reply with ONLY CORRECT or WRONG on the first line.
Then one sentence explaining why. Use $...$ for math."""
    else:
        prompt = f"""You are a strict C grader. Compare the student's code to the correct solution.

Correct solution: {solution}
Student's code:
```c
{answer}
```

Reply with ONLY CORRECT or WRONG on the first line.
Then one sentence explaining why."""

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        resp = http_requests.post(url, json={"contents": [{"parts": [{"text": prompt}]}]}, timeout=15)
        resp_data = resp.json()
        if "candidates" in resp_data and len(resp_data["candidates"]) > 0:
            text = resp_data["candidates"][0]["content"]["parts"][0]["text"]
            return jsonify({"ok": True, "response": text})
        return jsonify({"ok": False, "error": "No response"}), 500
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/check-math", methods=["POST"])
def check_math():
    data = request.get_json()
    problem = data.get("problem", "")
    answer = data.get("answer", "")

    prompt = f"""You are a strict calculus grader. A student answered this math problem:

Problem (in LaTeX): {problem}

Student's answer (in LaTeX): {answer}

Your response MUST start with exactly one of these two words on the first line:
CORRECT
or
WRONG

Then on the next line, give a brief explanation (2-3 sentences max).
If WRONG, show what the correct answer should be.
If CORRECT, confirm it.

IMPORTANT: When showing math expressions in your explanation, always wrap them in dollar signs like $\frac{{x^3}}{{3}} + C$ so they render as LaTeX.

Accept equivalent forms (e.g. x^3/3 and (1/3)x^3 are the same).
Do NOT be lenient on mathematical errors."""

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        resp = http_requests.post(url, json={
            "contents": [{"parts": [{"text": prompt}]}]
        }, timeout=15)
        resp_data = resp.json()
        if "candidates" in resp_data and len(resp_data["candidates"]) > 0:
            candidate = resp_data["candidates"][0]
            if "content" in candidate and "parts" in candidate["content"]:
                text = candidate["content"]["parts"][0]["text"]
                return jsonify({"ok": True, "response": text})
        if "error" in resp_data:
            return jsonify({"ok": False, "error": resp_data["error"].get("message", str(resp_data["error"]))}), 500
        return jsonify({"ok": False, "error": "Unexpected AI response"}), 500
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/check-code", methods=["POST"])
def check_code():
    data = request.get_json()
    code = data.get("code", "")
    problem_name = data.get("problem_name", "")
    description = data.get("description", "")
    signature = data.get("signature", "")

    prompt = f"""You are a C programming grader for a university course. A student wrote code for this problem:

Function: {problem_name}
Description: {description}
Signature: {signature}

Student's code:
```c
{code}
```

Your response MUST start with exactly one of these two words on the first line:
CORRECT
or
WRONG

Then on the next line, give a brief explanation (2-3 sentences max).

IMPORTANT GRADING RULES:
- Mark CORRECT if the core logic and algorithm is right
- Do NOT mark wrong for missing malloc NULL checks — that is not required
- Do NOT mark wrong for missing #include statements
- Do NOT mark wrong for minor style issues
- Only mark WRONG if the logic is actually incorrect or would produce wrong results
- Focus on: correct algorithm, proper pointer manipulation, correct return values

Example response format:
CORRECT
Your implementation correctly allocates a new node and inserts it at the head by updating the head pointer.

or:

WRONG
You forgot to allocate memory for the new node using malloc. Also, you are not updating the head pointer correctly."""

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        resp = http_requests.post(url, json={
            "contents": [{"parts": [{"text": prompt}]}]
        }, timeout=15)
        resp_data = resp.json()

        # Debug: log the full response structure
        print("Gemini response keys:", list(resp_data.keys()))

        # Handle various response formats
        if "candidates" in resp_data and len(resp_data["candidates"]) > 0:
            candidate = resp_data["candidates"][0]
            if "content" in candidate and "parts" in candidate["content"]:
                text = candidate["content"]["parts"][0]["text"]
                return jsonify({"ok": True, "response": text})
            else:
                return jsonify({"ok": False, "error": f"Unexpected candidate format: {candidate.keys()}"}), 500
        elif "error" in resp_data:
            return jsonify({"ok": False, "error": resp_data["error"].get("message", str(resp_data["error"]))}), 500
        else:
            return jsonify({"ok": False, "error": f"Unexpected response: {str(resp_data)[:200]}"}), 500
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


# ==========================================
# QUIZ — Question Bank + API + Socket.IO
# ==========================================
import json

QUIZ_QUESTIONS = {
    "csca48": [
        {"id":"q_ll1","name":"insert_at_head()","difficulty":"EASY","description":"Write a function that inserts a new node at the HEAD of a linked list.","signature":"void insert_at_head(Node **head, int val)","starterCode":"void insert_at_head(Node **head, int val) {\n\n}"},
        {"id":"q_ll2","name":"insert_at_tail()","difficulty":"EASY","description":"Insert a new node at the END of a linked list.","signature":"void insert_at_tail(Node **head, int val)","starterCode":"void insert_at_tail(Node **head, int val) {\n\n}"},
        {"id":"q_ll3","name":"delete_node()","difficulty":"MEDIUM","description":"Remove the first node whose data matches a given value.","signature":"void delete_node(Node **head, int val)","starterCode":"void delete_node(Node **head, int val) {\n\n}"},
        {"id":"q_ll4","name":"reverse_list()","difficulty":"HARD","description":"Reverse the linked list in-place (no new nodes).","signature":"void reverse_list(Node **head)","starterCode":"void reverse_list(Node **head) {\n\n}"},
        {"id":"q_ll5","name":"list_length()","difficulty":"EASY","description":"Count and return the number of nodes in the list.","signature":"int list_length(Node *head)","starterCode":"int list_length(Node *head) {\n\n}"},
        {"id":"q_ll6","name":"has_loop()","difficulty":"HARD","description":"Detect if a linked list has a cycle using Floyd's algorithm.","signature":"int has_loop(Node *head)","starterCode":"int has_loop(Node *head) {\n\n}"},
        {"id":"q_ll7","name":"find_middle()","difficulty":"MEDIUM","description":"Find the middle node using two pointers in one pass.","signature":"Node* find_middle(Node *head)","starterCode":"Node* find_middle(Node *head) {\n\n}"},
        {"id":"q_bst1","name":"BST_insert()","difficulty":"MEDIUM","description":"Recursively insert a key into a BST.","signature":"BSTNode* BST_insert(BSTNode *root, int key)","starterCode":"BSTNode* BST_insert(BSTNode *root, int key) {\n\n}"},
        {"id":"q_bst2","name":"BST_search()","difficulty":"EASY","description":"Recursively search for a key in a BST.","signature":"BSTNode* BST_search(BSTNode *root, int key)","starterCode":"BSTNode* BST_search(BSTNode *root, int key) {\n\n}"},
        {"id":"q_bst3","name":"BST_height()","difficulty":"MEDIUM","description":"Compute the height of a BST recursively.","signature":"int BST_height(BSTNode *root)","starterCode":"int BST_height(BSTNode *root) {\n\n}"},
        {"id":"q_bst4","name":"BST_delete()","difficulty":"HARD","description":"Delete a key handling all 3 cases.","signature":"BSTNode* BST_delete(BSTNode *root, int key)","starterCode":"BSTNode* BST_delete(BSTNode *root, int key) {\n\n}"},
        {"id":"q_rec1","name":"factorial()","difficulty":"EASY","description":"Compute n! recursively.","signature":"int factorial(int n)","starterCode":"int factorial(int n) {\n\n}"},
        {"id":"q_rec2","name":"fibonacci()","difficulty":"MEDIUM","description":"Compute the nth Fibonacci number recursively.","signature":"int fibonacci(int n)","starterCode":"int fibonacci(int n) {\n\n}"},
        {"id":"q_rec3","name":"power()","difficulty":"EASY","description":"Compute base^exp recursively.","signature":"int power(int base, int exp)","starterCode":"int power(int base, int exp) {\n\n}"},
        {"id":"q_rec4","name":"is_palindrome()","difficulty":"MEDIUM","description":"Check if a string is a palindrome using recursion.","signature":"int is_palindrome(char *s, int left, int right)","starterCode":"int is_palindrome(char *s, int left, int right) {\n\n}"},
    ],
    "mata37": [
        {"id":"q_m1","name":"Basic Integral","difficulty":"EASY","descLatex":"\\text{Evaluate: } \\int x^2 \\, dx","answer":"\\frac{x^3}{3} + C"},
        {"id":"q_m2","name":"U-Substitution","difficulty":"MEDIUM","descLatex":"\\text{Evaluate: } \\int 2x \\cos(x^2) \\, dx","answer":"\\sin(x^2) + C"},
        {"id":"q_m3","name":"Integration by Parts","difficulty":"MEDIUM","descLatex":"\\text{Evaluate: } \\int x e^x \\, dx","answer":"e^x(x-1) + C"},
        {"id":"q_m4","name":"Partial Fractions","difficulty":"HARD","descLatex":"\\text{Evaluate: } \\int \\frac{1}{(x-1)(x+2)} \\, dx","answer":"\\frac{1}{3}\\ln\\left|\\frac{x-1}{x+2}\\right| + C"},
        {"id":"q_m5","name":"Trig Substitution","difficulty":"HARD","descLatex":"\\text{Evaluate: } \\int \\frac{1}{\\sqrt{1-x^2}} \\, dx","answer":"\\arcsin(x) + C"},
        {"id":"q_m6","name":"Definite Integral","difficulty":"EASY","descLatex":"\\text{Evaluate: } \\int_0^2 3x^2 \\, dx","answer":"8"},
        {"id":"q_m7","name":"Improper Integral","difficulty":"HARD","descLatex":"\\text{Evaluate: } \\int_1^{\\infty} \\frac{1}{x^2} \\, dx","answer":"1"},
        {"id":"q_m8","name":"Area Between Curves","difficulty":"MEDIUM","descLatex":"\\text{Area between } y=x^2 \\text{ and } y=x \\text{ from } x=0 \\text{ to } x=1.","answer":"\\frac{1}{6}"},
        {"id":"q_m9","name":"Volume of Revolution","difficulty":"HARD","descLatex":"\\text{Volume when } y=\\sqrt{x} \\text{ revolved around x-axis, } x=0 \\text{ to } x=4.","answer":"8\\pi"},
        {"id":"q_m10","name":"Trig Integrals","difficulty":"MEDIUM","descLatex":"\\text{Evaluate: } \\int \\sin^2(x) \\, dx","answer":"\\frac{x}{2} - \\frac{\\sin(2x)}{4} + C"},
    ]
}


@app.route("/api/quiz-questions", methods=["GET"])
def quiz_questions():
    subject = request.args.get("subject", "mata37")
    count = int(request.args.get("count", 5))
    questions = list(QUIZ_QUESTIONS.get(subject, []))

    # Also include custom questions for mata37
    if subject == "mata37":
        conn = sqlite3.connect(DB_PATH)
        rows = conn.execute("SELECT id, name, difficulty, desc_latex, answer FROM custom_questions WHERE course = 'mata37'").fetchall()
        conn.close()
        for r in rows:
            questions.append({"id": f"cq_{r[0]}", "name": r[1], "difficulty": r[2], "descLatex": r[3], "answer": r[4]})

    random.shuffle(questions)
    return jsonify({"ok": True, "questions": questions[:count], "subject": subject})


@app.route("/api/quiz-results", methods=["POST"])
def save_quiz_result():
    data = request.get_json()
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO quiz_results (username, subject, mode, score, total_questions, correct, wrong, time_used) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (data.get("username"), data.get("subject"), data.get("mode", "offline"),
         data.get("score", 0), data.get("total_questions", 5),
         data.get("correct", 0), data.get("wrong", 0), data.get("time_used", 0))
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# Quiz online matchmaking state
quiz_waiting = {}  # subject -> [{sid, username}]
quiz_matches = {}  # match_id -> {player1_sid, player2_sid, subject, questions, scores, current_q, ...}
quiz_match_counter = [0]


@socketio.on("quiz_join_waiting")
def on_quiz_join_waiting(data):
    sid = request.sid
    subject = data.get("subject", "mata37")
    username = data.get("username", "Player")

    if subject not in quiz_waiting:
        quiz_waiting[subject] = []

    # Don't add duplicates
    for p in quiz_waiting[subject]:
        if p["sid"] == sid:
            return

    quiz_waiting[subject].append({"sid": sid, "username": username})
    print(f"[Quiz] {username} waiting for {subject} match ({len(quiz_waiting[subject])} waiting)")

    # Check if we have 2 players
    if len(quiz_waiting[subject]) >= 2:
        p1 = quiz_waiting[subject].pop(0)
        p2 = quiz_waiting[subject].pop(0)

        quiz_match_counter[0] += 1
        match_id = f"match_{quiz_match_counter[0]}"

        # Get questions
        questions = list(QUIZ_QUESTIONS.get(subject, []))
        if subject == "mata37":
            conn = sqlite3.connect(DB_PATH)
            rows = conn.execute("SELECT id, name, difficulty, desc_latex, answer FROM custom_questions WHERE course = 'mata37'").fetchall()
            conn.close()
            for r in rows:
                questions.append({"id": f"cq_{r[0]}", "name": r[1], "difficulty": r[2], "descLatex": r[3], "answer": r[4]})
        random.shuffle(questions)
        match_questions = questions[:5]

        quiz_matches[match_id] = {
            "p1_sid": p1["sid"], "p2_sid": p2["sid"],
            "p1_name": p1["username"], "p2_name": p2["username"],
            "subject": subject, "questions": match_questions,
            "p1_score": 0, "p2_score": 0,
            "current_q": 0, "solved": [False] * 5,
        }

        match_data = {
            "match_id": match_id,
            "questions": match_questions,
            "opponent": None,
        }

        match_data["opponent"] = p2["username"]
        emit("quiz_match_found", match_data, to=p1["sid"])

        match_data["opponent"] = p1["username"]
        emit("quiz_match_found", match_data, to=p2["sid"])

        print(f"[Quiz] Match {match_id}: {p1['username']} vs {p2['username']}")


@socketio.on("quiz_leave_waiting")
def on_quiz_leave_waiting(data):
    sid = request.sid
    subject = data.get("subject", "")
    if subject in quiz_waiting:
        quiz_waiting[subject] = [p for p in quiz_waiting[subject] if p["sid"] != sid]


@socketio.on("quiz_submit_answer")
def on_quiz_submit_answer(data):
    sid = request.sid
    match_id = data.get("match_id")
    q_idx = data.get("question_idx", 0)
    answer = data.get("answer", "")

    if match_id not in quiz_matches:
        return

    match = quiz_matches[match_id]
    if match["solved"][q_idx]:
        emit("quiz_already_solved", {"question_idx": q_idx})
        return

    question = match["questions"][q_idx]
    subject = match["subject"]

    # Check answer with Gemini
    if subject == "mata37":
        prompt = f"""You are a strict calculus grader. Problem (LaTeX): {question.get('descLatex', question.get('name', ''))}
Student answer (LaTeX): {answer}
Reply with ONLY the word CORRECT or WRONG on the first line. Then a one-sentence explanation."""
    else:
        prompt = f"""You are a strict C programming grader. Problem: {question.get('description', question.get('name', ''))}
Signature: {question.get('signature', '')}
Student code:
```c
{answer}
```
Reply with ONLY the word CORRECT or WRONG on the first line. Then a one-sentence explanation."""

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        resp = http_requests.post(url, json={"contents": [{"parts": [{"text": prompt}]}]}, timeout=20)
        resp_data = resp.json()
        if "candidates" in resp_data and len(resp_data["candidates"]) > 0:
            ai_text = resp_data["candidates"][0]["content"]["parts"][0]["text"].strip()
        elif "error" in resp_data:
            print(f"[Quiz AI Error] {resp_data['error'].get('message', resp_data['error'])}")
            ai_text = "ERROR\nAI service unavailable. Try again."
        else:
            ai_text = "ERROR\nUnexpected AI response."
    except Exception as e:
        print(f"[Quiz AI Exception] {e}")
        ai_text = "ERROR\nCould not reach AI service."

    is_correct = ai_text.upper().startswith("CORRECT")
    is_error = ai_text.upper().startswith("ERROR")

    # If AI failed, don't penalize — let player retry
    if is_error:
        emit("quiz_wrong_answer", {
            "question_idx": q_idx,
            "penalty": 0,
            "p1_score": match["p1_score"],
            "p2_score": match["p2_score"],
            "ai_response": ai_text.replace("ERROR\n", ""),
        }, to=sid)
        return

    # Determine which player
    is_p1 = (sid == match["p1_sid"])
    difficulty = question.get("difficulty", "EASY").upper()
    points = {"EASY": 100, "MEDIUM": 200, "HARD": 400}.get(difficulty, 100)

    if is_correct:
        match["solved"][q_idx] = True
        if is_p1:
            match["p1_score"] += points
        else:
            match["p2_score"] += points

        # Broadcast to both players
        result = {
            "question_idx": q_idx,
            "solver": match["p1_name"] if is_p1 else match["p2_name"],
            "points": points,
            "p1_score": match["p1_score"],
            "p2_score": match["p2_score"],
            "ai_response": ai_text,
        }
        emit("quiz_question_solved", result, to=match["p1_sid"])
        emit("quiz_question_solved", result, to=match["p2_sid"])

        # Check if all questions done
        if all(match["solved"]) or match["current_q"] >= 4:
            end_match(match_id)
    else:
        # Wrong answer
        penalty = -100
        if is_p1:
            match["p1_score"] += penalty
        else:
            match["p2_score"] += penalty

        emit("quiz_wrong_answer", {
            "question_idx": q_idx,
            "penalty": penalty,
            "p1_score": match["p1_score"],
            "p2_score": match["p2_score"],
            "ai_response": ai_text,
        }, to=sid)


@socketio.on("quiz_time_up")
def on_quiz_time_up(data):
    match_id = data.get("match_id")
    q_idx = data.get("question_idx", 0)

    if match_id not in quiz_matches:
        return

    match = quiz_matches[match_id]
    if not match["solved"][q_idx]:
        match["solved"][q_idx] = True
        match["current_q"] = q_idx + 1

        emit("quiz_next_question", {
            "question_idx": q_idx + 1,
            "p1_score": match["p1_score"],
            "p2_score": match["p2_score"],
        }, to=match["p1_sid"])
        emit("quiz_next_question", {
            "question_idx": q_idx + 1,
            "p1_score": match["p1_score"],
            "p2_score": match["p2_score"],
        }, to=match["p2_sid"])

        if q_idx >= 4:
            end_match(match_id)


@socketio.on("quiz_quit")
def on_quiz_quit(data):
    sid = request.sid
    match_id = data.get("match_id")
    if match_id not in quiz_matches:
        return
    match = quiz_matches[match_id]
    is_p1 = sid == match["p1_sid"]
    winner = match["p2_name"] if is_p1 else match["p1_name"]
    other_sid = match["p2_sid"] if is_p1 else match["p1_sid"]
    other_score = match["p2_score"] if is_p1 else match["p1_score"]

    # Save match
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO online_matches (player1, player2, subject, player1_score, player2_score, winner) VALUES (?, ?, ?, ?, ?, ?)",
        (match["p1_name"], match["p2_name"], match["subject"], match["p1_score"], match["p2_score"], winner)
    )
    conn.commit()
    conn.close()

    emit("quiz_opponent_quit", {"your_score": other_score, "winner": winner}, to=other_sid)
    del quiz_matches[match_id]


def end_match(match_id):
    if match_id not in quiz_matches:
        return
    match = quiz_matches[match_id]

    if match["p1_score"] > match["p2_score"]:
        winner = match["p1_name"]
    elif match["p2_score"] > match["p1_score"]:
        winner = match["p2_name"]
    else:
        winner = "draw"

    # Save to DB
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO online_matches (player1, player2, subject, player1_score, player2_score, winner) VALUES (?, ?, ?, ?, ?, ?)",
        (match["p1_name"], match["p2_name"], match["subject"], match["p1_score"], match["p2_score"], winner)
    )
    conn.commit()
    conn.close()

    result = {
        "match_id": match_id,
        "p1_name": match["p1_name"], "p2_name": match["p2_name"],
        "p1_score": match["p1_score"], "p2_score": match["p2_score"],
        "winner": winner,
    }
    emit("quiz_match_end", result, to=match["p1_sid"])
    emit("quiz_match_end", result, to=match["p2_sid"])
    del quiz_matches[match_id]


# ==========================================
# CHESS — Multiplayer
# ==========================================
chess_waiting = []  # [{sid, username}]
chess_matches = {}  # match_id -> {w_sid, b_sid, w_name, b_name, turn, timerW, timerB, board}
chess_match_counter = [0]


@socketio.on("chess_join_waiting")
def on_chess_join_waiting(data):
    sid = request.sid
    username = data.get("username", "Player")

    for p in chess_waiting:
        if p["sid"] == sid:
            return

    chess_waiting.append({"sid": sid, "username": username})
    print(f"[Chess] {username} waiting ({len(chess_waiting)} waiting)")

    if len(chess_waiting) >= 2:
        p1 = chess_waiting.pop(0)
        p2 = chess_waiting.pop(0)

        chess_match_counter[0] += 1
        mid = f"chess_{chess_match_counter[0]}"

        # Randomly assign colors
        if random.random() < 0.5:
            p1, p2 = p2, p1

        chess_matches[mid] = {
            "w_sid": p1["sid"], "b_sid": p2["sid"],
            "w_name": p1["username"], "b_name": p2["username"],
            "turn": "white", "timerW": 300, "timerB": 300,
        }

        emit("chess_match_found", {
            "match_id": mid, "color": "white", "opponent": p2["username"]
        }, to=p1["sid"])

        emit("chess_match_found", {
            "match_id": mid, "color": "black", "opponent": p1["username"]
        }, to=p2["sid"])

        print(f"[Chess] Match {mid}: {p1['username']}(W) vs {p2['username']}(B)")


@socketio.on("chess_leave_waiting")
def on_chess_leave_waiting():
    sid = request.sid
    global chess_waiting
    chess_waiting = [p for p in chess_waiting if p["sid"] != sid]


@socketio.on("chess_move")
def on_chess_move(data):
    sid = request.sid
    mid = data.get("match_id")
    if mid not in chess_matches:
        return

    match = chess_matches[mid]
    fr = data.get("from")
    to = data.get("to")

    # Verify it's the right player's turn
    if match["turn"] == "white" and sid != match["w_sid"]:
        return
    if match["turn"] == "black" and sid != match["b_sid"]:
        return

    # Switch turn
    match["turn"] = "black" if match["turn"] == "white" else "white"

    move_data = {
        "from": fr, "to": to,
        "turn": match["turn"],
        "timerW": match["timerW"],
        "timerB": match["timerB"],
    }

    emit("chess_move_made", move_data, to=match["w_sid"])
    emit("chess_move_made", move_data, to=match["b_sid"])

    # Check if a king was captured (simple checkmate detection)
    # Client sends the move, we trust it. King capture = game over.


@socketio.on("chess_timeout")
def on_chess_timeout(data):
    mid = data.get("match_id")
    if mid not in chess_matches:
        return
    match = chess_matches[mid]
    loser_color = data.get("loser")
    winner = match["b_name"] if loser_color == "white" else match["w_name"]

    result = {
        "winner": winner,
        "white_player": match["w_name"],
        "black_player": match["b_name"],
        "reason": "Time ran out",
    }
    emit("chess_game_over", result, to=match["w_sid"])
    emit("chess_game_over", result, to=match["b_sid"])
    del chess_matches[mid]


@socketio.on("chess_resign")
def on_chess_resign(data):
    mid = data.get("match_id")
    if mid not in chess_matches:
        return
    match = chess_matches[mid]
    sid = request.sid
    winner = match["b_name"] if sid == match["w_sid"] else match["w_name"]

    result = {
        "winner": winner,
        "white_player": match["w_name"],
        "black_player": match["b_name"],
        "reason": "Resignation",
    }
    emit("chess_game_over", result, to=match["w_sid"])
    emit("chess_game_over", result, to=match["b_sid"])
    del chess_matches[mid]


@socketio.on("connect")
def on_connect():
    sid = request.sid
    player = create_player(sid)
    players[sid] = player

    # Send self data + all players who are already in the game
    emit("init", {"self": player, "players": {k: v for k, v in players.items() if v.get("in_game")}})
    print(f"[+] {player['username']} connected ({len(players)} sockets)")


@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid
    # Remove from chess waiting/matches
    global chess_waiting
    chess_waiting = [p for p in chess_waiting if p["sid"] != sid]
    for mid, m in list(chess_matches.items()):
        if sid == m["w_sid"] or sid == m["b_sid"]:
            winner = m["b_name"] if sid == m["w_sid"] else m["w_name"]
            other = m["b_sid"] if sid == m["w_sid"] else m["w_sid"]
            emit("chess_game_over", {
                "winner": winner, "white_player": m["w_name"],
                "black_player": m["b_name"], "reason": "Opponent disconnected",
            }, to=other)
            del chess_matches[mid]
            break

    # Remove from quiz waiting
    for subj in quiz_waiting:
        quiz_waiting[subj] = [p for p in quiz_waiting[subj] if p["sid"] != sid]

    # Handle quiz match disconnect — opponent wins by default
    for mid, m in list(quiz_matches.items()):
        if sid == m["p1_sid"] or sid == m["p2_sid"]:
            is_p1 = sid == m["p1_sid"]
            winner = m["p2_name"] if is_p1 else m["p1_name"]
            other_sid = m["p2_sid"] if is_p1 else m["p1_sid"]
            emit("quiz_match_end", {
                "match_id": mid, "p1_name": m["p1_name"], "p2_name": m["p2_name"],
                "p1_score": m["p1_score"], "p2_score": m["p2_score"],
                "winner": winner, "reason": "opponent disconnected",
            }, to=other_sid)
            del quiz_matches[mid]
            break

    # Remove from meeting if in it
    if sid in meeting_participants:
        meeting_participants.pop(sid)
        emit("meeting_user_left", {"id": sid}, broadcast=True)
    player = players.pop(sid, None)
    if player:
        emit("player_left", {"id": sid}, broadcast=True)
        print(f"[-] {player['username']} disconnected ({len(players)} players)")


@socketio.on("request_players")
def on_request_players():
    """Client calls this when scene is ready to get all in-game players."""
    sid = request.sid
    in_game_players = {k: v for k, v in players.items() if v.get("in_game") and k != sid}
    emit("sync_players", {"players": in_game_players})


@socketio.on("set_username")
def on_set_username(data):
    sid = request.sid
    if sid in players:
        new_name = data.get("username", "").strip()[:20]
        character = data.get("character", "default")
        if new_name:
            was_in_game = players[sid].get("in_game", False)
            players[sid]["username"] = new_name
            players[sid]["character"] = character
            players[sid]["in_game"] = True

            if not was_in_game:
                # First time entering game — broadcast player_joined to everyone in game
                emit("player_joined", players[sid], broadcast=True, include_self=False)

            emit(
                "player_updated",
                {"id": sid, "username": new_name, "character": character},
                broadcast=True,
            )
            emit(
                "chat_message",
                {
                    "username": "Server",
                    "message": f"{new_name} joined the game",
                    "color": "#95a5a6",
                },
                broadcast=True,
            )


@socketio.on("player_move")
def on_player_move(data):
    sid = request.sid
    if sid in players:
        players[sid]["x"] = data.get("x", 0)
        players[sid]["y"] = data.get("y", 1)
        players[sid]["z"] = data.get("z", 0)
        players[sid]["ry"] = data.get("ry", 0)
        emit(
            "player_moved",
            {
                "id": sid,
                "x": players[sid]["x"],
                "y": players[sid]["y"],
                "z": players[sid]["z"],
                "ry": players[sid]["ry"],
            },
            broadcast=True,
            include_self=False,
        )


# ==========================================
# MEETING ROOM — WebRTC Signaling
# ==========================================
meeting_participants = {}  # {sid: username}


@socketio.on("join_meeting")
def on_join_meeting():
    sid = request.sid
    if sid not in players:
        return
    username = players[sid]["username"]
    # Tell the joiner who is already in the meeting
    emit("meeting_participants", {
        "participants": {k: v for k, v in meeting_participants.items()}
    })
    # Add to meeting
    meeting_participants[sid] = username
    # Tell everyone else
    emit("meeting_user_joined", {"id": sid, "username": username},
         broadcast=True, include_self=False)
    print(f"[Meeting] {username} joined ({len(meeting_participants)} in meeting)")


@socketio.on("leave_meeting")
def on_leave_meeting():
    sid = request.sid
    if sid in meeting_participants:
        username = meeting_participants.pop(sid)
        emit("meeting_user_left", {"id": sid}, broadcast=True)
        print(f"[Meeting] {username} left ({len(meeting_participants)} in meeting)")


@socketio.on("webrtc_offer")
def on_webrtc_offer(data):
    emit("webrtc_offer", {"from": request.sid, "offer": data["offer"]},
         to=data["to"])


@socketio.on("webrtc_answer")
def on_webrtc_answer(data):
    emit("webrtc_answer", {"from": request.sid, "answer": data["answer"]},
         to=data["to"])


@socketio.on("webrtc_ice")
def on_webrtc_ice(data):
    emit("webrtc_ice", {"from": request.sid, "candidate": data["candidate"]},
         to=data["to"])


@socketio.on("chat_message")
def on_chat_message(data):
    sid = request.sid
    if sid not in players:
        return
    message = data.get("message", "").strip()[:200]
    if message:
        emit(
            "chat_message",
            {
                "username": players[sid]["username"],
                "message": message,
                "color": players[sid]["color"],
            },
            broadcast=True,
        )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("RENDER") is None
    print("=== UTSC Connect Server ===")
    print(f"Running on port {port}")
    socketio.run(app, host="0.0.0.0", port=port, debug=debug, allow_unsafe_werkzeug=True)
