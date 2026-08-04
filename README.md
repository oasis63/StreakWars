# ⚔️ StreakWars - LeetCode Challenge Tracker

StreakWars is a customizable LeetCode challenge tracker designed for friends and teams. Track scores, visualize progress with live charts & race views, and enforce gamified rules.

---

## 🐘 PostgreSQL + Docker Compose Architecture

StreakWars uses a production-ready **PostgreSQL 16** database architecture with Docker Compose orchestration.

### Services:
1. **`postgres`**: PostgreSQL 16 database server with persistent volume storage (`postgres-data`).
2. **`backend`**: Node.js Express REST API connected to PostgreSQL.
3. **`frontend`**: Production Nginx container serving React SPA & reverse-proxying `/api/` requests.

---

## 🚀 Quick Start with Docker & Docker Compose

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Running the Application

1. **Clone & Navigate to Project Directory**:
   ```bash
   cd StreakWars
   ```

2. **Build & Start Containers**:
   ```bash
   docker-compose up --build -d
   ```

3. **Access the Web App**:
   - **Frontend UI**: Open [http://localhost:5173](http://localhost:5173) in your browser.
   - **Backend API**: Running on [http://localhost:3001](http://localhost:3001).
   - **PostgreSQL DB**: Port `5432` (`streakwars` / `streakwars_password`).

4. **Stopping Services**:
   ```bash
   docker-compose down
   ```

---

## ⚙️ Scoring System Rules

1. **Fresh Submit**: Solved for the first time during the challenge window $\rightarrow$ Full points (`Easy: 1pt`, `Medium: 3pts`, `Hard: 5pts`).
2. **Resubmit**: Re-submitting a pre-challenge solve $\rightarrow$ Half points (`Easy: 0.5pt`, `Medium: 1.5pts`, `Hard: 2.5pts`).
3. **Re-credited Guard**: Once a problem has been credited to a participant during a challenge, no further points are awarded (`0pts`).
