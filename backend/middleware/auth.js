const { getDb } = require('../db/db');
const { verifyToken } = require('../utils/auth');

function readBearer(req) {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) return header.slice(7).trim();
    return req.body && req.body.token ? req.body.token : null;
}

async function loadUser(userId) {
    const db = getDb();
    return db.prepare(`SELECT * FROM users WHERE id = ? AND is_deleted = 0`).get(userId);
}

async function optionalAuth(req, res, next) {
    try {
        const token = readBearer(req);
        const payload = verifyToken(token);
        if (payload) {
            req.user = await loadUser(payload.uid);
        }
        next();
    } catch (err) {
        next();
    }
}

async function requireAuth(req, res, next) {
    try {
        const token = readBearer(req);
        const payload = verifyToken(token);
        if (!payload) {
            return res.status(401).json({ error: 'Log in to continue.' });
        }
        const user = await loadUser(payload.uid);
        if (!user) {
            return res.status(401).json({ error: 'Session expired. Please log in again.' });
        }
        req.user = user;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Log in to continue.' });
    }
}

function requireSuperadmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Log in to continue.' });
    }
    if (!req.user.is_superadmin) {
        return res.status(403).json({ error: 'Superadmin access required.' });
    }
    next();
}

async function getMembership(challengeId, userId) {
    const db = getDb();
    return db.prepare(`
        SELECT * FROM challenge_members
        WHERE challenge_id = ? AND user_id = ? AND removed_at IS NULL
    `).get(challengeId, userId);
}

async function requireChallengeAdmin(req, res, next) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Log in to continue.' });
        }
        const challengeId = parseInt(req.params.challengeId || req.params.id, 10);
        if (!challengeId) {
            return res.status(400).json({ error: 'Challenge id is required.' });
        }
        req.challengeId = challengeId;
        if (req.user.is_superadmin) {
            return next();
        }
        const membership = await getMembership(challengeId, req.user.id);
        if (!membership || membership.role !== 'admin') {
            return res.status(403).json({ error: 'Only the challenge admin can do that.' });
        }
        req.membership = membership;
        next();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function requireChallengeMember(req, res, next) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Log in to continue.' });
        }
        const challengeId = parseInt(req.params.challengeId || req.params.id, 10);
        req.challengeId = challengeId;
        if (req.user.is_superadmin) return next();
        const membership = await getMembership(challengeId, req.user.id);
        if (!membership) {
            return res.status(403).json({ error: 'You are not in this challenge.' });
        }
        req.membership = membership;
        next();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

module.exports = {
    optionalAuth,
    requireAuth,
    requireSuperadmin,
    requireChallengeAdmin,
    requireChallengeMember,
    getMembership
};
