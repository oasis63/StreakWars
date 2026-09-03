const express = require('express');
const router = express.Router();
const { getDb } = require('../db/db');
const { requireAuth, requireChallengeAdmin } = require('../middleware/auth');
const { addMember, removeMember, deleteChallenge } = require('../services/challengeService');
const { validateUsername } = require('../services/leetcodeApi');

router.post('/users', requireAuth, async (req, res) => {
    try {
        const challengeId = parseInt(req.body.challenge_id, 10);
        if (!challengeId) return res.status(400).json({ error: 'challenge_id is required' });
        req.params.challengeId = String(challengeId);
        req.challengeId = challengeId;
        return requireChallengeAdmin(req, res, async () => {
            const { name, leetcode_username, color, emoji, car_emoji } = req.body;
            if (!name || !leetcode_username) {
                return res.status(400).json({ error: 'Name and LeetCode username are required' });
            }
            const ok = await validateUsername(leetcode_username.trim());
            if (!ok) return res.status(400).json({ error: 'LeetCode username was not found.' });
            const userId = await addMember({
                challengeId,
                name: name.trim(),
                leetcodeUsername: leetcode_username.trim(),
                color, emoji, car_emoji
            });
            res.json({ success: true, userId });
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/users/:userId', requireAuth, async (req, res) => {
    try {
        const challengeId = parseInt(req.query.challenge_id || req.body.challenge_id, 10);
        if (!challengeId) return res.status(400).json({ error: 'challenge_id is required' });
        req.params.challengeId = String(challengeId);
        req.challengeId = challengeId;
        return requireChallengeAdmin(req, res, async () => {
            await removeMember(challengeId, parseInt(req.params.userId, 10));
            res.json({ success: true });
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/delete-challenge', requireAuth, async (req, res) => {
    try {
        const challengeId = parseInt(req.body.challenge_id, 10);
        if (!challengeId) return res.status(400).json({ error: 'challenge_id is required' });
        req.params.challengeId = String(challengeId);
        req.challengeId = challengeId;
        return requireChallengeAdmin(req, res, async () => {
            await deleteChallenge(challengeId);
            res.json({ success: true, message: 'Challenge deleted' });
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/export', async (req, res) => {
    try {
        const challengeId = parseInt(req.query.challenge_id, 10);
        const db = getDb();
        const rows = await db.prepare(`
            SELECT
                m.name, m.leetcode_username, s.score_final, s.score_raw, s.easy_solved,
                s.medium_solved, s.hard_solved, s.fresh_solves, s.resubmit_count,
                s.current_streak, s.longest_streak, s.badges
            FROM challenge_members m
            LEFT JOIN user_stats s ON s.user_id = m.user_id AND s.challenge_id = m.challenge_id
            WHERE m.challenge_id = ? AND m.removed_at IS NULL
            ORDER BY COALESCE(s.score_final, 0) DESC
        `).all(challengeId);

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
