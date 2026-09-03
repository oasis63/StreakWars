const express = require('express');
const router = express.Router();
const { getDb } = require('../db/db');

router.get('/', async (req, res) => {
    try {
        const challengeId = parseInt(req.query.challenge_id, 10);
        const db = getDb();
        if (!challengeId) {
            const users = await db.prepare(`
                SELECT id, name, leetcode_username, color, emoji, car_emoji, created_at
                FROM users WHERE is_deleted = 0
                ORDER BY id ASC
            `).all();
            return res.json({ users });
        }
        const users = await db.prepare(`
            SELECT m.user_id as id, m.name, m.leetcode_username, m.color, m.emoji, m.car_emoji, m.created_at
            FROM challenge_members m
            WHERE m.challenge_id = ? AND m.removed_at IS NULL
            ORDER BY m.id ASC
        `).all(challengeId);
        res.json({ users });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
