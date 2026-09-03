const { getDb } = require('../db/db');
const config = require('../config');
const leetcodeApi = require('./leetcodeApi');
const {
    PUBLIC_RECENT_SUBMISSIONS_LIMIT,
    getSubmissionCredit,
    consumeFreshCapacity,
    getSubmissionWindowWarning
} = require('./scoring');
const { getChallengeStartMs, getDayNumber } = require('./gameEngineDates');

async function getChallengeById(id) {
    const { getChallengeById: load } = require('./challengeService');
    return load(id);
}

async function getChallengeConfig(challengeId) {
    if (challengeId) {
        const ch = await getChallengeById(challengeId);
        if (!ch) return {};
        return {
            challenge_title: ch.title,
            challenge_duration_days: String(ch.duration_days),
            challenge_start_date: ch.start_date,
            challenge_end_date: ch.end_date,
            party_stakes: ch.party_stakes,
            status: ch.status,
            id: ch.id
        };
    }
    const db = getDb();
    const rows = await db.prepare(`SELECT key, value FROM config`).all();
    const cfg = {};
    for (const r of rows) cfg[r.key] = r.value;
    return cfg;
}

async function getCurrentChallengeDay(challengeId) {
    const cfg = await getChallengeConfig(challengeId);
    if (!cfg.challenge_start_date) return 1;
    return getDayNumber(Date.now(), cfg.challenge_start_date);
}

function isFrozenStatus(status) {
    return status === 'completed' || status === 'archived';
}

