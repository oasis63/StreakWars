// backend/routes/sync.js
const express = require('express');
const router = express.Router();
const { syncAllUsers } = require('../services/gameEngine');

// POST /api/sync
router.post('/', async (req, res) => {
    try {
        await syncAllUsers();
        res.json({ success: true, message: 'Manual sync completed successfully' });
    } catch (err) {
        console.error('Manual sync error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
