# UTSC Connect

A multiplayer learning platform built for University of Toronto Scarborough students.

## Features

### Uconnect (3D Multiplayer World)
- First-person 3D world with buildings, trees, roads, and a park
- Real-time multiplayer — see and interact with other players
- Proximity voice chat — talk to nearby players automatically
- Park meeting room — video call (Google Meet-style) using WebRTC
- 12 character styles to choose from

### Practice
- **CSCA48** — Linked List, BST, and Recursion coding challenges in C
- **MATA37** — Integration problems with LaTeX input
- AI-powered answer checking via Google Gemini
- Hint and solution for every problem
- Contributors can add new topics and questions

### Quiz
- **Offline mode** — 5 random questions, 10-minute timer, AI grading
- **Online mode** — 1v1 multiplayer race with per-question timers
- Scoring: EASY +100, MEDIUM +200, HARD +400, Wrong -100
- Real-time matchmaking via WebSocket

### Games
- **Chess** — Full multiplayer chess with 5-minute timer per player

### Leaderboard
- Practice points from solving questions across all courses
- Top 20 rankings on the home page

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Flask + Flask-SocketIO |
| Frontend | HTML, CSS, JavaScript |
| 3D Engine | Three.js |
| Database | SQLite |
| Video/Voice | WebRTC |
| AI Grading | Google Gemini API |
| Real-time | Socket.IO (WebSocket) |
| Math Rendering | KaTeX |

## Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Run the server
python app.py

# Open in browser
# http://localhost:5000
```

## Roles

- **User** — can access all features, solve problems, play games
- **Contributor** — can also add/delete topics and questions in MATA37

## Environment

- Python 3.10+
- Gemini API key (set in `app.py`)

## Authors

Built by Jason Sidharta with Claude AI.
