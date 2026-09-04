// backend/db/db.js - PostgreSQL Database Client
const { Pool } = require('pg');
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const { migrateMultiChallenge } = require('./migrateMultiChallenge');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

let usePostgres = false;
let sqliteDb = null;
let pgPool = null;
let isInitialized = false;

function convertSqlForPg(sql) {
    let index = 1;
    let converted = sql.replace(/\?/g, () => `$${index++}`);
    converted = converted.replace(/INSERT OR REPLACE INTO config/gi, `INSERT INTO config`);
    converted = converted.replace(/INSERT OR IGNORE INTO app_settings/gi, `INSERT INTO app_settings`);
    if (/^\s*INSERT\s+INTO/i.test(converted) && !/RETURNING/i.test(converted)) {
        converted += ' RETURNING *';
    }
    return converted;
}

function pgNeedsSsl(dbUrl) {
    if (!dbUrl) return Boolean(process.env.PGSSL);
    return /supabase\.co|render\.com|oregon-postgres|sslmode=require/i.test(dbUrl);
}

function isSupabaseUrl(dbUrl) {
    return /supabase\.co/i.test(dbUrl || '');
}

function isTransactionPooler(dbUrl) {
    return /:6543(\/|\?|$)/.test(dbUrl || '') || /pooler\.supabase\.com:6543/i.test(dbUrl || '');
}

function buildPoolConfig(dbUrl) {
    const supabase = isSupabaseUrl(dbUrl);
    const txPooler = isTransactionPooler(dbUrl);
    // Supabase nano/free has a small connection budget. Default pg Pool max=10
    // plus overlapping Render deploys exhausts it and the DB looks "crashed".
    const max = parseInt(process.env.PG_POOL_MAX, 10)
        || (txPooler ? 8 : supabase ? 4 : 10);

    const base = dbUrl ? {
        connectionString: dbUrl,
        ssl: pgNeedsSsl(dbUrl) ? { rejectUnauthorized: false } : false,
    } : {
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT, 10) || 5432,
        user: process.env.PGUSER || 'streakwars',
        password: process.env.PGPASSWORD || 'streakwars_password',
        database: process.env.PGDATABASE || 'streakwars_db',
        ssl: process.env.PGSSL ? { rejectUnauthorized: false } : false,
    };

    return {
        ...base,
        max,
        min: 0,
        idleTimeoutMillis: 20000,
        connectionTimeoutMillis: supabase ? 15000 : 5000,
        allowExitOnIdle: true,
        keepAlive: true,
    };
}

/**
 * Initialize database connection (PostgreSQL via env or SQLite fallback)
 */
