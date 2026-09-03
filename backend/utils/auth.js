const crypto = require('crypto');

const AUTH_SECRET = process.env.AUTH_SECRET || 'streakwars-dev-auth-secret';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function b64url(input) {
    return Buffer.from(input).toString('base64url');
}

function signToken(user) {
    const payload = {
        uid: user.id,
        exp: Date.now() + TOKEN_TTL_MS
    };
    const body = b64url(JSON.stringify(payload));
    const sig = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
    return `${body}.${sig}`;
}

function verifyToken(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const [body, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (!payload.uid || payload.exp < Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}

function publicUser(user) {
    if (!user) return null;
    const handle = (user.username || user.leetcode_username || user.name || '').toString().replace(/^@/, '');
    return {
        id: user.id,
        username: `@${handle}`,
        leetcode_username: user.leetcode_username || handle,
        display_name: user.display_name || user.name,
        avatar_emoji: user.avatar_emoji || user.emoji || '👤',
        avatar_color: user.avatar_color || user.color || '#6366f1',
        is_superadmin: Boolean(user.is_superadmin),
        token: user.token
    };
}

module.exports = { signToken, verifyToken, publicUser };
