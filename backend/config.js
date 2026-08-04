// backend/config.js - scoring constants (not editable via UI)
module.exports = {
    // 1. Fresh submit -> Full points (1 / 3 / 5)
    POINTS: { easy: 1, medium: 3, hard: 5 },

    // 2. Resubmit of a pre-challenge solve -> Half points (0.5 / 1.5 / 2.5) from Day 1
    RESUBMIT_POINTS: { easy: 0.5, medium: 1.5, hard: 2.5 },
    RESUBMIT_HALF_CREDIT_START_DAY: 0, // Active from Day 1 onwards

    // 3. Resubmit of anything already credited during the challenge -> 0 points always
    // Enforced by UNIQUE(user_id, title_slug) guard in credited_problems table

    STREAK_BONUS_INTERVAL: 3,           // +1pt every 3 consecutive days with at least 1 solve
    UNDERDOG_DAY: 7,                    // Underdog 1.5x multiplier after day 7
    UNDERDOG_MULTIPLIER: 1.5,
    FETCH_DELAY_MS: 1500                // delay between LeetCode API calls per user
};
