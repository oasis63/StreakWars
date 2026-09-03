const express = require('express');
const router = express.Router();
const { getDb } = require('../db/db');
const { requireAuth, requireSuperadmin } = require('../middleware/auth');
const {
    archiveChallenge,
    deleteChallenge,
    setMemberRole,
    serializeChallenge,
    refreshAllChallengeStatuses
} = require('../services/challengeService');
const { allowUserChallengeCreate, setAllowUserChallengeCreate } = require('../services/siteSettings');

router.use(requireAuth, requireSuperadmin);

router.get('/overview', async (req, res) => {
    try {
        await refreshAllChallengeStatuses();
        const db = getDb();
        const users = await db.prepare(`
            SELECT id, name, username, display_name, leetcode_username, avatar_emoji, avatar_color, is_superadmin, created_at, is_deleted
            FROM users
            WHERE is_deleted = 0
            ORDER BY id ASC
        `).all();
        const challenges = await db.prepare(`
            SELECT c.*,
                (SELECT COUNT(*) FROM challenge_members m WHERE m.challenge_id = c.id AND m.removed_at IS NULL) AS member_count
            FROM challenges c
            ORDER BY c.id DESC
        `).all();
        const counts = {
            users: users.length,
            challenges: challenges.length,
            active: challenges.filter((c) => c.status === 'active').length,
            scheduled: challenges.filter((c) => c.status === 'scheduled').length,
            completed: challenges.filter((c) => c.status === 'completed').length,
            archived: challenges.filter((c) => c.status === 'archived').length,
            superadmins: users.filter((u) => u.is_superadmin).length
        };
        const memberRows = await db.prepare(`
            SELECT challenge_id, user_id, role, name, leetcode_username, color, emoji
            FROM challenge_members
            WHERE removed_at IS NULL
            ORDER BY id ASC
        `).all();
        const membersByChallenge = {};
        for (const m of memberRows) {
            if (!membersByChallenge[m.challenge_id]) membersByChallenge[m.challenge_id] = [];
            membersByChallenge[m.challenge_id].push(m);
        }
        res.json({
            counts,
            settings: {
                allow_user_challenge_create: await allowUserChallengeCreate()
            },
            users,
            challenges: challenges.map((c) => serializeChallenge(c, {
                member_count: parseInt(c.member_count, 10) || 0,
                members: membersByChallenge[c.id] || []
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/users/:userId/memberships', async (req, res) => {
    try {
        const db = getDb();
        const rows = await db.prepare(`
            SELECT c.id, c.title, c.status, m.role, m.leetcode_username
            FROM challenge_members m
            JOIN challenges c ON c.id = m.challenge_id
            WHERE m.user_id = ? AND m.removed_at IS NULL
            ORDER BY c.id DESC
        `).all(parseInt(req.params.userId, 10));
        res.json({ memberships: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/users/:userId/superadmin', async (req, res) => {
    try {
        const db = getDb();
        const isSuper = req.body.is_superadmin ? 1 : 0;
        const targetId = parseInt(req.params.userId, 10);
        if (!isSuper && targetId === req.user.id) {
            return res.status(400).json({ error: 'You cannot remove your own superadmin access.' });
        }
        await db.prepare(`UPDATE users SET is_superadmin = ? WHERE id = ?`).run(isSuper, targetId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/challenges/:challengeId/admins/:userId', async (req, res) => {
    try {
        const role = req.body.role === 'participant' ? 'participant' : 'admin';
        await setMemberRole(parseInt(req.params.challengeId, 10), parseInt(req.params.userId, 10), role);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/challenges/:challengeId/archive', async (req, res) => {
    try {
        const challenge = await archiveChallenge(parseInt(req.params.challengeId, 10), { force: true });
        res.json({ success: true, challenge: serializeChallenge(challenge) });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/settings/allow-create', async (req, res) => {
    try {
        const enabled = await setAllowUserChallengeCreate(Boolean(req.body.allow_user_challenge_create));
        res.json({ success: true, allow_user_challenge_create: enabled });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/challenges/:challengeId', async (req, res) => {
    try {
        await deleteChallenge(parseInt(req.params.challengeId, 10));
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
