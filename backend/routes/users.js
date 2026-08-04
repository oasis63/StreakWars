// backend/routes/users.js
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/db');

// GET /api/users
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const users = db.prepare(`
            SELECT id, name, leetcode_username, color, emoji, created_at
            FROM users
            WHERE is_deleted = 0
            ORDER BY id ASC
        `).all();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
