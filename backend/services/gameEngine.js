// backend/services/gameEngine.js
const { getDb } = require('../db/db');
const config = require('../config');
const leetcodeApi = require('./leetcodeApi');

/**
 * Get global challenge configuration from database
 */
function getChallengeConfig() {
    const db = getDb();
    const rows = db.prepare(`SELECT key, value FROM config`).all();
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
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return new Date(year, month, day, 0, 0, 0, 0).getTime();
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
function getCurrentChallengeDay() {
    const cfg = getChallengeConfig();
    if (!cfg.challenge_start_date) return 1;
    return getDayNumber(Date.now(), cfg.challenge_start_date);
}

/**
 * Process single user sync: fetch stats & recent submissions -> credited problems log
 *
 * Scoring Rules Enforced:
 * 1. STRICT DATE FILTER: Submissions before challenge_start_date (subMs < startMs) are SKIPPED.
 * 2. Fresh submit on or after start date -> Full points (Easy=1, Medium=3, Hard=5)
 * 3. Resubmit of a pre-challenge solve -> Half points (Easy=0.5, Medium=1.5, Hard=2.5) from Day 1
 * 4. Resubmit of anything ALREADY CREDITED during the challenge -> 0 points ALWAYS (skipped)
 */
async function syncUser(userId) {
    const db = getDb();
    const user = db.prepare(`SELECT * FROM users WHERE id = ? AND is_deleted = 0`).get(userId);
    if (!user) return;

    const cfg = getChallengeConfig();
    const startDateStr = cfg.challenge_start_date || new Date().toISOString().split('T')[0];
    const startMs = getChallengeStartMs(startDateStr);

    // 1. Fetch latest stats from LeetCode
    const stats = await leetcodeApi.getUserStats(user.leetcode_username);
    const nowIso = new Date().toISOString();

    // 2. Insert aggregate snapshot
    db.prepare(`
        INSERT INTO snapshots (user_id, date_fetched, total_easy, total_medium, total_hard)
        VALUES (?, ?, ?, ?, ?)
    `).run(userId, nowIso, stats.easy, stats.medium, stats.hard);

    // 3. Fetch recent accepted submissions from LeetCode
    const recentSubmissions = await leetcodeApi.getRecentSubmissions(user.leetcode_username, 25);
    
    // Sort oldest to newest
    recentSubmissions.sort((a, b) => a.timestamp - b.timestamp);

    for (const sub of recentSubmissions) {
        const subMs = sub.timestamp * 1000;
        
        // STRICT FILTER: Skip all submissions made BEFORE challenge start date
        if (subMs < startMs) continue;

        // RULE: Resubmit of anything already credited during the challenge -> 0 points ALWAYS
        const alreadyCredited = db.prepare(`
            SELECT id FROM credited_problems WHERE user_id = ? AND title_slug = ?
        `).get(userId, sub.titleSlug);
        if (alreadyCredited) {
            continue; // Skip (0 points)
        }

        // Deduplication guard for submission ID
        const alreadyProcessed = db.prepare(`
            SELECT id FROM processed_submissions WHERE user_id = ? AND submission_id = ?
        `).get(userId, sub.id);
        if (alreadyProcessed) continue;

        try {
            db.prepare(`
                INSERT INTO processed_submissions (user_id, submission_id, title_slug)
                VALUES (?, ?, ?)
            `).run(userId, sub.id, sub.titleSlug);
        } catch (e) {}

        // Lookup problem difficulty
        const diffStr = await leetcodeApi.getProblemDifficulty(sub.titleSlug);
        const diffKey = (diffStr || 'Easy').toLowerCase();
        const subDay = getDayNumber(subMs, startDateStr);

        const creditType = 'fresh';
        const pointsAwarded = config.POINTS[diffKey] || 1;

        try {
            db.prepare(`
                INSERT INTO credited_problems (user_id, title_slug, difficulty, credit_type, points_awarded, day_number, credited_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(userId, sub.titleSlug, diffStr, creditType, pointsAwarded, subDay, new Date(subMs).toISOString());
        } catch (e) {
            // UNIQUE guard
        }
    }
}

/**
 * Recompute stats for all active users
 */
function recomputeAllStats() {
    const db = getDb();
    const cfg = getChallengeConfig();
    const startDateStr = cfg.challenge_start_date || new Date().toISOString().split('T')[0];
    const currentDay = getCurrentChallengeDay();

    const users = db.prepare(`SELECT * FROM users WHERE is_deleted = 0`).all();
    if (!users || users.length === 0) return;

    db.exec('BEGIN');
    try {
        const userCalculations = [];

        for (const user of users) {
            const credited = db.prepare(`
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
                
                if (item.credit_type === 'fresh') {
                    freshSolves++;
                    if (diff === 'easy') easySolved++;
                    if (diff === 'medium') mediumSolved++;
                    if (diff === 'hard') hardSolved++;
                    freshPts += item.points_awarded;
                } else if (item.credit_type === 'resubmit') {
                    resubmitCount++;
                    resubmitPts += item.points_awarded;
                }

                if (item.day_number > 0) {
                    solvedDaysSet.add(item.day_number);
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
                easy_solved: easySolved,      // ONLY fresh Easy solves
                medium_solved: mediumSolved,  // ONLY fresh Medium solves
                hard_solved: hardSolved,      // ONLY fresh Hard solves
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

        // Sort pre-underdog score desc
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

        // Final sort by score_final desc
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

            db.prepare(`
                INSERT INTO user_stats (
                    user_id, easy_solved, medium_solved, hard_solved,
                    score_raw, score_final, streak_bonus, current_streak,
                    longest_streak, on_fire, multiplier_active, reactive_icon,
                    badges, last_synced, fresh_solves, resubmit_count,
                    fresh_pts, resubmit_pts
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    easy_solved = excluded.easy_solved,
                    medium_solved = excluded.medium_solved,
                    hard_solved = excluded.hard_solved,
                    score_raw = excluded.score_raw,
                    score_final = excluded.score_final,
                    streak_bonus = excluded.streak_bonus,
                    current_streak = excluded.current_streak,
                    longest_streak = excluded.longest_streak,
                    on_fire = excluded.on_fire,
                    multiplier_active = excluded.multiplier_active,
                    reactive_icon = excluded.reactive_icon,
                    badges = excluded.badges,
                    last_synced = excluded.last_synced,
                    fresh_solves = excluded.fresh_solves,
                    resubmit_count = excluded.resubmit_count,
                    fresh_pts = excluded.fresh_pts,
                    resubmit_pts = excluded.resubmit_pts
            `).run(
                calc.user_id, calc.easy_solved, calc.medium_solved, calc.hard_solved,
                calc.score_raw, calc.score_final, calc.streak_bonus, calc.current_streak,
                calc.longest_streak, calc.on_fire, calc.multiplier_active, reactiveIcon,
                JSON.stringify(badges), nowIso, calc.fresh_solves, calc.resubmit_count,
                calc.fresh_pts, calc.resubmit_pts
            );
        }

        db.exec('COMMIT');
    } catch (err) {
        db.exec('ROLLBACK');
        console.error('Error in recomputeAllStats:', err);
        throw err;
    }
}

/**
 * Trigger full sync across all active users
 */
async function syncAllUsers() {
    const db = getDb();
    const users = db.prepare(`SELECT id FROM users WHERE is_deleted = 0`).all();
    
    for (const u of users) {
        try {
            await syncUser(u.id);
            await new Promise(r => setTimeout(r, config.FETCH_DELAY_MS));
        } catch (e) {
            console.error(`Sync failed for user ${u.id}:`, e.message);
        }
    }
    
    recomputeAllStats();
}

module.exports = {
    getChallengeConfig,
    getCurrentChallengeDay,
    syncUser,
    syncAllUsers,
    recomputeAllStats
};
