const { getDb } = require('../db/db');
const { inviteCode, deriveStatus, getIstDateString } = require('../db/migrateMultiChallenge');
const { getChallengeStartMs } = require('./gameEngineDates');
const { getUserStats } = require('./leetcodeApi');

const PLAYER_PALETTE = ['#4D96FF', '#FF5DA2', '#2EC27E', '#F5C542', '#FF9A3C', '#C77DFF', '#FF5A5A', '#2EC4B6', '#8BD346'];
const CAR_EMOJIS = ['🏎️', '🚗', '🚙', '🛻', '🚕'];

function computeEndDate(startDateStr, durationDays) {
    const startDateObj = new Date(`${startDateStr}T00:00:00.000Z`);
    const endDateObj = new Date(startDateObj.getTime() + (durationDays - 1) * 24 * 60 * 60 * 1000);
    return endDateObj.toISOString().split('T')[0];
}

function challengeIsFrozen(status) {
    return status === 'completed' || status === 'archived';
}

function challengeIsLive(status) {
    return status === 'scheduled' || status === 'active';
}

function assertChallengeMutable(challenge) {
    if (!challenge) throw new Error('Challenge not found');
    if (challenge.status === 'archived') {
        throw new Error('This circuit is archived. It can only be deleted.');
    }
    if (challenge.status === 'completed') {
        throw new Error('This circuit is over. Archive it, then you can delete it.');
    }
}

async function refreshChallengeRow(challenge) {
    if (!challenge) return challenge;
    const next = deriveStatus(
        challenge.start_date,
        challenge.end_date,
        challenge.status,
        challenge.duration_days
    );
    if (next !== challenge.status) {
        const db = getDb();
        await db.prepare(`UPDATE challenges SET status = ? WHERE id = ?`).run(next, challenge.id);
        challenge.status = next;
    }
    return challenge;
}

async function refreshAllChallengeStatuses() {
    const db = getDb();
    const rows = await db.prepare(`SELECT * FROM challenges`).all();
    for (const row of rows) {
        await refreshChallengeRow(row);
    }
}

async function getChallengeById(id) {
    const db = getDb();
    const row = await db.prepare(`SELECT * FROM challenges WHERE id = ?`).get(id);
    return refreshChallengeRow(row);
}

async function getChallengeByInvite(code) {
    const db = getDb();
    const row = await db.prepare(`SELECT * FROM challenges WHERE LOWER(invite_code) = LOWER(?)`).get(String(code || '').trim());
    return refreshChallengeRow(row);
}

async function nextMemberColor(challengeId) {
    const db = getDb();
    const rows = await db.prepare(`SELECT color FROM challenge_members WHERE challenge_id = ? AND removed_at IS NULL`).all(challengeId);
    const used = new Set((rows || []).map((r) => String(r.color || '').toLowerCase()));
    return PLAYER_PALETTE.find((c) => !used.has(c.toLowerCase())) || PLAYER_PALETTE[rows.length % PLAYER_PALETTE.length];
}

