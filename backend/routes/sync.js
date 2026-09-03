const express = require('express');
const router = express.Router();
const { syncChallenge, syncAllUsers } = require('../services/gameEngine');

router.post('/', async (req, res) => {
    try {
        const challengeId = parseInt(req.body.challenge_id || req.query.challenge_id, 10);
        if (challengeId) {
            const result = await syncChallenge(challengeId);
            if (result.skipped) {
                return res.json({ success: true, frozen: true, message: result.reason });
            }
            return res.json({ success: true, message: 'Manual sync completed successfully' });
        }
        await syncAllUsers();
        res.json({ success: true, message: 'Manual sync completed successfully' });
    } catch (err) {
        console.error('Error during manual sync:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