async function initDb() {
    if (isInitialized) return;

    const dbUrl = process.env.DATABASE_URL || process.env.INTERNAL_DATABASE_URL;
    const requirePostgres = Boolean(dbUrl);

    const poolConfig = buildPoolConfig(dbUrl);

    try {
        pgPool = new Pool(poolConfig);
        await pgPool.query('SELECT 1');
        usePostgres = true;

        const pgSchemaPath = path.join(__dirname, 'postgres_schema.sql');
        if (fs.existsSync(pgSchemaPath)) {
            const schemaSql = fs.readFileSync(pgSchemaPath, 'utf8');
            await pgPool.query(schemaSql);
        }

        await pgPool.query(`
            INSERT INTO app_settings (key, value) VALUES ('party_stakes', 'lowest score buys the party')
            ON CONFLICT (key) DO NOTHING
        `);

        await pgPool.query(`ALTER TABLE user_stats ALTER COLUMN last_synced TYPE TIMESTAMPTZ USING last_synced::TIMESTAMPTZ`).catch(() => {});
        await pgPool.query(`ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50) DEFAULT 'verified'`);
        await pgPool.query(`ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS sync_warning TEXT DEFAULT ''`);

        const pgAlterations = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_code VARCHAR(10) DEFAULT '1234'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_emoji VARCHAR(50) DEFAULT '👤'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(50) DEFAULT '#6366f1'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_participant INTEGER DEFAULT 1",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superadmin INTEGER DEFAULT 0",
            "ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT ''",
            "ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'General'",
            "ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS user_id INTEGER"
        ];
        for (const sql of pgAlterations) {
            await pgPool.query(sql).catch(() => {});
        }
        await pgPool.query(`UPDATE user_stats SET sync_status = 'ok', sync_warning = NULL WHERE sync_status = 'needs_review' AND (sync_warning LIKE '%baseline%' OR sync_warning IS NULL OR sync_warning = '')`).catch(() => {});

        await migrateMultiChallenge({ usePostgres: true, pgPool, sqliteDb: null });

        console.log(`🐘 PostgreSQL connected (pool max=${poolConfig.max}${isTransactionPooler(dbUrl) ? ', transaction pooler' : isSupabaseUrl(dbUrl) ? ', supabase' : ''}).`);
        isInitialized = true;
        return;
    } catch (err) {
        console.warn(`⚠️ PostgreSQL connection failed (${err.message}).`);
        usePostgres = false;
        if (pgPool) {
            try { await pgPool.end(); } catch (e) {}
            pgPool = null;
        }
        if (requirePostgres) {
            throw new Error(`PostgreSQL is required in production but connection failed: ${err.message}`);
        }
        console.warn('Falling back to embedded SQLite database...');
    }

    // 2. Fallback to SQLite (DatabaseSync)
    try {
        const sqliteFile = path.join(__dirname, 'streakwars.db');
        sqliteDb = new DatabaseSync(sqliteFile);
        try {
            sqliteDb.exec('PRAGMA journal_mode = WAL;');
            sqliteDb.exec('PRAGMA foreign_keys = ON;');
        } catch (e) {}

        const sqliteSchemaPath = path.join(__dirname, 'schema.sql');
        if (fs.existsSync(sqliteSchemaPath)) {
            const schemaSql = fs.readFileSync(sqliteSchemaPath, 'utf8');
            sqliteDb.exec(schemaSql);
        }

        const alterations = [
            "ALTER TABLE user_stats ADD COLUMN fresh_solves INTEGER DEFAULT 0",
            "ALTER TABLE user_stats ADD COLUMN resubmit_count INTEGER DEFAULT 0",
            "ALTER TABLE user_stats ADD COLUMN fresh_pts REAL DEFAULT 0",
            "ALTER TABLE user_stats ADD COLUMN resubmit_pts REAL DEFAULT 0",
            "ALTER TABLE user_stats ADD COLUMN sync_status TEXT DEFAULT 'verified'",
            "ALTER TABLE user_stats ADD COLUMN sync_warning TEXT DEFAULT ''",
            "ALTER TABLE users ADD COLUMN is_deleted INTEGER DEFAULT 0",
            "ALTER TABLE users ADD COLUMN emoji TEXT DEFAULT '👤'",
            "ALTER TABLE users ADD COLUMN car_emoji TEXT DEFAULT '🏎️'",
            "ALTER TABLE users ADD COLUMN username TEXT",
            "ALTER TABLE users ADD COLUMN display_name TEXT",
            "ALTER TABLE users ADD COLUMN pin_code TEXT DEFAULT '1234'",
            "ALTER TABLE users ADD COLUMN avatar_emoji TEXT DEFAULT '👤'",
            "ALTER TABLE users ADD COLUMN avatar_color TEXT DEFAULT '#6366f1'",
            "ALTER TABLE users ADD COLUMN is_participant INTEGER DEFAULT 1",
            "ALTER TABLE users ADD COLUMN is_superadmin INTEGER DEFAULT 0",
            "ALTER TABLE forum_posts ADD COLUMN title TEXT DEFAULT ''",
            "ALTER TABLE forum_posts ADD COLUMN category TEXT DEFAULT 'General'",
            "ALTER TABLE forum_posts ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))",
            "ALTER TABLE forum_posts ADD COLUMN user_id INTEGER"
        ];
        for (const sql of alterations) {
            try { sqliteDb.exec(sql); } catch {}
        }
        try {
            sqliteDb.exec("UPDATE user_stats SET sync_status = 'ok', sync_warning = NULL WHERE sync_status = 'needs_review' AND (sync_warning LIKE '%baseline%' OR sync_warning IS NULL OR sync_warning = '');");
        } catch (e) {}

        sqliteDb.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)").run('party_stakes', 'lowest score buys the party');

        await migrateMultiChallenge({ usePostgres: false, pgPool: null, sqliteDb });

        console.log('📦 SQLite database connected & initialized successfully.');
        isInitialized = true;
    } catch (e) {
        console.error('Fatal database initialization error:', e.message);
        throw e;
    }
}

/**
 * Prepared statement helper
 */
function prepare(sql) {
    if (usePostgres && pgPool) {
        const pgSql = convertSqlForPg(sql);
        return {
            get: async (...params) => {
                const res = await pgPool.query(pgSql, params.flat());
                return res.rows[0] || null;
            },
            all: async (...params) => {
                const res = await pgPool.query(pgSql, params.flat());
                return res.rows;
            },
            run: async (...params) => {
                const res = await pgPool.query(pgSql, params.flat());
                const insertedRow = res.rows[0] || null;
                return {
                    rowCount: res.rowCount,
                    lastInsertRowid: insertedRow ? insertedRow.id : null,
                    row: insertedRow
                };
            }
        };
    } else if (sqliteDb) {
        const stmt = sqliteDb.prepare(sql);
        return {
            get: async (...params) => stmt.get(...params.flat()) || null,
            all: async (...params) => stmt.all(...params.flat()) || [],
            run: async (...params) => {
                const res = stmt.run(...params.flat());
                return {
                    rowCount: res.changes,
                    lastInsertRowid: res.lastInsertRowid
                };
            }
        };
    }
    throw new Error('Database not initialized');
}

/**
 * Execute raw SQL text
 */
async function exec(sql) {
    if (usePostgres && pgPool) {
        const pgSql = convertSqlForPg(sql);
        return await pgPool.query(pgSql);
    } else if (sqliteDb) {
        return sqliteDb.exec(sql);
    }
}

function getDb() {
    return {
        query: async (text, params) => {
            if (usePostgres && pgPool) {
                return await pgPool.query(convertSqlForPg(text), params);
            } else if (sqliteDb) {
                const stmt = sqliteDb.prepare(text);
                const rows = stmt.all(...(params || []));
                return { rows };
            }
        },
        prepare,
        exec
    };
}

async function closeDb() {
    if (pgPool) {
        try { await pgPool.end(); } catch (e) {}
        pgPool = null;
    }
    sqliteDb = null;
    isInitialized = false;
    usePostgres = false;
}

module.exports = {
    getDb,
    initDb,
    closeDb,
    prepare,
    exec
};
