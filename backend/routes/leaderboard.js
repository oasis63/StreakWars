// backend/routes/leaderboard.js
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/db');
const { getCurrentChallengeDay, recomputeAllStats } = require('../services/gameEngine');

// GET /api/leaderboard
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const cfgRows = db.prepare(`SELECT key, value FROM config`).all();
        const cfg = {};
        for (const r of cfgRows) cfg[r.key] = r.value;

        if (!cfg.challenge_title) {
            return res.json({ setup_required: true });
        }

        try {
            recomputeAllStats();
        } catch (e) {
            console.error('Leaderboard recompute notice:', e.message);
        }

        const durationDays = parseInt(cfg.challenge_duration_days, 10) || 30;
        const currentDay = getCurrentChallengeDay();
        const daysRemaining = Math.max(0, durationDays - currentDay + 1);
        const challengeEnded = currentDay > durationDays;

        const stakesRow = db.prepare(`SELECT value FROM app_settings WHERE key = 'party_stakes'`).get();
        const partyStakes = stakesRow ? stakesRow.value : 'lowest score buys the party';

        const usersWithStats = db.prepare(`
            SELECT 
                u.id as user_id, u.name, u.leetcode_username, u.color, u.emoji, COALESCE(u.car_emoji, '🏎️') as car_emoji,
                s.easy_solved, s.medium_solved, s.hard_solved, s.fresh_solves, s.resubmit_count,
                s.fresh_pts, s.resubmit_pts,
                s.score_raw, s.score_final, s.streak_bonus, s.current_streak, s.longest_streak,
                s.on_fire, s.multiplier_active, s.reactive_icon, s.badges, s.last_synced
            FROM users u
            LEFT JOIN user_stats s ON u.id = s.user_id
            WHERE u.is_deleted = 0
            ORDER BY COALESCE(s.score_final, 0) DESC, s.easy_solved DESC
        `).all();

        const leaderboard = usersWithStats.map((u, index) => {
            let badges = [];
            try {
                badges = u.badges ? JSON.parse(u.badges) : [];
            } catch (e) { badges = []; }

            const isLast = index === usersWithStats.length - 1 && usersWithStats.length > 1;

            let lastSyncedFormatted = 'Just now';
            if (u.last_synced) {
                const dt = new Date(u.last_synced);
                const monthName = dt.toLocaleString('en-US', { month: 'short' });
                const dayNum = dt.getDate();
                const timeStr = dt.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                lastSyncedFormatted = `${monthName} ${dayNum}, ${timeStr}`;
            }

            return {
                user_id: u.user_id,
                name: u.name,
                leetcode_username: u.leetcode_username,
                color: u.color || '#10b981',
                emoji: u.emoji || '👤',
                car_emoji: u.car_emoji || '🏎️',
                easy_solved: u.easy_solved || 0,        // ONLY fresh Easy solves
                medium_solved: u.medium_solved || 0,    // ONLY fresh Medium solves
                hard_solved: u.hard_solved || 0,        // ONLY fresh Hard solves
                fresh_solves: u.fresh_solves || 0,
                resubmit_count: u.resubmit_count || 0,
                fresh_pts: u.fresh_pts || 0,
                resubmit_pts: u.resubmit_pts || 0,
                score_raw: u.score_raw || 0,
                score_final: u.score_final || 0,
                streak_bonus: u.streak_bonus || 0,
                current_streak: u.current_streak || 0,
                longest_streak: u.longest_streak || 0,
                on_fire: Boolean(u.on_fire),
                multiplier_active: Boolean(u.multiplier_active),
                reactive_icon: u.reactive_icon || '👤',
                badges: badges,
                last_synced: u.last_synced,
                last_synced_formatted: lastSyncedFormatted,
                rank: index + 1,
                is_last_place: isLast
            };
        });

        const maxChartDays = Math.min(currentDay, durationDays);

        const creditedRows = db.prepare(`
            SELECT user_id, day_number, difficulty, credit_type, COUNT(*) as count
            FROM credited_problems
            GROUP BY user_id, day_number, difficulty
        `).all();

        const manhattanMap = {};
        for (let d = 1; d <= maxChartDays; d++) {
            manhattanMap[d] = { day: `Day ${d}` };
            for (const u of leaderboard) {
                manhattanMap[d][`${u.user_id}_easy`] = 0;
                manhattanMap[d][`${u.user_id}_med`] = 0;
                manhattanMap[d][`${u.user_id}_hard`] = 0;
                manhattanMap[d][`${u.user_id}_total`] = 0;
            }
        }

        for (const row of creditedRows) {
            const d = row.day_number;
            if (d >= 1 && d <= maxChartDays) {
                const diffKey = (row.difficulty || '').toLowerCase();
                const uId = row.user_id;
                if (manhattanMap[d]) {
                    if (diffKey === 'easy') manhattanMap[d][`${uId}_easy`] += row.count;
                    if (diffKey === 'medium') manhattanMap[d][`${uId}_med`] += row.count;
                    if (diffKey === 'hard') manhattanMap[d][`${uId}_hard`] += row.count;
                    manhattanMap[d][`${uId}_total`] += row.count;
                }
            }
        }

        const manhattan_data = Object.values(manhattanMap);

        const allCreditedForWorm = db.prepare(`
            SELECT user_id, day_number, points_awarded
            FROM credited_problems
            ORDER BY day_number ASC
        `).all();

        const wormMap = {};
        for (let d = 1; d <= maxChartDays; d++) {
            wormMap[d] = { day: `Day ${d}` };
            for (const u of leaderboard) {
                wormMap[d][u.user_id] = 0;
            }
        }

        const userCumulativeScore = {};
        for (const u of leaderboard) userCumulativeScore[u.user_id] = 0;

        for (let d = 1; d <= maxChartDays; d++) {
            const dayCredits = allCreditedForWorm.filter(c => c.day_number === d);
            for (const c of dayCredits) {
                if (userCumulativeScore[c.user_id] !== undefined) {
                    userCumulativeScore[c.user_id] += c.points_awarded;
                }
            }
            for (const u of leaderboard) {
                wormMap[d][u.user_id] = Math.round(userCumulativeScore[u.user_id] * 10) / 10;
            }
        }

        const worm_data = Object.values(wormMap);

        res.json({
            setup_required: false,
            challenge_title: cfg.challenge_title,
            challenge_duration_days: durationDays,
            challenge_start_date: cfg.challenge_start_date,
            challenge_end_date: cfg.challenge_end_date,
            current_day: currentDay,
            days_remaining: daysRemaining,
            challenge_ended: challengeEnded,
            party_stakes: partyStakes,
            leaderboard,
            manhattan_data,
            worm_data
        });
    } catch (err) {
        console.error('Error fetching leaderboard:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
