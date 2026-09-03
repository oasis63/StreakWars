const express = require('express');
const router = express.Router();
const { validateUsername } = require('../services/leetcodeApi');
const { optionalAuth, requireAuth, requireChallengeAdmin } = require('../middleware/auth');
const { buildLeaderboardPayload, syncChallenge } = require('../services/gameEngine');
const {
    listPublicHomeChallenges,
    listChallengesForUser,
    getChallengeById,
    getChallengeByInvite,
    createChallenge,
    addMember,
    removeMember,
    userRole,
    archiveChallenge,
    deleteArchivedChallenge,
    updateChallenge,
    updateMember,
    regenerateInviteCode,
    serializeChallenge
} = require('../services/challengeService');

function authHeadersUser(req) {
    return req.user || null;
}

router.get('/', optionalAuth, async (req, res) => {
    try {
        const rows = await listPublicHomeChallenges();
        res.json({
            challenges: rows.map((c) => {
                const row = serializeChallenge(c, { member_count: parseInt(c.member_count, 10) || 0 });
                delete row.invite_code;
                return row;
            })
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/mine', requireAuth, async (req, res) => {
    try {
        const rows = await listChallengesForUser(req.user);
        res.json({
            challenges: rows.map((c) => serializeChallenge(c))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', requireAuth, async (req, res) => {
    try {
        const { challenge_title, title, challenge_duration_days, duration_days, challenge_start_date, start_date, party_stakes, users } = req.body;
        const list = Array.isArray(users) ? users : [];
        for (let i = 0; i < list.length; i++) {
            const handle = (list[i].leetcode_username || '').trim();
            if (!handle) {
                return res.status(400).json({ error: `Participant #${i + 1} is missing a LeetCode username.` });
            }
            const ok = await validateUsername(handle);
            if (!ok) {
                return res.status(400).json({ error: `LeetCode username "${handle}" was not found on LeetCode.` });
            }
        }
        const challenge = await createChallenge({
            title: challenge_title || title,
            durationDays: challenge_duration_days || duration_days,
            startDate: challenge_start_date || start_date,
            partyStakes: party_stakes,
            users: list,
            creator: req.user
        });
        res.status(201).json({ success: true, challenge: serializeChallenge(challenge, { my_role: 'admin' }) });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/invite/:code', optionalAuth, async (req, res) => {
    try {
        const challenge = await getChallengeByInvite(req.params.code);
        if (!challenge) return res.status(404).json({ error: 'Invite code not found.' });
        const role = await userRole(challenge, authHeadersUser(req));
        res.json({ challenge: serializeChallenge(challenge, { my_role: role }) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/join', requireAuth, async (req, res) => {
    try {
        const { invite_code, leetcode_username, name } = req.body;
        const challenge = await getChallengeByInvite(invite_code);
        if (!challenge) return res.status(404).json({ error: 'Invite code not found.' });
        const handle = (leetcode_username || req.user.leetcode_username || req.user.username || '').replace(/^@/, '').trim();
        if (!handle) return res.status(400).json({ error: 'LeetCode username is required to join.' });
        const ok = await validateUsername(handle);
        if (!ok) return res.status(400).json({ error: `LeetCode username "${handle}" was not found on LeetCode.` });
        await addMember({
            challengeId: challenge.id,
            name: (name || req.user.display_name || req.user.name || handle).trim(),
            leetcodeUsername: handle,
            role: 'participant',
            userId: req.user.id
        });
        res.json({ success: true, challenge_id: challenge.id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/:challengeId/leaderboard', optionalAuth, async (req, res) => {
    try {
        const challengeId = parseInt(req.params.challengeId, 10);
        const payload = await buildLeaderboardPayload(challengeId);
        if (!payload) return res.status(404).json({ error: 'Challenge not found.' });
        const challenge = await getChallengeById(challengeId);
        payload.my_role = await userRole(challenge, req.user);
        payload.can_admin = payload.my_role === 'admin' || payload.my_role === 'superadmin';
        if (!payload.can_admin) delete payload.invite_code;
        res.json(payload);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/:challengeId/sync', optionalAuth, async (req, res) => {
    try {
        const challengeId = parseInt(req.params.challengeId, 10);
        const challenge = await getChallengeById(challengeId);
        if (!challenge) return res.status(404).json({ error: 'Challenge not found.' });
        const result = await syncChallenge(challengeId);
        if (result.skipped) {
            return res.json({ success: true, frozen: true, message: result.reason });
        }
        res.json({ success: true, message: 'Sync completed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/:challengeId', requireAuth, requireChallengeAdmin, async (req, res) => {
    try {
        const challenge = await updateChallenge(req.challengeId, {
            title: req.body.title || req.body.challenge_title,
            party_stakes: req.body.party_stakes
        });
        res.json({ success: true, challenge: serializeChallenge(challenge) });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.patch('/:challengeId/members/:userId', requireAuth, requireChallengeAdmin, async (req, res) => {
    try {
        await updateMember(req.challengeId, parseInt(req.params.userId, 10), {
            name: req.body.name,
            leetcode_username: req.body.leetcode_username
        });
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/:challengeId/members', requireAuth, requireChallengeAdmin, async (req, res) => {
    try {
        const { name, leetcode_username, color, emoji, car_emoji } = req.body;
        if (!name || !leetcode_username) {
            return res.status(400).json({ error: 'Name and LeetCode username are required' });
        }
        const handle = leetcode_username.trim();
        const ok = await validateUsername(handle);
        if (!ok) return res.status(400).json({ error: `LeetCode username "${handle}" does not exist on LeetCode.` });
        const userId = await addMember({
            challengeId: req.challengeId,
            name: name.trim(),
            leetcodeUsername: handle,
            color,
            emoji,
            car_emoji,
            allowAfterStart: Boolean(req.user.is_superadmin)
        });
        res.json({ success: true, userId });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/:challengeId/members/:userId', requireAuth, requireChallengeAdmin, async (req, res) => {
    try {
        await removeMember(req.challengeId, parseInt(req.params.userId, 10));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:challengeId/invite', requireAuth, requireChallengeAdmin, async (req, res) => {
    try {
        const challenge = await regenerateInviteCode(req.challengeId);
        res.json({ success: true, challenge: serializeChallenge(challenge) });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/:challengeId/archive', requireAuth, requireChallengeAdmin, async (req, res) => {
    try {
        const challenge = await archiveChallenge(req.challengeId, { force: Boolean(req.user.is_superadmin) });
        res.json({ success: true, challenge: serializeChallenge(challenge) });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/:challengeId', requireAuth, requireChallengeAdmin, async (req, res) => {
    try {
        await deleteArchivedChallenge(req.challengeId);
        res.json({ success: true, message: 'Challenge and all related data deleted.' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/:challengeId', optionalAuth, async (req, res) => {
    try {
        const challenge = await getChallengeById(parseInt(req.params.challengeId, 10));
        if (!challenge) return res.status(404).json({ error: 'Challenge not found.' });
        const role = await userRole(challenge, req.user);
        const canAdmin = role === 'admin' || role === 'superadmin';
        const payload = serializeChallenge(challenge, { my_role: role, can_admin: canAdmin });
        if (!canAdmin) delete payload.invite_code;
        res.json({ challenge: payload });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
