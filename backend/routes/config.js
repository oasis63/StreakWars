const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { validateUsername } = require('../services/leetcodeApi');
const { createChallenge, serializeChallenge } = require('../services/challengeService');
const { allowUserChallengeCreate } = require('../services/siteSettings');

router.get('/', async (req, res) => {
    try {
        const allowCreate = await allowUserChallengeCreate();
        res.json({ setup_required: false, multi_challenge: true, allow_user_challenge_create: allowCreate });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/setup', requireAuth, async (req, res) => {
    try {
        const { canUserCreateChallenge } = require('../services/siteSettings');
        if (!(await canUserCreateChallenge(req.user))) {
            return res.status(403).json({ error: 'Only superadmins can create challenges right now.' });
        }
        const { challenge_title, challenge_duration_days, challenge_start_date, party_stakes, users } = req.body;
        const list = Array.isArray(users) ? users : [];
        for (let i = 0; i < list.length; i++) {
            const handle = (list[i].leetcode_username || '').trim();
            if (!handle) return res.status(400).json({ error: `Participant #${i + 1} is missing a LeetCode username.` });
            const ok = await validateUsername(handle);
            if (!ok) return res.status(400).json({ error: `LeetCode username "${handle}" was not found on LeetCode.` });
        }
        const challenge = await createChallenge({
            title: challenge_title,
            durationDays: challenge_duration_days,
            startDate: challenge_start_date,
            partyStakes: party_stakes,
            users: list,
            creator: req.user
        });
        res.json({ success: true, challenge: serializeChallenge(challenge) });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
