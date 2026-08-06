// backend/routes/profile.js
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/db');

// GET /api/profile/:userId
router.get('/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        const db = getDb();

        const user = await db.prepare(`SELECT id, name, leetcode_username, color, emoji, created_at FROM users WHERE id = ? AND is_deleted = 0`).get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const stats = await db.prepare(`
            SELECT 
                easy_solved, medium_solved, hard_solved,
                score_raw, score_final, streak_bonus, current_streak,
                longest_streak, on_fire, multiplier_active, reactive_icon,
                badges, last_synced, fresh_solves, resubmit_count,
                fresh_pts, resubmit_pts, sync_status, sync_warning
            FROM user_stats WHERE user_id = ?
        `).get(userId);

        const creditedProblems = await db.prepare(`
            SELECT title_slug, difficulty, credit_type, points_awarded, day_number, credited_at
            FROM credited_problems
            WHERE user_id = ?
            ORDER BY id DESC
        `).all(userId);

        const snapshots = await db.prepare(`
            SELECT date_fetched, total_easy, total_medium, total_hard
            FROM snapshots
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT 50
        `).all(userId);

        let badges = [];
        try {
            badges = stats && stats.badges ? JSON.parse(stats.badges) : [];
        } catch (e) { badges = []; }

        res.json({
            user,
            stats: stats ? {
                easy_solved: parseInt(stats.easy_solved, 10) || 0,
                medium_solved: parseInt(stats.medium_solved, 10) || 0,
                hard_solved: parseInt(stats.hard_solved, 10) || 0,
                fresh_solves: parseInt(stats.fresh_solves, 10) || 0,
                resubmit_count: parseInt(stats.resubmit_count, 10) || 0,
                fresh_pts: parseFloat(stats.fresh_pts) || 0,
                resubmit_pts: parseFloat(stats.resubmit_pts) || 0,
                score_raw: parseFloat(stats.score_raw) || 0,
                score_final: parseFloat(stats.score_final) || 0,
                streak_bonus: parseFloat(stats.streak_bonus) || 0,
                current_streak: parseInt(stats.current_streak, 10) || 0,
                longest_streak: parseInt(stats.longest_streak, 10) || 0,
                on_fire: Boolean(stats.on_fire),
                multiplier_active: Boolean(stats.multiplier_active),
                reactive_icon: stats.reactive_icon || '👤',
                badges: badges,
                last_synced: stats.last_synced,
                sync_status: stats.sync_status || 'verified',
                sync_warning: stats.sync_warning || ''
            } : {},
            credited_problems: creditedProblems.map(p => ({
                ...p,
                points_awarded: parseFloat(p.points_awarded) || 0,
                day_number: parseInt(p.day_number, 10) || 1
            })),
            snapshots: snapshots.map(s => ({
                ...s,
                total_easy: parseInt(s.total_easy, 10) || 0,
                total_medium: parseInt(s.total_medium, 10) || 0,
                total_hard: parseInt(s.total_hard, 10) || 0
            }))
        });
    } catch (err) {
        console.error('Error fetching user profile:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
