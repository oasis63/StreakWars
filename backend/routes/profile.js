// backend/routes/profile.js
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/db');

// GET /api/profile/:userId
router.get('/:userId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const db = getDb();
        const user = db.prepare(`
            SELECT u.id, u.name, u.leetcode_username, u.color, u.emoji, u.created_at,
                   s.easy_solved, s.medium_solved, s.hard_solved, s.fresh_solves, s.resubmit_count,
                   s.score_raw, s.score_final, s.streak_bonus, s.current_streak, s.longest_streak,
                   s.on_fire, s.multiplier_active, s.reactive_icon, s.badges, s.last_synced
            FROM users u
            LEFT JOIN user_stats s ON u.id = s.user_id
            WHERE u.id = ? AND u.is_deleted = 0
        `).get(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let badges = [];
        try {
            badges = user.badges ? JSON.parse(user.badges) : [];
        } catch (e) { badges = []; }

        // Fetch credited problems log
        const creditedProblems = db.prepare(`
            SELECT title_slug, difficulty, credit_type, points_awarded, day_number, credited_at
            FROM credited_problems
            WHERE user_id = ?
            ORDER BY day_number DESC, id DESC
        `).all(userId);

        // Fetch snapshot history
        const snapshots = db.prepare(`
            SELECT date_fetched, total_easy, total_medium, total_hard
            FROM snapshots
            WHERE user_id = ?
            ORDER BY id ASC
        `).all(userId);

        res.json({
            user: {
                id: user.id,
                name: user.name,
                leetcode_username: user.leetcode_username,
                color: user.color,
                emoji: user.emoji,
                created_at: user.created_at
            },
            stats: {
                easy_solved: user.easy_solved || 0,
                medium_solved: user.medium_solved || 0,
                hard_solved: user.hard_solved || 0,
                fresh_solves: user.fresh_solves || 0,
                resubmit_count: user.resubmit_count || 0,
                score_raw: user.score_raw || 0,
                score_final: user.score_final || 0,
                streak_bonus: user.streak_bonus || 0,
                current_streak: user.current_streak || 0,
                longest_streak: user.longest_streak || 0,
                on_fire: Boolean(user.on_fire),
                multiplier_active: Boolean(user.multiplier_active),
                reactive_icon: user.reactive_icon || '👤',
                badges,
                last_synced: user.last_synced
            },
            credited_problems: creditedProblems,
            snapshots
        });
    } catch (err) {
        console.error('Error fetching profile:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
