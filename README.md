# ⚔️ StreakWars - LeetCode Challenge Tracker

StreakWars is a customizable LeetCode challenge tracker designed for friends and teams. Track scores, visualize progress with live charts & race views, enforce gamified rules, and participate in discussion threads.

---

## 🐘 PostgreSQL + Docker Compose Architecture

StreakWars uses a production-ready **PostgreSQL 16** database architecture with Docker Compose orchestration.

### Services Included in Docker Setup:
1. **`postgres`**: PostgreSQL 16 database server (`streakwars_db` on port `5432`).
2. **`adminer`**: Web-based database management GUI on [http://localhost:8080](http://localhost:8080).
3. **`backend`**: Node.js Express REST API connected to local PostgreSQL.
4. **`frontend`**: React SPA (Vite / Nginx) on [http://localhost:5173](http://localhost:5173).

---

## 🚀 Quick Start Options

### Option 1: Live Development Mode (Hot-Reloading & Live Code Mounting)

Use `docker-compose.dev.yml` for local development. Edits in `./backend` or `./frontend` automatically trigger live reloads and Vite HMR!

```bash
# Start all local dev services with live hot-reloading
docker compose -f docker-compose.dev.yml up --build
```

- **Frontend App**: [http://localhost:5173](http://localhost:5173) (Vite HMR)
- **Backend API**: [http://localhost:3001](http://localhost:3001) (`node --watch` live reload)
- **Database GUI (Adminer)**: [http://localhost:8080](http://localhost:8080)
- **PostgreSQL Database**: `localhost:5432` (`User: streakwars`, `Pass: streakwars_password`, `DB: streakwars_db`)

---

### Option 2: Production Container Stack

Run the full production-like containerized stack with Nginx and Express:

```bash
# Build & start full container stack in background
docker compose up --build -d
```

- **Frontend UI**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3001](http://localhost:3001)
- **Database GUI (Adminer)**: [http://localhost:8080](http://localhost:8080)

---

### 🛑 Stopping Services

```bash
# Stop dev environment
docker compose -f docker-compose.dev.yml down

# Stop production stack
docker compose down
```

---

## ⚙️ Scoring System Rules

1. **Fresh Submit**: Solved for the first time during the challenge window $\rightarrow$ Full points (`Easy: 1pt`, `Medium: 3pts`, `Hard: 5pts`).
2. **Resubmit**: Re-submitting a pre-challenge solve $\rightarrow$ Half points (`Easy: 0.5pt`, `Medium: 1.5pts`, `Hard: 2.5pts`).
3. **Re-credited Guard**: Once a problem has been credited to a participant during a challenge, no further points are awarded (`0pts`).
