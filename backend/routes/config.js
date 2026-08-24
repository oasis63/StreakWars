// backend/routes/config.js
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/db');
const { validateUsername, getUserStats } = require('../services/leetcodeApi');
const { syncAllUsers, getChallengeStartMs } = require('../services/gameEngine');
const { PLAYER_PALETTE } = require('../utils/playerColors');

function getIstDateString(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const value = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
    return `${value.year}-${value.month}-${value.day}`;
}

// GET /api/config
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        const rows = await db.prepare(`SELECT key, value FROM config`).all();
        const cfg = {};
        for (const r of rows) {
            cfg[r.key] = r.value;
        }

        if (!cfg.challenge_title) {
            return res.json({ setup_required: true });
        }

        const stakesRow = await db.prepare(`SELECT value FROM app_settings WHERE key = 'party_stakes'`).get();
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
        const startDateStr = challenge_start_date || getIstDateString();

        if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) {
            return res.status(400).json({ error: 'Challenge duration must be between 1 and 365 days.' });
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) || Number.isNaN(getChallengeStartMs(startDateStr))) {
            return res.status(400).json({ error: 'Challenge start date must be a valid YYYY-MM-DD date.' });
        }
        if (startDateStr <= getIstDateString()) {
            return res.status(400).json({
                error: 'For fair public-data scoring, choose a challenge start date after today so participant baselines can be captured first.'
            });
        }

        const startDateObj = new Date(startDateStr);
        // A duration of one starts and ends on the same calendar day.
        const endDateObj = new Date(startDateObj.getTime() + (durationDays - 1) * 24 * 60 * 60 * 1000);
        const endDateStr = endDateObj.toISOString().split('T')[0];

        const db = getDb();

        const stmtConfig = `
            INSERT INTO config (key, value) VALUES (?, ?)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        `;

        await db.prepare(stmtConfig).run('challenge_title', challenge_title);
        await db.prepare(stmtConfig).run('challenge_duration_days', String(durationDays));
        await db.prepare(stmtConfig).run('challenge_start_date', startDateStr);
        await db.prepare(stmtConfig).run('challenge_end_date', endDateStr);

        if (party_stakes) {
            await db.prepare(`
                INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
            `).run('party_stakes', party_stakes.trim());
        }

        const CAR_EMOJIS = ['🏎️', '🚗', '🚙', '🛻', '🚕', '🏎️'];

        const stmtUser = `
            INSERT INTO users (name, leetcode_username, color, emoji, car_emoji)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (leetcode_username) DO UPDATE SET name = EXCLUDED.name, is_deleted = 0
        `;

        for (let i = 0; i < users.length; i++) {
            const u = users[i];
            const color = u.color || PLAYER_PALETTE[i % PLAYER_PALETTE.length];
            const emoji = u.emoji || '👤';
            const carEmoji = u.car_emoji || CAR_EMOJIS[i % CAR_EMOJIS.length];
            await db.prepare(stmtUser).run(u.name.trim(), u.leetcode_username.trim(), color, emoji, carEmoji);

            const participant = await db.prepare(`SELECT id FROM users WHERE leetcode_username = ?`).get(u.leetcode_username.trim());
            const baseline = await getUserStats(u.leetcode_username.trim());
            const capturedAt = new Date().toISOString();
            await db.prepare(`
                INSERT INTO challenge_baselines (
                    user_id, challenge_start_date, captured_at, total_easy, total_medium, total_hard
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    challenge_start_date = EXCLUDED.challenge_start_date,
                    captured_at = EXCLUDED.captured_at,
                    total_easy = EXCLUDED.total_easy,
                    total_medium = EXCLUDED.total_medium,
                    total_hard = EXCLUDED.total_hard
            `).run(participant.id, startDateStr, capturedAt, baseline.easy, baseline.medium, baseline.hard);
            await db.prepare(`
                INSERT INTO snapshots (user_id, date_fetched, total_easy, total_medium, total_hard)
                VALUES (?, ?, ?, ?, ?)
            `).run(participant.id, capturedAt, baseline.easy, baseline.medium, baseline.hard);
            await db.prepare(`
                INSERT INTO user_stats (user_id, sync_status, sync_warning)
                VALUES (?, 'verified', '')
                ON CONFLICT(user_id) DO UPDATE SET sync_status = 'verified', sync_warning = ''
            `).run(participant.id);
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
