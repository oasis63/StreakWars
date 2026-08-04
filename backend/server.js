// backend/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const { initDb } = require('./db/db');
const { startCron } = require('./services/cron');

const configRouter = require('./routes/config');
const leaderboardRouter = require('./routes/leaderboard');
const syncRouter = require('./routes/sync');
const usersRouter = require('./routes/users');
const profileRouter = require('./routes/profile');
const settingsRouter = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/config', configRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/sync', syncRouter);
app.use('/api/users', usersRouter);
app.use('/api/profile', profileRouter);
app.use('/api/settings', settingsRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
    await initDb();
    startCron();
    app.listen(PORT, () => {
        console.log(`🚀 StreakWars backend server listening on http://localhost:${PORT}`);
    });
}

startServer();
