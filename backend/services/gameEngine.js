// backend/services/gameEngine.js
const { getDb } = require('../db/db');
const config = require('../config');
const leetcodeApi = require('./leetcodeApi');
const {
    PUBLIC_RECENT_SUBMISSIONS_LIMIT,
    getSubmissionCredit,
    consumeFreshCapacity,
    getSubmissionWindowWarning
} = require('./scoring');

/**
 * Get global challenge configuration from database
 */
async function getChallengeConfig() {
    const db = getDb();
    const rows = await db.prepare(`SELECT key, value FROM config`).all();
    const cfg = {};
    for (const r of rows) {
        cfg[r.key] = r.value;
    }
    return cfg;
}

/**
 * Get start-of-day timestamp in local time for challenge_start_date (00:00:00.000)
 */
function getChallengeStartMs(startDateStr) {
    if (!startDateStr) return Date.now();
    const parts = startDateStr.split('-');
    if (parts.length === 3) {
        const isoStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}T00:00:00.000+05:30`;
        return new Date(isoStr).getTime();
    }
    return new Date(startDateStr).getTime();
}

/**
 * Calculate challenge day number for a given timestamp
 */
function getDayNumber(timestampMs, startDateStr) {
    const startMs = getChallengeStartMs(startDateStr);
    const diffMs = timestampMs - startMs;
    if (diffMs < 0) return 1;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Get current challenge day number based on today's date
 */
async function getCurrentChallengeDay() {
    const cfg = await getChallengeConfig();
    if (!cfg.challenge_start_date) return 1;
    return getDayNumber(Date.now(), cfg.challenge_start_date);
}

/**
 * Process single user sync: fetch stats & recent submissions -> credited problems log
 */
async function syncUser(userId) {
    const db = getDb();
    const user = await db.prepare(`SELECT * FROM users WHERE id = ? AND is_deleted = 0`).get(userId);
    if (!user) return;

    const cfg = await getChallengeConfig();
    const startDateStr = cfg.challenge_start_date || new Date().toISOString().split('T')[0];
    const startMs = getChallengeStartMs(startDateStr);

    // 1. Fetch latest stats from LeetCode
    const stats = await leetcodeApi.getUserStats(user.leetcode_username);
    const nowIso = new Date().toISOString();

    const baselineSnapshot = await db.prepare(`
        SELECT captured_at, total_easy, total_medium, total_hard
        FROM challenge_baselines
        WHERE user_id = ? AND challenge_start_date = ?
    `).get(userId, startDateStr);

    // Never score a legacy participant against an unknown baseline. Capture a
    // new one for subsequent syncs and surface the review requirement instead.
    // If no baseline snapshot exists yet for this challenge, capture a new baseline
    if (!baselineSnapshot) {
        await db.prepare(`
            INSERT INTO challenge_baselines (
                user_id, challenge_start_date, captured_at, total_easy, total_medium, total_hard
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                challenge_start_date = EXCLUDED.challenge_start_date,
                captured_at = EXCLUDED.captured_at,
                total_easy = EXCLUDED.total_easy,
                total_medium = EXCLUDED.total_medium,
                total_hard = EXCLUDED.total_hard
        `).run(userId, startDateStr, nowIso, stats.easy, stats.medium, stats.hard);

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

    // 2. Insert aggregate snapshot
    await db.prepare(`
        INSERT INTO snapshots (user_id, date_fetched, total_easy, total_medium, total_hard)
        VALUES (?, ?, ?, ?, ?)
    `).run(userId, nowIso, stats.easy, stats.medium, stats.hard);

    const baseEasy = baselineSnapshot.total_easy;
    const baseMed = baselineSnapshot.total_medium;
    const baseHard = baselineSnapshot.total_hard;

    // Fresh capacity
    const freshCapacity = {
        easy: Math.max(0, stats.easy - baseEasy),
        medium: Math.max(0, stats.medium - baseMed),
        hard: Math.max(0, stats.hard - baseHard)
    };

    const existingFreshCounts = await db.prepare(`
        SELECT difficulty, COUNT(*) as cnt
        FROM credited_problems
        WHERE user_id = ? AND credit_type = 'fresh' AND credited_at >= ?
        GROUP BY difficulty
    `).all(userId, baselineSnapshot.captured_at);

    for (const ef of existingFreshCounts) {
        const dk = (ef.difficulty || '').toLowerCase();
        if (freshCapacity[dk] !== undefined) {
            freshCapacity[dk] = Math.max(0, freshCapacity[dk] - parseInt(ef.cnt, 10));
        }
    }

    // 3. Fetch recent accepted submissions from LeetCode
    const recentSubmissions = await leetcodeApi.getRecentSubmissions(
        user.leetcode_username,
        PUBLIC_RECENT_SUBMISSIONS_LIMIT
    );
    
    // Sort oldest to newest
    recentSubmissions.sort((a, b) => a.timestamp - b.timestamp);

    const submissionWindowWarning = getSubmissionWindowWarning(recentSubmissions, startMs);
    if (submissionWindowWarning) {
        await db.prepare(`
            INSERT INTO user_stats (user_id, sync_status, sync_warning)
            VALUES (?, 'needs_review', ?)
            ON CONFLICT(user_id) DO UPDATE SET
                sync_status = 'needs_review',
                sync_warning = EXCLUDED.sync_warning
        `).run(userId, submissionWindowWarning);
    } else {
        await db.prepare(`
            INSERT INTO user_stats (user_id, sync_status, sync_warning)
            VALUES (?, 'ok', NULL)
            ON CONFLICT(user_id) DO UPDATE SET
                sync_status = 'ok',
                sync_warning = NULL
        `).run(userId);
    }

    for (const sub of recentSubmissions) {
        const subMs = sub.timestamp * 1000;
        
        // STRICT FILTER: Skip all submissions made BEFORE challenge start date
        if (subMs < startMs) continue;

        // RULE: Resubmit of anything already credited during the challenge -> 0 points ALWAYS
        const alreadyCredited = await db.prepare(`
            SELECT id FROM credited_problems WHERE user_id = ? AND title_slug = ?
        `).get(userId, sub.titleSlug);
        if (alreadyCredited) {
            continue; // Skip (0 points)
        }

        // Deduplication guard for submission ID
        const alreadyProcessed = await db.prepare(`
            SELECT id FROM processed_submissions WHERE user_id = ? AND submission_id = ?
        `).get(userId, sub.id);
        if (alreadyProcessed) continue;

        try {
            await db.prepare(`
                INSERT INTO processed_submissions (user_id, submission_id, title_slug)
                VALUES (?, ?, ?)
                ON CONFLICT DO NOTHING
            `).run(userId, sub.id, sub.titleSlug);
        } catch (e) {}

        // Lookup problem difficulty
        const diffStr = await leetcodeApi.getProblemDifficulty(sub.titleSlug);
        const subDay = getDayNumber(subMs, startDateStr);

        const { difficultyKey, creditType, pointsAwarded } = getSubmissionCredit(diffStr, freshCapacity);

        try {
            const result = await db.prepare(`
                INSERT INTO credited_problems (user_id, title_slug, difficulty, credit_type, points_awarded, day_number, credited_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (user_id, title_slug) DO NOTHING
            `).run(userId, sub.titleSlug, diffStr, creditType, pointsAwarded, subDay, new Date(subMs).toISOString());

            // Only consume capacity if this submission was actually credited.
            if (creditType === 'fresh' && result.rowCount > 0) {
                consumeFreshCapacity(freshCapacity, difficultyKey);
            }
        } catch (e) {
            // UNIQUE guard
        }
    }
}

/**
 * Recompute stats for all active users
 */
async function recomputeAllStats() {
    const db = getDb();
    const cfg = await getChallengeConfig();
    const startDateStr = cfg.challenge_start_date || new Date().toISOString().split('T')[0];
    const currentDay = await getCurrentChallengeDay();

    const users = await db.prepare(`SELECT * FROM users WHERE is_deleted = 0 AND COALESCE(is_participant, 1) = 1`).all();
    if (!users || users.length === 0) return;

    try {
        const userCalculations = [];

        for (const user of users) {
            const credited = await db.prepare(`
                SELECT difficulty, credit_type, points_awarded, day_number, credited_at
                FROM credited_problems
                WHERE user_id = ?
            `).all(user.id);

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

            // Calculate streak
            let currentStreak = 0;
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
            
            if (solvedDaysSet.has(currentDay)) {
                let c = 0;
                while (solvedDaysSet.has(currentDay - c) && (currentDay - c) >= 1) {
                    c++;
                }
                currentStreak = c;
            } else if (solvedDaysSet.has(currentDay - 1)) {
                let c = 0;
                while (solvedDaysSet.has(currentDay - 1 - c) && (currentDay - 1 - c) >= 1) {
                    c++;
                }
                currentStreak = c;
            } else {
                currentStreak = 0;
            }

            const streakBonus = Math.floor(currentStreak / config.STREAK_BONUS_INTERVAL);
            const onFire = currentStreak >= config.STREAK_BONUS_INTERVAL ? 1 : 0;

            userCalculations.push({
                user_id: user.id,
                name: user.name,
                created_at: user.created_at,
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
            const scoreFinal = Math.round((calc.score_pre_underdog * multiplierVal) * 10) / 10;

            calc.multiplier_active = multiplierActive;
            calc.score_final = scoreFinal;
        }

        userCalculations.sort((a, b) => b.score_final - a.score_final);

        const totalPlayers = userCalculations.length;
        const nowIso = new Date().toISOString();

        for (let rank = 0; rank < totalPlayers; rank++) {
            const calc = userCalculations[rank];
            const badges = [];

            if (rank === 0) badges.push('👑');
            if (calc.on_fire) badges.push('🔥');
            if (calc.multiplier_active) badges.push('⚡');
            if (calc.hard_solved > 0) badges.push('👑');
            if (rank === totalPlayers - 1 && totalPlayers > 1) badges.push('🥄');

            let reactiveIcon = '👤';
            if (rank === 0) reactiveIcon = '👑';
            else if (calc.on_fire) reactiveIcon = '🔥';
            else if (rank === totalPlayers - 1) reactiveIcon = '💀';

            await db.prepare(`
                INSERT INTO user_stats (
                    user_id, easy_solved, medium_solved, hard_solved,
                    score_raw, score_final, streak_bonus, current_streak,
                    longest_streak, on_fire, multiplier_active, reactive_icon,
                    badges, last_synced, fresh_solves, resubmit_count,
                    fresh_pts, resubmit_pts
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
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
                calc.user_id, calc.easy_solved, calc.medium_solved, calc.hard_solved,
                calc.score_raw, calc.score_final, calc.streak_bonus, calc.current_streak,
                calc.longest_streak, calc.on_fire, calc.multiplier_active, reactiveIcon,
                JSON.stringify(badges), nowIso, calc.fresh_solves, calc.resubmit_count,
                calc.fresh_pts, calc.resubmit_pts
            );
        }
    } catch (err) {
        console.error('Error in recomputeAllStats:', err);
        throw err;
    }
}

/**
 * Trigger full sync across all active users
 */
async function syncAllUsers() {
    const db = getDb();
    const users = await db.prepare(`SELECT id FROM users WHERE is_deleted = 0 AND COALESCE(is_participant, 1) = 1`).all();
    
    for (const u of users) {
        try {
            await syncUser(u.id);
            await new Promise(r => setTimeout(r, config.FETCH_DELAY_MS));
        } catch (e) {
            console.error(`Sync failed for user ${u.id}:`, e.message);
        }
    }
    
    await recomputeAllStats();
}

module.exports = {
    getChallengeConfig,
    getChallengeStartMs,
    getCurrentChallengeDay,
    syncUser,
    syncAllUsers,
    recomputeAllStats
};
