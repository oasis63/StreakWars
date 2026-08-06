const config = require('../config');

const PUBLIC_RECENT_SUBMISSIONS_LIMIT = 20;

/**
 * Decide how an eligible accepted submission should be credited.
 *
 * LeetCode exposes aggregate accepted counts by difficulty.  A positive
 * remaining capacity means this submission can account for one new solve
 * since the challenge baseline; otherwise it is a resubmission.
 */
function getSubmissionCredit(difficulty, freshCapacity) {
    const difficultyKey = (difficulty || 'Easy').toLowerCase();
    const hasFreshCapacity = Object.prototype.hasOwnProperty.call(freshCapacity, difficultyKey)
        && freshCapacity[difficultyKey] > 0;

    return {
        difficultyKey,
        creditType: hasFreshCapacity ? 'fresh' : 'resubmit',
        pointsAwarded: hasFreshCapacity
            ? (config.POINTS[difficultyKey] || config.POINTS.easy)
            : (config.RESUBMIT_POINTS[difficultyKey] || config.RESUBMIT_POINTS.easy)
    };
}

function consumeFreshCapacity(freshCapacity, difficultyKey) {
    if (Object.prototype.hasOwnProperty.call(freshCapacity, difficultyKey)
        && freshCapacity[difficultyKey] > 0) {
        freshCapacity[difficultyKey] -= 1;
    }
}

function getSubmissionWindowWarning(submissions, challengeStartMs) {
    if (submissions.length < PUBLIC_RECENT_SUBMISSIONS_LIMIT) return null;

    const oldestSubmissionMs = Math.min(...submissions.map(sub => sub.timestamp * 1000));
    if (oldestSubmissionMs < challengeStartMs) return null;

    return `LeetCode returned its public limit of ${PUBLIC_RECENT_SUBMISSIONS_LIMIT} accepted submissions; older challenge submissions may be missing.`;
}

module.exports = {
    PUBLIC_RECENT_SUBMISSIONS_LIMIT,
    getSubmissionCredit,
    consumeFreshCapacity,
    getSubmissionWindowWarning
};