async function findOrCreateAccount({ name, leetcode_username, color, emoji, car_emoji }) {
    const db = getDb();
    const handle = leetcode_username.trim();
    const existing = await db.prepare(`
        SELECT * FROM users
        WHERE LOWER(leetcode_username) = LOWER(?) OR LOWER(COALESCE(username, '')) = LOWER(?)
    `).get(handle, handle);

    if (existing) {
        await db.prepare(`
            UPDATE users SET is_deleted = 0, name = COALESCE(name, ?), color = COALESCE(color, ?), emoji = COALESCE(emoji, ?)
            WHERE id = ?
        `).run(name, color, emoji, existing.id);
        return existing.id;
    }

    const result = await db.prepare(`
        INSERT INTO users (name, leetcode_username, username, display_name, color, emoji, car_emoji, is_participant)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).run(name, handle, handle.toLowerCase(), name, color, emoji || '👤', car_emoji || '🏎️');
    return result.lastInsertRowid || (result.row && result.row.id);
}

async function addMember({ challengeId, name, leetcodeUsername, role = 'participant', color, emoji, car_emoji, userId, allowAfterStart = false }) {
    const db = getDb();
    const challenge = await getChallengeById(challengeId);
    if (!challenge) throw new Error('Challenge not found');
    assertChallengeMutable(challenge);
    if (!allowAfterStart && Date.now() >= getChallengeStartMs(challenge.start_date)) {
        throw new Error('Participants cannot be added once a challenge has started.');
    }

    const memberColor = color || await nextMemberColor(challengeId);
    const memberEmoji = emoji || '👤';
    const memberCar = car_emoji || CAR_EMOJIS[Math.floor(Math.random() * CAR_EMOJIS.length)];
    const uid = userId || await findOrCreateAccount({
        name,
        leetcode_username: leetcodeUsername,
        color: memberColor,
        emoji: memberEmoji,
        car_emoji: memberCar
    });

    const existing = await db.prepare(`
        SELECT * FROM challenge_members WHERE challenge_id = ? AND user_id = ?
    `).get(challengeId, uid);

    if (existing && !existing.removed_at) {
        throw new Error('That player is already in this challenge.');
    }

    if (existing) {
        await db.prepare(`
            UPDATE challenge_members
            SET removed_at = NULL, role = ?, name = ?, leetcode_username = ?, color = ?, emoji = ?, car_emoji = ?
            WHERE id = ?
        `).run(role, name, leetcodeUsername, memberColor, memberEmoji, memberCar, existing.id);
        await captureMemberBaseline(challenge, uid, leetcodeUsername);
        return uid;
    }

    await db.prepare(`
        INSERT INTO challenge_members (challenge_id, user_id, role, name, leetcode_username, color, emoji, car_emoji)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(challengeId, uid, role, name, leetcodeUsername, memberColor, memberEmoji, memberCar);
    await captureMemberBaseline(challenge, uid, leetcodeUsername);
    return uid;
}

async function captureMemberBaseline(challenge, userId, leetcodeUsername) {
    const db = getDb();
    try {
        const stats = await getUserStats(leetcodeUsername);
        const nowIso = new Date().toISOString();
        await db.prepare(`
            INSERT INTO challenge_baselines (
                challenge_id, user_id, challenge_start_date, captured_at, total_easy, total_medium, total_hard
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(challenge_id, user_id) DO UPDATE SET
                challenge_start_date = EXCLUDED.challenge_start_date,
                captured_at = EXCLUDED.captured_at,
                total_easy = EXCLUDED.total_easy,
                total_medium = EXCLUDED.total_medium,
                total_hard = EXCLUDED.total_hard
        `).run(challenge.id, userId, challenge.start_date, nowIso, stats.easy, stats.medium, stats.hard);
        await db.prepare(`
            INSERT INTO snapshots (user_id, date_fetched, total_easy, total_medium, total_hard)
            VALUES (?, ?, ?, ?, ?)
        `).run(userId, nowIso, stats.easy, stats.medium, stats.hard);
        await db.prepare(`
            INSERT INTO user_stats (challenge_id, user_id, sync_status, sync_warning)
            VALUES (?, ?, 'verified', '')
            ON CONFLICT(challenge_id, user_id) DO UPDATE SET sync_status = 'verified', sync_warning = ''
        `).run(challenge.id, userId);
    } catch (err) {
        console.error('Baseline capture failed:', err.message);
    }
}

async function removeMember(challengeId, userId) {
    const challenge = await getChallengeById(challengeId);
    assertChallengeMutable(challenge);
    const db = getDb();
    await db.prepare(`
        UPDATE challenge_members SET removed_at = CURRENT_TIMESTAMP
        WHERE challenge_id = ? AND user_id = ?
    `).run(challengeId, userId);
}

async function listMembers(challengeId) {
    const db = getDb();
    return db.prepare(`
        SELECT * FROM challenge_members
        WHERE challenge_id = ? AND removed_at IS NULL
        ORDER BY id ASC
    `).all(challengeId);
}

async function userRole(challenge, user) {
    if (!user) return null;
    if (user.is_superadmin) return 'superadmin';
    const db = getDb();
    const m = await db.prepare(`
        SELECT role FROM challenge_members
        WHERE challenge_id = ? AND user_id = ? AND removed_at IS NULL
    `).get(challenge.id, user.id);
    return m ? m.role : null;
}

async function listPublicHomeChallenges() {
    const db = getDb();
    await refreshAllChallengeStatuses();
    return db.prepare(`
        SELECT c.*,
            (SELECT COUNT(*) FROM challenge_members m WHERE m.challenge_id = c.id AND m.removed_at IS NULL) AS member_count
        FROM challenges c
        WHERE c.status IN ('active', 'scheduled')
        ORDER BY CASE c.status WHEN 'active' THEN 0 ELSE 1 END, c.start_date ASC, c.id DESC
    `).all();
}

async function listChallengesForUser(user) {
    const db = getDb();
    await refreshAllChallengeStatuses();
    if (user && user.is_superadmin) {
        return db.prepare(`
            SELECT c.*, u.display_name AS creator_name, u.username AS creator_username
            FROM challenges c
            LEFT JOIN users u ON u.id = c.created_by
            ORDER BY c.id DESC
        `).all();
    }
    if (!user) return [];
    return db.prepare(`
        SELECT c.*, m.role AS my_role
        FROM challenges c
        INNER JOIN challenge_members m ON m.challenge_id = c.id
        WHERE m.user_id = ? AND m.removed_at IS NULL
        ORDER BY c.id DESC
    `).all(user.id);
}

async function createChallenge({ title, durationDays, startDate, partyStakes, users, creator }) {
    if (!title || !String(title).trim()) {
        throw new Error('Challenge title is required.');
    }
    const db = getDb();
    const duration = parseInt(durationDays, 10);
    const startDateStr = startDate || getIstDateString();
    if (!Number.isInteger(duration) || duration < 1 || duration > 365) {
        throw new Error('Challenge duration must be between 1 and 365 days.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) || Number.isNaN(getChallengeStartMs(startDateStr))) {
        throw new Error('Challenge start date must be a valid YYYY-MM-DD date.');
    }
    if (startDateStr <= getIstDateString()) {
        throw new Error('Choose a start date after today so baselines can be captured first.');
    }

    const endDateStr = computeEndDate(startDateStr, duration);
    const status = deriveStatus(startDateStr, endDateStr, 'scheduled', duration);
    const code = inviteCode();

    const result = await db.prepare(`
        INSERT INTO challenges (title, duration_days, start_date, end_date, party_stakes, created_by, status, invite_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title.trim(), duration, startDateStr, endDateStr, (partyStakes || 'lowest score buys the party').trim(), creator.id, status, code);

    const challengeId = result.lastInsertRowid || (result.row && result.row.id);
    const creatorHandle = (creator.leetcode_username || creator.username || '').replace(/^@/, '');
    const creatorName = creator.display_name || creator.name || 'Admin';

    await addMember({
        challengeId,
        name: creatorName,
        leetcodeUsername: creatorHandle || `user${creator.id}`,
        role: 'admin',
        userId: creator.id
    }).catch(async () => {
        await db.prepare(`
            INSERT INTO challenge_members (challenge_id, user_id, role, name, leetcode_username, color, emoji, car_emoji)
            VALUES (?, ?, 'admin', ?, ?, ?, ?, ?)
        `).run(challengeId, creator.id, creatorName, creatorHandle || `user${creator.id}`, '#F5C542', creator.avatar_emoji || '👤', '🏎️');
    });

    const seen = new Set([String(creator.id)]);
    for (let i = 0; i < (users || []).length; i++) {
        const u = users[i];
        const uid = await addMember({
            challengeId,
            name: u.name.trim(),
            leetcodeUsername: u.leetcode_username.trim(),
            role: 'participant',
            color: PLAYER_PALETTE[i % PLAYER_PALETTE.length],
            emoji: u.emoji,
            car_emoji: u.car_emoji
        });
        if (String(uid) === String(creator.id)) {
            await db.prepare(`UPDATE challenge_members SET role = 'admin' WHERE challenge_id = ? AND user_id = ?`).run(challengeId, creator.id);
        }
        seen.add(String(uid));
    }

    return getChallengeById(challengeId);
}

async function archiveChallenge(challengeId, { force = false } = {}) {
    const challenge = await getChallengeById(challengeId);
    if (!challenge) throw new Error('Challenge not found');
    if (!force && challenge.status !== 'completed' && challenge.status !== 'archived') {
        throw new Error('Archive is available after the circuit is complete.');
    }
    const db = getDb();
    await db.prepare(`UPDATE challenges SET status = 'archived' WHERE id = ?`).run(challengeId);
    return getChallengeById(challengeId);
}

async function updateChallenge(challengeId, { title, party_stakes }) {
    const challenge = await getChallengeById(challengeId);
    if (!challenge) throw new Error('Challenge not found');
    assertChallengeMutable(challenge);
    const db = getDb();
    const nextTitle = title != null ? String(title).trim() : challenge.title;
    const nextStakes = party_stakes != null ? String(party_stakes).trim() : challenge.party_stakes;
    if (!nextTitle) throw new Error('Challenge title is required.');
    await db.prepare(`UPDATE challenges SET title = ?, party_stakes = ? WHERE id = ?`).run(nextTitle, nextStakes, challengeId);
    return getChallengeById(challengeId);
}

async function updateMember(challengeId, userId, { name, leetcode_username }) {
    const challenge = await getChallengeById(challengeId);
    assertChallengeMutable(challenge);
    const db = getDb();
    const member = await db.prepare(`
        SELECT * FROM challenge_members WHERE challenge_id = ? AND user_id = ? AND removed_at IS NULL
    `).get(challengeId, userId);
    if (!member) throw new Error('That player is not in this challenge.');
    const nextName = name != null ? String(name).trim() : member.name;
    const nextHandle = leetcode_username != null ? String(leetcode_username).trim() : member.leetcode_username;
    if (!nextName || !nextHandle) throw new Error('Name and LeetCode username are required.');
    await db.prepare(`
        UPDATE challenge_members SET name = ?, leetcode_username = ? WHERE challenge_id = ? AND user_id = ?
    `).run(nextName, nextHandle, challengeId, userId);
    return userId;
}

async function deleteChallenge(challengeId) {
    const challenge = await getChallengeById(challengeId);
    if (!challenge) throw new Error('Challenge not found');
    const db = getDb();
    await db.prepare(`DELETE FROM credited_problems WHERE challenge_id = ?`).run(challengeId);
    await db.prepare(`DELETE FROM processed_submissions WHERE challenge_id = ?`).run(challengeId);
    await db.prepare(`DELETE FROM user_stats WHERE challenge_id = ?`).run(challengeId);
    await db.prepare(`DELETE FROM challenge_baselines WHERE challenge_id = ?`).run(challengeId);
    await db.prepare(`DELETE FROM forum_posts WHERE challenge_id = ?`).run(challengeId);
    await db.prepare(`DELETE FROM challenge_members WHERE challenge_id = ?`).run(challengeId);
    await db.prepare(`DELETE FROM challenges WHERE id = ?`).run(challengeId);
}

async function deleteArchivedChallenge(challengeId) {
    return deleteChallenge(challengeId);
}

async function regenerateInviteCode(challengeId) {
    const challenge = await getChallengeById(challengeId);
    if (!challenge) throw new Error('Challenge not found');
    assertChallengeMutable(challenge);
    const db = getDb();
    const code = inviteCode();
    await db.prepare(`UPDATE challenges SET invite_code = ? WHERE id = ?`).run(code, challengeId);
    return getChallengeById(challengeId);
}

async function setMemberRole(challengeId, userId, role) {
    if (!['admin', 'participant'].includes(role)) throw new Error('Role must be admin or participant.');
    const challenge = await getChallengeById(challengeId);
    assertChallengeMutable(challenge);
    const db = getDb();
    const member = await db.prepare(`
        SELECT * FROM challenge_members WHERE challenge_id = ? AND user_id = ? AND removed_at IS NULL
    `).get(challengeId, userId);
    if (!member) {
        throw new Error('That user is not a participant of this challenge. Add them first, then make them admin.');
    }
    await db.prepare(`
        UPDATE challenge_members SET role = ? WHERE challenge_id = ? AND user_id = ? AND removed_at IS NULL
    `).run(role, challengeId, userId);
}

function serializeChallenge(challenge, extras = {}) {
    if (!challenge) return null;
    return {
        id: challenge.id,
        title: challenge.title,
        duration_days: challenge.duration_days,
        start_date: challenge.start_date,
        end_date: challenge.end_date,
        party_stakes: challenge.party_stakes,
        status: challenge.status,
        invite_code: challenge.invite_code,
        created_by: challenge.created_by,
        my_role: extras.my_role || challenge.my_role || null,
        frozen: challengeIsFrozen(challenge.status),
        ...extras
    };
}

module.exports = {
    PLAYER_PALETTE,
    challengeIsFrozen,
    challengeIsLive,
    refreshChallengeRow,
    refreshAllChallengeStatuses,
    getChallengeById,
    getChallengeByInvite,
    addMember,
    removeMember,
    listMembers,
    userRole,
    listPublicHomeChallenges,
    listMine: listChallengesForUser,
    listChallengesForUser,
    createChallenge,
    archiveChallenge,
    deleteChallenge,
    deleteArchivedChallenge,
    updateChallenge,
    updateMember,
    setMemberRole,
    regenerateInviteCode,
    serializeChallenge,
    nextMemberColor,
    computeEndDate,
    getIstDateString
};
