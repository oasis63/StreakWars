const crypto = require('crypto');
const { getChallengeStartMs, getChallengeEndMs, getDayNumber } = require('../services/gameEngineDates');

function inviteCode() {
    return crypto.randomBytes(4).toString('hex');
}

function getIstDateString(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const value = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
    return `${value.year}-${value.month}-${value.day}`;
}

function deriveStatus(startDate, endDate, currentStatus, durationDays) {
    if (currentStatus === 'archived') return 'archived';
    const now = Date.now();
    if (now < getChallengeStartMs(startDate)) return 'scheduled';
    if (now > getChallengeEndMs(endDate)) return 'completed';
    const duration = parseInt(durationDays, 10);
    if (duration > 0 && getDayNumber(now, startDate) > duration) return 'completed';
    return 'active';
}

async function pgHasColumn(pool, table, column) {
    const res = await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
        [table, column]
    );
    return res.rowCount > 0;
}

async function pgTableExists(pool, table) {
    const res = await pool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
        [table]
    );
    return res.rowCount > 0;
}

async function migratePostgres(pool) {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superadmin INTEGER DEFAULT 0`).catch(() => {});

    await pool.query(`
        CREATE TABLE IF NOT EXISTS challenges (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            duration_days INTEGER NOT NULL DEFAULT 30,
            start_date VARCHAR(10) NOT NULL,
            end_date VARCHAR(10) NOT NULL,
            party_stakes TEXT NOT NULL DEFAULT 'lowest score buys the party',
            created_by INTEGER REFERENCES users(id),
            status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
            invite_code VARCHAR(32) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS challenge_members (
            id SERIAL PRIMARY KEY,
            challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id),
            role VARCHAR(32) NOT NULL DEFAULT 'participant',
            name VARCHAR(255) NOT NULL,
            leetcode_username VARCHAR(255) NOT NULL,
            color VARCHAR(50) NOT NULL DEFAULT '#6366f1',
            emoji VARCHAR(50) DEFAULT '👤',
            car_emoji VARCHAR(50) DEFAULT '🏎️',
            removed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(challenge_id, user_id)
        )
    `);

    const statsHasChallenge = await pgHasColumn(pool, 'user_stats', 'challenge_id');
    if (!statsHasChallenge && await pgTableExists(pool, 'user_stats')) {
        await rebuildPgScoringTables(pool);
    }

    await pool.query(`ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS challenge_id INTEGER REFERENCES challenges(id) ON DELETE CASCADE`).catch(() => {});

    await seedFromLegacyConfig(async (sql, params = []) => {
        const res = await pool.query(sql, params);
        return { rows: res.rows, rowCount: res.rowCount };
    }, true);
}

async function rebuildPgScoringTables(pool) {
    await pool.query(`ALTER TABLE challenge_baselines DROP CONSTRAINT IF EXISTS challenge_baselines_pkey`).catch(() => {});
    await pool.query(`ALTER TABLE user_stats DROP CONSTRAINT IF EXISTS user_stats_pkey`).catch(() => {});
    await pool.query(`ALTER TABLE credited_problems DROP CONSTRAINT IF EXISTS unique_user_problem`).catch(() => {});
    await pool.query(`ALTER TABLE processed_submissions DROP CONSTRAINT IF EXISTS unique_user_submission`).catch(() => {});

    await pool.query(`ALTER TABLE challenge_baselines ADD COLUMN IF NOT EXISTS challenge_id INTEGER`);
    await pool.query(`ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS challenge_id INTEGER`);
    await pool.query(`ALTER TABLE credited_problems ADD COLUMN IF NOT EXISTS challenge_id INTEGER`);
    await pool.query(`ALTER TABLE processed_submissions ADD COLUMN IF NOT EXISTS challenge_id INTEGER`);

    await pool.query(`UPDATE challenge_baselines SET challenge_id = 1 WHERE challenge_id IS NULL`);
    await pool.query(`UPDATE user_stats SET challenge_id = 1 WHERE challenge_id IS NULL`);
    await pool.query(`UPDATE credited_problems SET challenge_id = 1 WHERE challenge_id IS NULL`);
    await pool.query(`UPDATE processed_submissions SET challenge_id = 1 WHERE challenge_id IS NULL`);
}

async function finalizePgConstraints(pool) {
    const count = await pool.query(`SELECT COUNT(*)::int AS n FROM challenges`);
    if (!count.rows[0] || count.rows[0].n === 0) return;

    await pool.query(`
        ALTER TABLE challenge_baselines
        ADD CONSTRAINT challenge_baselines_challenge_user PRIMARY KEY (challenge_id, user_id)
    `).catch(() => {});
    await pool.query(`
        ALTER TABLE user_stats
        ADD CONSTRAINT user_stats_challenge_user PRIMARY KEY (challenge_id, user_id)
    `).catch(() => {});
    await pool.query(`
        ALTER TABLE credited_problems
        ADD CONSTRAINT unique_challenge_user_problem UNIQUE (challenge_id, user_id, title_slug)
    `).catch(() => {});
    await pool.query(`
        ALTER TABLE processed_submissions
        ADD CONSTRAINT unique_challenge_user_submission UNIQUE (challenge_id, user_id, submission_id)
    `).catch(() => {});

    await pool.query(`
        ALTER TABLE challenge_baselines
        ADD CONSTRAINT challenge_baselines_challenge_fk
        FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    `).catch(() => {});
    await pool.query(`
        ALTER TABLE user_stats
        ADD CONSTRAINT user_stats_challenge_fk
        FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    `).catch(() => {});
    await pool.query(`
        ALTER TABLE credited_problems
        ADD CONSTRAINT credited_problems_challenge_fk
        FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    `).catch(() => {});
    await pool.query(`
        ALTER TABLE processed_submissions
        ADD CONSTRAINT processed_submissions_challenge_fk
        FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    `).catch(() => {});
}

function sqliteHasColumn(db, table, column) {
    try {
        const rows = db.prepare(`PRAGMA table_info(${table})`).all();
        return rows.some((r) => r.name === column);
    } catch {
        return false;
    }
}

function sqliteTableExists(db, table) {
    try {
        const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
        return Boolean(row);
    } catch {
        return false;
    }
}

function migrateSqlite(db) {
    try { db.exec(`ALTER TABLE users ADD COLUMN is_superadmin INTEGER DEFAULT 0`); } catch {}

    db.exec(`
        CREATE TABLE IF NOT EXISTS challenges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            duration_days INTEGER NOT NULL DEFAULT 30,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            party_stakes TEXT NOT NULL DEFAULT 'lowest score buys the party',
            created_by INTEGER REFERENCES users(id),
            status TEXT NOT NULL DEFAULT 'scheduled',
            invite_code TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS challenge_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id),
            role TEXT NOT NULL DEFAULT 'participant',
            name TEXT NOT NULL,
            leetcode_username TEXT NOT NULL,
            color TEXT NOT NULL DEFAULT '#6366f1',
            emoji TEXT DEFAULT '👤',
            car_emoji TEXT DEFAULT '🏎️',
            removed_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(challenge_id, user_id)
        )
    `);

    if (sqliteTableExists(db, 'user_stats') && !sqliteHasColumn(db, 'user_stats', 'challenge_id')) {
        try {
            rebuildSqliteScoringTables(db);
        } catch (err) {
            console.warn('SQLite scoring table rebuild skipped:', err.message);
        }
    }

    try { db.exec(`ALTER TABLE forum_posts ADD COLUMN challenge_id INTEGER REFERENCES challenges(id) ON DELETE CASCADE`); } catch {}
}

function rebuildSqliteScoringTables(db) {
    db.exec(`ALTER TABLE challenge_baselines RENAME TO challenge_baselines_legacy`);
    db.exec(`ALTER TABLE user_stats RENAME TO user_stats_legacy`);
    db.exec(`ALTER TABLE credited_problems RENAME TO credited_problems_legacy`);
    db.exec(`ALTER TABLE processed_submissions RENAME TO processed_submissions_legacy`);

    db.exec(`
        CREATE TABLE challenge_baselines (
            challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL,
            challenge_start_date TEXT NOT NULL,
            captured_at TEXT NOT NULL DEFAULT (datetime('now')),
            total_easy INTEGER NOT NULL DEFAULT 0,
            total_medium INTEGER NOT NULL DEFAULT 0,
            total_hard INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (challenge_id, user_id)
        )
    `);
    db.exec(`
        CREATE TABLE user_stats (
            challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL,
            easy_solved INTEGER DEFAULT 0,
            medium_solved INTEGER DEFAULT 0,
            hard_solved INTEGER DEFAULT 0,
            score_raw REAL DEFAULT 0,
            score_final REAL DEFAULT 0,
            streak_bonus REAL DEFAULT 0,
            current_streak INTEGER DEFAULT 0,
            longest_streak INTEGER DEFAULT 0,
            on_fire INTEGER DEFAULT 0,
            multiplier_active INTEGER DEFAULT 0,
            reactive_icon TEXT DEFAULT '',
            badges TEXT DEFAULT '[]',
            last_synced TEXT,
            fresh_solves INTEGER DEFAULT 0,
            resubmit_count INTEGER DEFAULT 0,
            fresh_pts REAL DEFAULT 0,
            resubmit_pts REAL DEFAULT 0,
            sync_status TEXT DEFAULT 'verified',
            sync_warning TEXT DEFAULT '',
            PRIMARY KEY (challenge_id, user_id)
        )
    `);
    db.exec(`
        CREATE TABLE credited_problems (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL,
            title_slug TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            credit_type TEXT NOT NULL,
            points_awarded REAL NOT NULL,
            day_number INTEGER NOT NULL,
            credited_at TEXT DEFAULT (datetime('now')),
            UNIQUE(challenge_id, user_id, title_slug)
        )
    `);
    db.exec(`
        CREATE TABLE processed_submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL,
            submission_id TEXT NOT NULL,
            title_slug TEXT NOT NULL,
            processed_at TEXT DEFAULT (datetime('now')),
            UNIQUE(challenge_id, user_id, submission_id)
        )
    `);

    db.exec(`INSERT INTO challenge_baselines (challenge_id, user_id, challenge_start_date, captured_at, total_easy, total_medium, total_hard)
        SELECT 1, user_id, challenge_start_date, captured_at, total_easy, total_medium, total_hard FROM challenge_baselines_legacy`);
    db.exec(`INSERT INTO user_stats (
            challenge_id, user_id, easy_solved, medium_solved, hard_solved, score_raw, score_final, streak_bonus,
            current_streak, longest_streak, on_fire, multiplier_active, reactive_icon, badges, last_synced,
            fresh_solves, resubmit_count, fresh_pts, resubmit_pts, sync_status, sync_warning
        ) SELECT 1, user_id, easy_solved, medium_solved, hard_solved, score_raw, score_final, streak_bonus,
            current_streak, longest_streak, on_fire, multiplier_active, reactive_icon, badges, last_synced,
            fresh_solves, resubmit_count, fresh_pts, resubmit_pts, sync_status, sync_warning FROM user_stats_legacy`);
    db.exec(`INSERT INTO credited_problems (id, challenge_id, user_id, title_slug, difficulty, credit_type, points_awarded, day_number, credited_at)
        SELECT id, 1, user_id, title_slug, difficulty, credit_type, points_awarded, day_number, credited_at FROM credited_problems_legacy`);
    db.exec(`INSERT INTO processed_submissions (id, challenge_id, user_id, submission_id, title_slug, processed_at)
        SELECT id, 1, user_id, submission_id, title_slug, processed_at FROM processed_submissions_legacy`);

    db.exec(`DROP TABLE challenge_baselines_legacy`);
    db.exec(`DROP TABLE user_stats_legacy`);
    db.exec(`DROP TABLE credited_problems_legacy`);
    db.exec(`DROP TABLE processed_submissions_legacy`);
}

async function seedFromLegacyConfig(query, isPg) {
    const existing = isPg
        ? (await query(`SELECT id FROM challenges LIMIT 1`)).rows[0]
        : (await query(`SELECT id FROM challenges LIMIT 1`)).rows[0];
    if (existing) {
        await seedSuperadmin(query, isPg);
        return;
    }

    const cfgRows = (await query(`SELECT key, value FROM config`)).rows || [];
    const cfg = {};
    for (const r of cfgRows) cfg[r.key] = r.value;
    if (!cfg.challenge_title) {
        await seedSuperadmin(query, isPg);
        return;
    }

    const stakesRow = (await query(`SELECT value FROM app_settings WHERE key = ${isPg ? '$1' : '?'}`, ['party_stakes'])).rows[0];
    const stakes = (stakesRow && stakesRow.value) || 'lowest score buys the party';
    const durationDays = parseInt(cfg.challenge_duration_days, 10) || 30;
    const status = deriveStatus(cfg.challenge_start_date, cfg.challenge_end_date, 'active', durationDays);
    const code = inviteCode();

    if (isPg) {
        await query(
            `INSERT INTO challenges (title, duration_days, start_date, end_date, party_stakes, status, invite_code)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [cfg.challenge_title, durationDays, cfg.challenge_start_date, cfg.challenge_end_date, stakes, status, code]
        );
    } else {
        await query(
            `INSERT INTO challenges (title, duration_days, start_date, end_date, party_stakes, status, invite_code)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [cfg.challenge_title, durationDays, cfg.challenge_start_date, cfg.challenge_end_date, stakes, status, code]
        );
    }

    const ch = (await query(`SELECT id FROM challenges ORDER BY id ASC LIMIT 1`)).rows[0];
    const challengeId = ch.id;

    const users = (await query(
        isPg
            ? `SELECT * FROM users WHERE is_deleted = 0 AND COALESCE(is_participant, 1) = 1`
            : `SELECT * FROM users WHERE is_deleted = 0 AND COALESCE(is_participant, 1) = 1`
    )).rows || [];

    for (const u of users) {
        if (isPg) {
            await query(
                `INSERT INTO challenge_members (challenge_id, user_id, role, name, leetcode_username, color, emoji, car_emoji)
                 VALUES ($1, $2, 'participant', $3, $4, $5, $6, $7)
                 ON CONFLICT (challenge_id, user_id) DO NOTHING`,
                [challengeId, u.id, u.name, u.leetcode_username, u.color || '#6366f1', u.emoji || '👤', u.car_emoji || '🏎️']
            );
        } else {
            await query(
                `INSERT OR IGNORE INTO challenge_members (challenge_id, user_id, role, name, leetcode_username, color, emoji, car_emoji)
                 VALUES (?, ?, 'participant', ?, ?, ?, ?, ?)`,
                [challengeId, u.id, u.name, u.leetcode_username, u.color || '#6366f1', u.emoji || '👤', u.car_emoji || '🏎️']
            );
        }
    }

    if (isPg) {
        await query(`UPDATE forum_posts SET challenge_id = $1 WHERE challenge_id IS NULL`, [challengeId]);
        await query(`UPDATE challenge_baselines SET challenge_id = $1 WHERE challenge_id IS NULL`, [challengeId]);
        await query(`UPDATE user_stats SET challenge_id = $1 WHERE challenge_id IS NULL`, [challengeId]);
        await query(`UPDATE credited_problems SET challenge_id = $1 WHERE challenge_id IS NULL`, [challengeId]);
        await query(`UPDATE processed_submissions SET challenge_id = $1 WHERE challenge_id IS NULL`, [challengeId]);
    } else {
        await query(`UPDATE forum_posts SET challenge_id = ? WHERE challenge_id IS NULL`, [challengeId]);
    }

    await seedSuperadmin(query, isPg, challengeId);
}

async function seedSuperadmin(query, isPg, challengeId) {
    if (isPg) {
        await query(`
            UPDATE users SET is_superadmin = 1
            WHERE LOWER(COALESCE(username, '')) = 'rajesh'
               OR LOWER(COALESCE(leetcode_username, '')) = 'rajesh'
               OR LOWER(COALESCE(name, '')) = 'rajesh'
        `);
    } else {
        await query(`
            UPDATE users SET is_superadmin = 1
            WHERE LOWER(COALESCE(username, '')) = 'rajesh'
               OR LOWER(COALESCE(leetcode_username, '')) = 'rajesh'
               OR LOWER(COALESCE(name, '')) = 'rajesh'
        `);
    }

    if (!challengeId) return;
    const rajesh = (await query(
        isPg
            ? `SELECT id FROM users WHERE is_superadmin = 1 ORDER BY id ASC LIMIT 1`
            : `SELECT id FROM users WHERE is_superadmin = 1 ORDER BY id ASC LIMIT 1`
    )).rows[0];
    if (!rajesh) return;

    if (isPg) {
        await query(
            `UPDATE challenge_members SET role = 'admin' WHERE challenge_id = $1 AND user_id = $2`,
            [challengeId, rajesh.id]
        );
        await query(`UPDATE challenges SET created_by = $1 WHERE id = $2 AND created_by IS NULL`, [rajesh.id, challengeId]);
    } else {
        await query(
            `UPDATE challenge_members SET role = 'admin' WHERE challenge_id = ? AND user_id = ?`,
            [challengeId, rajesh.id]
        );
        await query(`UPDATE challenges SET created_by = ? WHERE id = ? AND created_by IS NULL`, [rajesh.id, challengeId]);
    }
}

async function migrateMultiChallenge({ usePostgres, pgPool, sqliteDb }) {
    if (usePostgres && pgPool) {
        await migratePostgres(pgPool);
        await finalizePgConstraints(pgPool);
        return;
    }
    if (sqliteDb) {
        migrateSqlite(sqliteDb);
        const query = async (sql, params = []) => {
            const trimmed = sql.trim();
            if (/^\s*SELECT/i.test(trimmed)) {
                const stmt = sqliteDb.prepare(sql);
                const rows = params.length ? stmt.all(...params) : stmt.all();
                return { rows: Array.isArray(rows) ? rows : (rows ? [rows] : []) };
            }
            const stmt = sqliteDb.prepare(sql);
            if (params.length) stmt.run(...params);
            else stmt.run();
            return { rows: [] };
        };
        await seedFromLegacyConfig(query, false);
    }
}

module.exports = { migrateMultiChallenge, inviteCode, deriveStatus, getIstDateString };
