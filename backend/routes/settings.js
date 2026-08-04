// backend/routes/settings.js
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/db');
const { validateUsername, getUserStats } = require('../services/leetcodeApi');
const { syncUser, recomputeAllStats } = require('../services/gameEngine');

// POST /api/settings/users (Add user mid-challenge)
router.post('/users', async (req, res) => {
    try {
        const { name, leetcode_username, color, emoji, car_emoji } = req.body;
        if (!name || !leetcode_username || !leetcode_username.trim()) {
            return res.status(400).json({ error: 'Name and LeetCode username are required' });
        }

        const cleanUsername = leetcode_username.trim();
        const cleanName = name.trim();
        const userColor = color || '#6366f1';
        const userEmoji = emoji || '👤';
        const userCar = car_emoji || '🏎️';

        const isValid = await validateUsername(cleanUsername);
        if (!isValid) {
            return res.status(400).json({ error: `LeetCode username "${cleanUsername}" does not exist on LeetCode.` });
        }

        const db = getDb();
        const existing = db.prepare(`SELECT id, is_deleted FROM users WHERE leetcode_username = ?`).get(cleanUsername);

        let userId = null;
        if (existing) {
            if (existing.is_deleted) {
                db.prepare(`UPDATE users SET is_deleted = 0, name = ?, color = ?, emoji = ?, car_emoji = ? WHERE id = ?`)
                  .run(cleanName, userColor, userEmoji, userCar, existing.id);
                userId = existing.id;
            } else {
                return res.status(400).json({ error: 'User already exists in active challenge' });
            }
        } else {
            const result = db.prepare(`
                INSERT INTO users (name, leetcode_username, color, emoji, car_emoji)
                VALUES (?, ?, ?, ?, ?)
            `).run(cleanName, cleanUsername, userColor, userEmoji, userCar);
            userId = result.lastInsertRowid;
        }

        const initialStats = await getUserStats(cleanUsername);
        const nowIso = new Date().toISOString();
        db.prepare(`
            INSERT INTO snapshots (user_id, date_fetched, total_easy, total_medium, total_hard)
            VALUES (?, ?, ?, ?, ?)
        `).run(userId, nowIso, initialStats.easy, initialStats.medium, initialStats.hard);

        await syncUser(userId);
        recomputeAllStats();

        res.json({ success: true, message: `Added ${cleanName} to challenge`, userId });
    } catch (err) {
        console.error('Error adding user:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/settings/users/:userId (Soft delete user)
router.delete('/users/:userId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        const db = getDb();
        db.prepare(`UPDATE users SET is_deleted = 1 WHERE id = ?`).run(userId);
        recomputeAllStats();
        res.json({ success: true, message: 'User removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/settings/stakes (Update party stakes)
router.post('/stakes', (req, res) => {
    try {
        const { party_stakes } = req.body;
        if (!party_stakes || typeof party_stakes !== 'string') {
            return res.status(400).json({ error: 'Party stakes text is required' });
        }

        const db = getDb();

        db.exec('BEGIN');
        try {
            const currentSettings = db.prepare(`SELECT key, value FROM app_settings`).all();
            const snapshotObj = {};
            for (const s of currentSettings) snapshotObj[s.key] = s.value;

            db.prepare(`INSERT INTO scoring_config_history (snapshot) VALUES (?)`)
              .run(JSON.stringify(snapshotObj));

            db.prepare(`
                INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            `).run('party_stakes', partyStakes.trim());

            db.exec('COMMIT');
        } catch (err) {
            db.exec('ROLLBACK');
            throw err;
        }

        res.json({ success: true, party_stakes: party_stakes.trim() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/settings/delete-challenge (Permanently delete challenge & clear DB)
router.post('/delete-challenge', (req, res) => {
    try {
        const db = getDb();
        db.exec('BEGIN');
        try {
            db.prepare(`DELETE FROM credited_problems`).run();
            db.prepare(`DELETE FROM processed_submissions`).run();
            db.prepare(`DELETE FROM snapshots`).run();
            db.prepare(`DELETE FROM user_stats`).run();
            db.prepare(`DELETE FROM users`).run();
            db.prepare(`DELETE FROM config`).run();
            db.prepare(`DELETE FROM app_settings`).run();
            db.prepare(`DELETE FROM scoring_config_history`).run();
            db.exec('COMMIT');
        } catch (err) {
            db.exec('ROLLBACK');
            throw err;
        }
        res.json({ success: true, message: 'Challenge deleted successfully' });
    } catch (err) {
        console.error('Error deleting challenge:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/settings/export (CSV export)
router.get('/export', (req, res) => {
    try {
        const db = getDb();
        const rows = db.prepare(`
            SELECT 
                u.name, u.leetcode_username, s.score_final, s.score_raw, s.easy_solved,
                s.medium_solved, s.hard_solved, s.fresh_solves, s.resubmit_count,
                s.current_streak, s.longest_streak, s.badges
            FROM users u
            LEFT JOIN user_stats s ON u.id = s.user_id
            WHERE u.is_deleted = 0
            ORDER BY COALESCE(s.score_final, 0) DESC
        `).all();

        let csv = 'Name,LeetCode Username,Final Score,Raw Score,Easy Solved,Medium Solved,Hard Solved,Fresh Solves,Resubmit Solves,Current Streak,Longest Streak,Badges\n';

        for (const r of rows) {
            let badgesStr = '';
            try { badgesStr = (JSON.parse(r.badges) || []).join(' '); } catch (e) {}

            csv += `"${r.name}","${r.leetcode_username}",${r.score_final || 0},${r.score_raw || 0},${r.easy_solved || 0},${r.medium_solved || 0},${r.hard_solved || 0},${r.fresh_solves || 0},${r.resubmit_count || 0},${r.current_streak || 0},${r.longest_streak || 0},"${badgesStr}"\n`;
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="streakwars_leaderboard.csv"');
        res.status(200).send(csv);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
