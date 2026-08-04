// backend/routes/config.js
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/db');
const { validateUsername } = require('../services/leetcodeApi');
const { syncAllUsers } = require('../services/gameEngine');

// GET /api/config
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const rows = db.prepare(`SELECT key, value FROM config`).all();
        const cfg = {};
        for (const r of rows) {
            cfg[r.key] = r.value;
        }

        if (!cfg.challenge_title) {
            return res.json({ setup_required: true });
        }

        const stakesRow = db.prepare(`SELECT value FROM app_settings WHERE key = 'party_stakes'`).get();
        const partyStakes = stakesRow ? stakesRow.value : 'lowest score buys the party';

        res.json({
            setup_required: false,
            challenge_title: cfg.challenge_title,
            challenge_duration_days: parseInt(cfg.challenge_duration_days, 10) || 30,
            challenge_start_date: cfg.challenge_start_date,
            challenge_end_date: cfg.challenge_end_date,
            party_stakes: partyStakes
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/config/setup
router.post('/setup', async (req, res) => {
    try {
        const { challenge_title, challenge_duration_days, challenge_start_date, party_stakes, users } = req.body;

        if (!challenge_title || !challenge_duration_days || !users || !Array.isArray(users) || users.length === 0) {
            return res.status(400).json({ error: 'Missing required setup fields or users list' });
        }

        // Validate every LeetCode username before creating challenge
        for (let i = 0; i < users.length; i++) {
            const u = users[i];
            const cleanUsername = (u.leetcode_username || '').trim();
            if (!cleanUsername) {
                return res.status(400).json({ error: `Participant #${i + 1} (${u.name}) is missing a LeetCode username.` });
            }
            const isValid = await validateUsername(cleanUsername);
            if (!isValid) {
                return res.status(400).json({ error: `LeetCode username "${cleanUsername}" was not found on LeetCode.` });
            }
        }

        const durationDays = parseInt(challenge_duration_days, 10);
        const startDateStr = challenge_start_date || new Date().toISOString().split('T')[0];

        const startDateObj = new Date(startDateStr);
        const endDateObj = new Date(startDateObj.getTime() + durationDays * 24 * 60 * 60 * 1000);
        const endDateStr = endDateObj.toISOString().split('T')[0];

        const db = getDb();

        db.exec('BEGIN');
        try {
            // Save global config
            const stmtConfig = db.prepare(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`);
            stmtConfig.run('challenge_title', challenge_title);
            stmtConfig.run('challenge_duration_days', String(durationDays));
            stmtConfig.run('challenge_start_date', startDateStr);
            stmtConfig.run('challenge_end_date', endDateStr);

            // Save party stakes
            if (party_stakes) {
                db.prepare(`
                    INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
                `).run('party_stakes', party_stakes.trim());
            }

            const CAR_EMOJIS = ['🏎️', '🚗', '🚙', '🛻', '🚕', '🏎️'];
            const palette = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

            const stmtUser = db.prepare(`
                INSERT INTO users (name, leetcode_username, color, emoji, car_emoji)
                VALUES (?, ?, ?, ?, ?)
            `);

            for (let i = 0; i < users.length; i++) {
                const u = users[i];
                const color = u.color || palette[i % palette.length];
                const emoji = u.emoji || '👤';
                const carEmoji = u.car_emoji || CAR_EMOJIS[i % CAR_EMOJIS.length];
                stmtUser.run(u.name.trim(), u.leetcode_username.trim(), color, emoji, carEmoji);
            }

            db.exec('COMMIT');
        } catch (err) {
            db.exec('ROLLBACK');
            throw err;
        }

        // Trigger background sync
        syncAllUsers().catch(e => console.error('Error during setup sync:', e));

        res.json({
            success: true,
            challenge_title,
            challenge_duration_days: durationDays,
            challenge_start_date: startDateStr,
            challenge_end_date: endDateStr
        });
    } catch (err) {
        console.error('Setup error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
