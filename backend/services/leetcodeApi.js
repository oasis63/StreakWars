// backend/services/leetcodeApi.js
const { getDb } = require('../db/db');

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

/**
 * Perform a GraphQL request to LeetCode API
 */
async function fetchLeetCodeGraphQL(query, variables = {}) {
    const response = await fetch(LEETCODE_GRAPHQL_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://leetcode.com'
        },
        body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
        throw new Error(`LeetCode API HTTP error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    if (json.errors && json.errors.length > 0) {
        throw new Error(`LeetCode GraphQL error: ${json.errors[0].message}`);
    }
    return json.data;
}

/**
 * Validate if username exists on LeetCode
 */
async function validateUsername(username) {
    if (!username || typeof username !== 'string' || !username.trim()) return false;
    const cleanUsername = username.trim();
    try {
        const query = `query getUserProfile($username: String!) { matchedUser(username: $username) { username } }`;
        const data = await fetchLeetCodeGraphQL(query, { username: cleanUsername });
        return Boolean(data && data.matchedUser && data.matchedUser.username);
    } catch (err) {
        console.warn(`Username validation failed for "${cleanUsername}":`, err.message);
        return false;
    }
}

/**
 * Fetch aggregate solve count for a user
 * Returns { easy: number, medium: number, hard: number }
 */
async function getUserStats(username) {
    const query = `
      query getUserProfile($username: String!) {
        matchedUser(username: $username) {
          submitStats {
            acSubmissionNum {
              difficulty
              count
            }
          }
        }
      }
    `;

    try {
        const data = await fetchLeetCodeGraphQL(query, { username: username.trim() });
        if (!data || !data.matchedUser || !data.matchedUser.submitStats) {
            return { easy: 0, medium: 0, hard: 0 };
        }

        const statsList = data.matchedUser.submitStats.acSubmissionNum || [];
        let easy = 0, medium = 0, hard = 0;

        for (const item of statsList) {
            const diff = (item.difficulty || '').toLowerCase();
            if (diff === 'easy') easy = item.count || 0;
            if (diff === 'medium') medium = item.count || 0;
            if (diff === 'hard') hard = item.count || 0;
        }

        return { easy, medium, hard };
    } catch (err) {
        console.warn(`Failed to fetch user stats for ${username}:`, err.message);
        const db = getDb();
        const row = await db.prepare(`
            SELECT s.total_easy, s.total_medium, s.total_hard
            FROM snapshots s
            JOIN users u ON s.user_id = u.id
            WHERE u.leetcode_username = ?
            ORDER BY s.id DESC LIMIT 1
        `).get(username.trim());

        if (row) {
            return { easy: row.total_easy, medium: row.total_medium, hard: row.total_hard };
        }
        return { easy: 0, medium: 0, hard: 0 };
    }
}

/**
 * Fetch recent accepted submissions for a user
 * Returns Array of { id, title, titleSlug, timestamp }
 */
async function getRecentSubmissions(username, limit = 20) {
    const query = `
      query recentAcSubmissions($username: String!, $limit: Int!) {
        recentAcSubmissionList(username: $username, limit: $limit) {
          id
          title
          titleSlug
          timestamp
        }
      }
    `;

    try {
        const data = await fetchLeetCodeGraphQL(query, { username: username.trim(), limit });
        if (!data || !data.recentAcSubmissionList) {
            return [];
        }
        return data.recentAcSubmissionList.map(sub => ({
            id: String(sub.id),
            title: sub.title,
            titleSlug: sub.titleSlug,
            timestamp: parseInt(sub.timestamp, 10)
        }));
    } catch (err) {
        console.warn(`Failed to fetch recent submissions for ${username}:`, err.message);
        return [];
    }
}

/**
 * Fetch problem difficulty with DB cache
 */
async function getProblemDifficulty(titleSlug) {
    if (!titleSlug) return 'Easy';
    const db = getDb();

    const cached = await db.prepare(`SELECT difficulty FROM problem_cache WHERE title_slug = ?`).get(titleSlug);
    if (cached) {
        return cached.difficulty;
    }

    const query = `
      query getProblem($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          difficulty
        }
      }
    `;

    try {
        const data = await fetchLeetCodeGraphQL(query, { titleSlug });
        let difficulty = 'Medium';
        if (data && data.question && data.question.difficulty) {
            difficulty = data.question.difficulty;
        }

        await db.prepare(`
            INSERT INTO problem_cache (title_slug, difficulty) VALUES (?, ?)
            ON CONFLICT (title_slug) DO UPDATE SET difficulty = EXCLUDED.difficulty
        `).run(titleSlug, difficulty);
        
        return difficulty;
    } catch (err) {
        console.warn(`Failed to fetch difficulty for ${titleSlug}:`, err.message);
        return 'Medium';
    }
}

module.exports = {
    validateUsername,
    getUserStats,
    getRecentSubmissions,
    getProblemDifficulty
};
