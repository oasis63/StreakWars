// backend/db/db.js - Persistent PostgreSQL Database Client
const { Pool } = require('pg');
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const RENDER_POSTGRES_URL = 'postgresql://root:vdoDH7q3cflXYnb8qqlzGwlXnBwkhaEm@dpg-d9p0a1favr4c73ac5co0-a.oregon-postgres.render.com/postgres_db_gxm3';

let usePostgres = false;
let sqliteDb = null;
let pgPool = null;
let isInitialized = false;

function convertSqlForPg(sql) {
    let index = 1;
    let converted = sql.replace(/\?/g, () => `$${index++}`);
    converted = converted.replace(/INSERT OR REPLACE INTO config/gi, `INSERT INTO config`);
    converted = converted.replace(/INSERT OR IGNORE INTO app_settings/gi, `INSERT INTO app_settings`);
    return converted;
}

/**
 * Initialize database connection (Render PostgreSQL or SQLite fallback)
 */
async function initDb() {
    if (isInitialized) return;

    // Default to environment variable or hardcoded Render PostgreSQL URL
    const dbUrl = process.env.DATABASE_URL || process.env.INTERNAL_DATABASE_URL || RENDER_POSTGRES_URL;

    const poolConfig = {
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000
    };

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

        console.log('🐘 PostgreSQL database (Render) connected & initialized successfully.');
        isInitialized = true;
        return;
    } catch (err) {
        console.warn(`⚠️ PostgreSQL connection failed (${err.message}). Falling back to embedded SQLite database...`);
        usePostgres = false;
        if (pgPool) {
            try { await pgPool.end(); } catch (e) {}
            pgPool = null;
        }
    }

    // Fallback to SQLite
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
            "ALTER TABLE users ADD COLUMN is_deleted INTEGER DEFAULT 0",
            "ALTER TABLE users ADD COLUMN emoji TEXT DEFAULT '👤'",
            "ALTER TABLE users ADD COLUMN car_emoji TEXT DEFAULT '🏎️'"
        ];
        for (const sql of alterations) {
            try { sqliteDb.exec(sql); } catch {}
        }

        sqliteDb.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)").run('party_stakes', 'lowest score buys the party');

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
                return {
                    rowCount: res.rowCount,
                    lastInsertRowid: res.rows[0] ? res.rows[0].id : null
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

module.exports = {
    getDb,
    initDb,
    prepare,
    exec
};
