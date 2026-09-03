const express = require('express');
const router = express.Router();
const { getDb } = require('../db/db');
const { buildLeaderboardPayload } = require('../services/gameEngine');
const { listPublicHomeChallenges, serializeChallenge } = require('../services/challengeService');

router.get('/', async (req, res) => {
    try {
        const live = await listPublicHomeChallenges();
        if (!live || live.length === 0) {
            return res.json({ setup_required: true, challenges: [] });
        }
        const payload = await buildLeaderboardPayload(live[0].id);
        payload.challenges = live.map((c) => serializeChallenge(c, { member_count: parseInt(c.member_count, 10) || 0 }));
        res.json(payload);
    } catch (err) {
        console.error('Error fetching leaderboard:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