async function syncUser(userId, challengeId) {
    const db = getDb();
    const challenge = await getChallengeById(challengeId);
    if (!challenge || isFrozenStatus(challenge.status)) return;

    const member = await db.prepare(`
        SELECT * FROM challenge_members
        WHERE challenge_id = ? AND user_id = ? AND removed_at IS NULL
    `).get(challengeId, userId);
    if (!member) return;

    const lcUsername = member.leetcode_username;
    const startDateStr = challenge.start_date;
    const startMs = getChallengeStartMs(startDateStr);

    const stats = await leetcodeApi.getUserStats(lcUsername);
    const nowIso = new Date().toISOString();

    let baselineSnapshot = await db.prepare(`
        SELECT captured_at, total_easy, total_medium, total_hard
        FROM challenge_baselines
        WHERE user_id = ? AND challenge_id = ?
    `).get(userId, challengeId);

    if (!baselineSnapshot) {
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
        `).run(challengeId, userId, startDateStr, nowIso, stats.easy, stats.medium, stats.hard);

        await db.prepare(`
            INSERT INTO snapshots (user_id, date_fetched, total_easy, total_medium, total_hard)
            VALUES (?, ?, ?, ?, ?)
        `).run(userId, nowIso, stats.easy, stats.medium, stats.hard);

        baselineSnapshot = {
            total_easy: stats.easy,
            total_medium: stats.medium,
            total_hard: stats.hard,
            captured_at: nowIso
        };
    }

    await db.prepare(`
        INSERT INTO snapshots (user_id, date_fetched, total_easy, total_medium, total_hard)
        VALUES (?, ?, ?, ?, ?)
    `).run(userId, nowIso, stats.easy, stats.medium, stats.hard);

    const baseEasy = baselineSnapshot.total_easy;
    const baseMed = baselineSnapshot.total_medium;
    const baseHard = baselineSnapshot.total_hard;

    const freshCapacity = {
        easy: Math.max(0, stats.easy - baseEasy),
        medium: Math.max(0, stats.medium - baseMed),
        hard: Math.max(0, stats.hard - baseHard)
    };

    const existingFreshCounts = await db.prepare(`
        SELECT difficulty, COUNT(*) as cnt
        FROM credited_problems
        WHERE user_id = ? AND challenge_id = ? AND credit_type = 'fresh' AND credited_at >= ?
        GROUP BY difficulty
    `).all(userId, challengeId, baselineSnapshot.captured_at);

    for (const ef of existingFreshCounts) {
        const dk = (ef.difficulty || '').toLowerCase();
        if (freshCapacity[dk] !== undefined) {
            freshCapacity[dk] = Math.max(0, freshCapacity[dk] - parseInt(ef.cnt, 10));
        }
    }

    const recentSubmissions = await leetcodeApi.getRecentSubmissions(
        lcUsername,
        PUBLIC_RECENT_SUBMISSIONS_LIMIT
    );
    recentSubmissions.sort((a, b) => a.timestamp - b.timestamp);

    const submissionWindowWarning = getSubmissionWindowWarning(recentSubmissions, startMs);
    if (submissionWindowWarning) {
        await db.prepare(`
            INSERT INTO user_stats (challenge_id, user_id, sync_status, sync_warning)
            VALUES (?, ?, 'needs_review', ?)
            ON CONFLICT(challenge_id, user_id) DO UPDATE SET
                sync_status = 'needs_review',
                sync_warning = EXCLUDED.sync_warning
        `).run(challengeId, userId, submissionWindowWarning);
    } else {
        await db.prepare(`
            INSERT INTO user_stats (challenge_id, user_id, sync_status, sync_warning)
            VALUES (?, ?, 'ok', NULL)
            ON CONFLICT(challenge_id, user_id) DO UPDATE SET
                sync_status = 'ok',
                sync_warning = NULL
        `).run(challengeId, userId);
    }

    for (const sub of recentSubmissions) {
        const subMs = sub.timestamp * 1000;
        if (subMs < startMs) continue;

        const alreadyCredited = await db.prepare(`
            SELECT id FROM credited_problems WHERE challenge_id = ? AND user_id = ? AND title_slug = ?
        `).get(challengeId, userId, sub.titleSlug);
        if (alreadyCredited) continue;

        const alreadyProcessed = await db.prepare(`
            SELECT id FROM processed_submissions WHERE challenge_id = ? AND user_id = ? AND submission_id = ?
        `).get(challengeId, userId, sub.id);
        if (alreadyProcessed) continue;

        try {
            await db.prepare(`
                INSERT INTO processed_submissions (challenge_id, user_id, submission_id, title_slug)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (challenge_id, user_id, submission_id) DO NOTHING
            `).run(challengeId, userId, sub.id, sub.titleSlug);
        } catch (e) {}

        const diffStr = await leetcodeApi.getProblemDifficulty(sub.titleSlug);
        const subDay = getDayNumber(subMs, startDateStr);
        const { difficultyKey, creditType, pointsAwarded } = getSubmissionCredit(diffStr, freshCapacity);

        try {
            const result = await db.prepare(`
                INSERT INTO credited_problems (challenge_id, user_id, title_slug, difficulty, credit_type, points_awarded, day_number, credited_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (challenge_id, user_id, title_slug) DO NOTHING
            `).run(challengeId, userId, sub.titleSlug, diffStr, creditType, pointsAwarded, subDay, new Date(subMs).toISOString());

            if (creditType === 'fresh' && result.rowCount > 0) {
                consumeFreshCapacity(freshCapacity, difficultyKey);
            }
        } catch (e) {}
    }
}

async function recomputeAllStats(challengeId) {
    const db = getDb();
    const challenge = await getChallengeById(challengeId);
    if (!challenge) return;
    if (isFrozenStatus(challenge.status)) return;

    const startDateStr = challenge.start_date;
    const currentDay = await getCurrentChallengeDay(challengeId);
    const members = await db.prepare(`
        SELECT * FROM challenge_members WHERE challenge_id = ? AND removed_at IS NULL
    `).all(challengeId);
    if (!members || members.length === 0) return;

    const userCalculations = [];

    for (const member of members) {
        const credited = await db.prepare(`
            SELECT difficulty, credit_type, points_awarded, day_number, credited_at
            FROM credited_problems
            WHERE challenge_id = ? AND user_id = ?
        `).all(challengeId, member.user_id);

        let easySolved = 0;
        let mediumSolved = 0;
        let hardSolved = 0;
        let freshSolves = 0;
        let resubmitCount = 0;
        let freshPts = 0;
        let resubmitPts = 0;
        const solvedDaysSet = new Set();

        for (const item of credited) {
            const diff = (item.difficulty || '').toLowerCase();
            const pts = parseFloat(item.points_awarded) || 0;
            if (item.credit_type === 'fresh') {
                freshSolves++;
                if (diff === 'easy') easySolved++;
                if (diff === 'medium') mediumSolved++;
                if (diff === 'hard') hardSolved++;
                freshPts += pts;
            } else if (item.credit_type === 'resubmit') {
                resubmitCount++;
                resubmitPts += pts;
            }
            if (parseInt(item.day_number, 10) > 0) {
                solvedDaysSet.add(parseInt(item.day_number, 10));
            }
        }

        const scoreRaw = freshPts + resubmitPts;
        let longestStreak = 0;
        let tempStreak = 0;
        for (let d = 1; d <= currentDay; d++) {
            if (solvedDaysSet.has(d)) {
                tempStreak++;
                if (tempStreak > longestStreak) longestStreak = tempStreak;
            } else {
                tempStreak = 0;
            }
        }

        let currentStreak = 0;
        if (solvedDaysSet.has(currentDay)) {
            let c = 0;
            while (solvedDaysSet.has(currentDay - c) && (currentDay - c) >= 1) c++;
            currentStreak = c;
        } else if (solvedDaysSet.has(currentDay - 1)) {
            let c = 0;
            while (solvedDaysSet.has(currentDay - 1 - c) && (currentDay - 1 - c) >= 1) c++;
            currentStreak = c;
        }

        const streakBonus = Math.floor(currentStreak / config.STREAK_BONUS_INTERVAL);
        const onFire = currentStreak >= config.STREAK_BONUS_INTERVAL ? 1 : 0;

        userCalculations.push({
            user_id: member.user_id,
            name: member.name,
            created_at: member.created_at,
            easy_solved: easySolved,
            medium_solved: mediumSolved,
            hard_solved: hardSolved,
            fresh_solves: freshSolves,
            resubmit_count: resubmitCount,
            fresh_pts: freshPts,
            resubmit_pts: resubmitPts,
            score_raw: scoreRaw,
            streak_bonus: streakBonus,
            current_streak: currentStreak,
            longest_streak: longestStreak,
            on_fire: onFire,
            score_pre_underdog: scoreRaw + streakBonus
        });
    }

    userCalculations.sort((a, b) => b.score_pre_underdog - a.score_pre_underdog);
    const lowestPreScore = userCalculations.length > 0 ? userCalculations[userCalculations.length - 1].score_pre_underdog : 0;

    for (const calc of userCalculations) {
        let multiplierActive = 0;
        const userDay1 = getDayNumber(new Date(calc.created_at).getTime(), startDateStr) <= 1;
        if (currentDay >= config.UNDERDOG_DAY && userDay1 && calc.score_pre_underdog === lowestPreScore && userCalculations.length > 1) {
            multiplierActive = 1;
        }
        const multiplierVal = multiplierActive ? config.UNDERDOG_MULTIPLIER : 1.0;
        calc.multiplier_active = multiplierActive;
        calc.score_final = Math.round((calc.score_pre_underdog * multiplierVal) * 10) / 10;
    }

    userCalculations.sort((a, b) => b.score_final - a.score_final);
    const nowIso = new Date().toISOString();

    for (let rank = 0; rank < userCalculations.length; rank++) {
        const calc = userCalculations[rank];
        const badges = [];
        if (rank === 0) badges.push('👑');
        if (calc.on_fire) badges.push('🔥');
        if (calc.multiplier_active) badges.push('⚡');
        if (calc.hard_solved > 0) badges.push('👑');
        if (rank === userCalculations.length - 1 && userCalculations.length > 1) badges.push('🥄');

        let reactiveIcon = '👤';
        if (rank === 0) reactiveIcon = '👑';
        else if (calc.on_fire) reactiveIcon = '🔥';
        else if (rank === userCalculations.length - 1) reactiveIcon = '💀';

        await db.prepare(`
            INSERT INTO user_stats (
                challenge_id, user_id, easy_solved, medium_solved, hard_solved,
                score_raw, score_final, streak_bonus, current_streak,
                longest_streak, on_fire, multiplier_active, reactive_icon,
                badges, last_synced, fresh_solves, resubmit_count,
                fresh_pts, resubmit_pts
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(challenge_id, user_id) DO UPDATE SET
                easy_solved = EXCLUDED.easy_solved,
                medium_solved = EXCLUDED.medium_solved,
                hard_solved = EXCLUDED.hard_solved,
                score_raw = EXCLUDED.score_raw,
                score_final = EXCLUDED.score_final,
                streak_bonus = EXCLUDED.streak_bonus,
                current_streak = EXCLUDED.current_streak,
                longest_streak = EXCLUDED.longest_streak,
                on_fire = EXCLUDED.on_fire,
                multiplier_active = EXCLUDED.multiplier_active,
                reactive_icon = EXCLUDED.reactive_icon,
                badges = EXCLUDED.badges,
                last_synced = EXCLUDED.last_synced,
                fresh_solves = EXCLUDED.fresh_solves,
                resubmit_count = EXCLUDED.resubmit_count,
                fresh_pts = EXCLUDED.fresh_pts,
                resubmit_pts = EXCLUDED.resubmit_pts
        `).run(
            challengeId, calc.user_id, calc.easy_solved, calc.medium_solved, calc.hard_solved,
            calc.score_raw, calc.score_final, calc.streak_bonus, calc.current_streak,
            calc.longest_streak, calc.on_fire, calc.multiplier_active, reactiveIcon,
            JSON.stringify(badges), nowIso, calc.fresh_solves, calc.resubmit_count,
            calc.fresh_pts, calc.resubmit_pts
        );
    }
}

async function syncChallenge(challengeId) {
    const challenge = await getChallengeById(challengeId);
    if (!challenge || isFrozenStatus(challenge.status)) {
        return { skipped: true, reason: 'Challenge is complete and scores are frozen.' };
    }
    const db = getDb();
    const members = await db.prepare(`
        SELECT user_id FROM challenge_members WHERE challenge_id = ? AND removed_at IS NULL
    `).all(challengeId);
    for (const m of members) {
        try {
            await syncUser(m.user_id, challengeId);
            await new Promise((r) => setTimeout(r, config.FETCH_DELAY_MS));
        } catch (e) {
            console.error(`Sync failed for user ${m.user_id} in challenge ${challengeId}:`, e.message);
        }
    }
    await recomputeAllStats(challengeId);
    return { skipped: false };
}

async function syncAllUsers() {
    const { refreshAllChallengeStatuses } = require('./challengeService');
    await refreshAllChallengeStatuses();
    const db = getDb();
    const live = await db.prepare(`
        SELECT id FROM challenges WHERE status IN ('scheduled', 'active')
    `).all();
    for (const ch of live) {
        await syncChallenge(ch.id);
    }
}

async function buildLeaderboardPayload(challengeId) {
    const db = getDb();
    const challenge = await getChallengeById(challengeId);
    if (!challenge) return null;

    if (!isFrozenStatus(challenge.status)) {
        try {
            await recomputeAllStats(challengeId);
        } catch (e) {
            console.error('Leaderboard recompute notice:', e.message);
        }
    }

    const durationDays = parseInt(challenge.duration_days, 10) || 30;
    const currentDay = await getCurrentChallengeDay(challengeId);
    const daysRemaining = Math.max(0, durationDays - currentDay + 1);
    const challengeEnded = challenge.status === 'completed' || challenge.status === 'archived' || currentDay > durationDays;

    const usersWithStats = await db.prepare(`
        SELECT
            m.user_id, m.name, m.leetcode_username, m.color, m.emoji, COALESCE(m.car_emoji, '🏎️') as car_emoji,
            s.easy_solved, s.medium_solved, s.hard_solved, s.fresh_solves, s.resubmit_count,
            s.fresh_pts, s.resubmit_pts,
            s.score_raw, s.score_final, s.streak_bonus, s.current_streak, s.longest_streak,
            s.on_fire, s.multiplier_active, s.reactive_icon, s.badges, s.last_synced,
            s.sync_status, s.sync_warning
        FROM challenge_members m
        LEFT JOIN user_stats s ON s.user_id = m.user_id AND s.challenge_id = m.challenge_id
        WHERE m.challenge_id = ? AND m.removed_at IS NULL
        ORDER BY COALESCE(s.score_final, 0) DESC, s.easy_solved DESC
    `).all(challengeId);

    const leaderboard = usersWithStats.map((u, index) => {
        let badges = [];
        try {
            badges = u.badges ? JSON.parse(u.badges) : [];
        } catch (e) { badges = []; }

        let lastSyncedFormatted = 'Just now';
        if (u.last_synced) {
            const dt = new Date(u.last_synced);
            lastSyncedFormatted = dt.toLocaleString('en-US', {
                timeZone: 'Asia/Kolkata',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        }

        return {
            user_id: u.user_id,
            name: u.name,
            leetcode_username: u.leetcode_username,
            color: u.color || '#c9a86c',
            emoji: u.emoji || '👤',
            car_emoji: u.car_emoji || '🏎️',
            easy_solved: parseInt(u.easy_solved, 10) || 0,
            medium_solved: parseInt(u.medium_solved, 10) || 0,
            hard_solved: parseInt(u.hard_solved, 10) || 0,
            fresh_solves: parseInt(u.fresh_solves, 10) || 0,
            resubmit_count: parseInt(u.resubmit_count, 10) || 0,
            fresh_pts: parseFloat(u.fresh_pts) || 0,
            resubmit_pts: parseFloat(u.resubmit_pts) || 0,
            score_raw: parseFloat(u.score_raw) || 0,
            score_final: parseFloat(u.score_final) || 0,
            streak_bonus: parseFloat(u.streak_bonus) || 0,
            current_streak: parseInt(u.current_streak, 10) || 0,
            longest_streak: parseInt(u.longest_streak, 10) || 0,
            on_fire: Boolean(u.on_fire),
            multiplier_active: Boolean(u.multiplier_active),
            reactive_icon: u.reactive_icon || '👤',
            badges,
            last_synced: u.last_synced,
            last_synced_formatted: lastSyncedFormatted,
            sync_status: u.sync_status || 'verified',
            sync_warning: u.sync_warning || '',
            rank: index + 1,
            is_last_place: index === usersWithStats.length - 1 && usersWithStats.length > 1
        };
    });

    const maxChartDays = Math.min(Math.max(currentDay, 1), durationDays);

    const creditedRows = await db.prepare(`
        SELECT user_id, day_number, difficulty, credit_type, COUNT(*) as count
        FROM credited_problems
        WHERE challenge_id = ?
        GROUP BY user_id, day_number, difficulty, credit_type
    `).all(challengeId);

    const manhattanMap = {};
    for (let d = 1; d <= maxChartDays; d++) {
        manhattanMap[d] = { day: `Day ${d}` };
        for (const u of leaderboard) {
            manhattanMap[d][`${u.user_id}_easy`] = 0;
            manhattanMap[d][`${u.user_id}_med`] = 0;
            manhattanMap[d][`${u.user_id}_hard`] = 0;
            manhattanMap[d][`${u.user_id}_total`] = 0;
        }
    }
    for (const row of creditedRows) {
        const d = parseInt(row.day_number, 10);
        if (d >= 1 && d <= maxChartDays && manhattanMap[d]) {
            const diffKey = (row.difficulty || '').toLowerCase();
            const uId = row.user_id;
            const cnt = parseInt(row.count, 10) || 0;
            if (diffKey === 'easy') manhattanMap[d][`${uId}_easy`] += cnt;
            if (diffKey === 'medium') manhattanMap[d][`${uId}_med`] += cnt;
            if (diffKey === 'hard') manhattanMap[d][`${uId}_hard`] += cnt;
            manhattanMap[d][`${uId}_total`] += cnt;
        }
    }

    const allCreditedForWorm = await db.prepare(`
        SELECT user_id, day_number, points_awarded
        FROM credited_problems
        WHERE challenge_id = ?
        ORDER BY day_number ASC
    `).all(challengeId);

    const wormMap = {};
    for (let d = 1; d <= maxChartDays; d++) {
        wormMap[d] = { day: `Day ${d}` };
        for (const u of leaderboard) wormMap[d][u.user_id] = 0;
    }
    const userCumulativeScore = {};
    for (const u of leaderboard) userCumulativeScore[u.user_id] = 0;
    for (let d = 1; d <= maxChartDays; d++) {
        const dayCredits = allCreditedForWorm.filter((c) => parseInt(c.day_number, 10) === d);
        for (const c of dayCredits) {
            if (userCumulativeScore[c.user_id] !== undefined) {
                userCumulativeScore[c.user_id] += parseFloat(c.points_awarded) || 0;
            }
        }
        for (const u of leaderboard) {
            wormMap[d][u.user_id] = Math.round(userCumulativeScore[u.user_id] * 10) / 10;
        }
    }

    return {
        setup_required: false,
        challenge_id: challenge.id,
        challenge_title: challenge.title,
        challenge_duration_days: durationDays,
        challenge_start_date: challenge.start_date,
        challenge_end_date: challenge.end_date,
        challenge_status: challenge.status,
        invite_code: challenge.invite_code,
        current_day: currentDay,
        days_remaining: daysRemaining,
        challenge_ended: challengeEnded,
        frozen: isFrozenStatus(challenge.status),
        party_stakes: challenge.party_stakes,
        leaderboard,
        manhattan_data: Object.values(manhattanMap),
        worm_data: Object.values(wormMap)
    };
}

module.exports = {
    getChallengeConfig,
    getChallengeStartMs,
    getCurrentChallengeDay,
    getDayNumber,
    syncUser,
    syncAllUsers,
    syncChallenge,
    recomputeAllStats,
    buildLeaderboardPayload,
    isFrozenStatus
};
