const { getDb } = require('../db/db');

const ALLOW_USER_CREATE_KEY = 'allow_user_challenge_create';

async function getConfigValue(key, defaultValue = '') {
    const db = getDb();
    const row = await db.prepare(`SELECT value FROM config WHERE key = ?`).get(key);
    return row ? row.value : defaultValue;
}

async function setConfigValue(key, value) {
    const db = getDb();
    await db.prepare(`
        INSERT INTO config (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, String(value));
}

async function allowUserChallengeCreate() {
    return (await getConfigValue(ALLOW_USER_CREATE_KEY, '0')) === '1';
}

async function setAllowUserChallengeCreate(enabled) {
    await setConfigValue(ALLOW_USER_CREATE_KEY, enabled ? '1' : '0');
    return allowUserChallengeCreate();
}

async function canUserCreateChallenge(user) {
    if (!user) return false;
    if (user.is_superadmin) return true;
    return allowUserChallengeCreate();
}

module.exports = {
    ALLOW_USER_CREATE_KEY,
    getConfigValue,
    setConfigValue,
    allowUserChallengeCreate,
    setAllowUserChallengeCreate,
    canUserCreateChallenge
};
