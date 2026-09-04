#!/usr/bin/env node
/**
 * Copy StreakWars tables from an old Postgres (Render) into the current DATABASE_URL (Supabase).
 *
 * Render shell / local:
 *   SOURCE_DATABASE_URL='postgresql://...' DATABASE_URL='postgresql://...' node backend/scripts/restore-from-source.js
 *
 * Does not drop destination data. Inserts missing rows (ON CONFLICT DO NOTHING).
 */
const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('dotenv').config();

const TABLES = [
    'users',
    'config',
    'app_settings',
    'challenges',
    'challenge_members',
    'snapshots',
    'challenge_baselines',
    'user_stats',
    'credited_problems',
    'processed_submissions',
    'problem_cache',
    'scoring_config_history',
    'forum_posts',
];

function poolFromUrl(url) {
    if (!url) throw new Error('Missing database URL');
    let connectionString = url;
    try {
        const parsed = new URL(url);
        parsed.searchParams.delete('sslmode');
        connectionString = parsed.toString();
    } catch { /* keep raw */ }
    return new Pool({
        connectionString,
        ssl: /supabase|render\.com|sslmode=require/i.test(url) ? { rejectUnauthorized: false } : false,
        max: 2,
    });
}

async function copyTable(src, dest, table) {
    const exists = await src.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
        [table]
    );
    if (!exists.rowCount) {
        console.log(`skip ${table} (not in source)`);
        return;
    }
    const destExists = await dest.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
        [table]
    );
    if (!destExists.rowCount) {
        console.log(`skip ${table} (not in destination)`);
        return;
    }

    const srcCols = (await src.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
        [table]
    )).rows.map((r) => r.column_name);
    const destCols = new Set((await dest.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
        [table]
    )).rows.map((r) => r.column_name));
    const cols = srcCols.filter((c) => destCols.has(c));
    if (!cols.length) return;

    const rows = (await src.query(`SELECT ${cols.map((c) => `"${c}"`).join(', ')} FROM ${table}`)).rows;
    let inserted = 0;
    for (const row of rows) {
        const values = cols.map((c) => row[c]);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
        const quoted = cols.map((c) => `"${c}"`).join(', ');
        try {
            const res = await dest.query(
                `INSERT INTO ${table} (${quoted}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
                values
            );
            inserted += res.rowCount || 0;
        } catch (err) {
            console.warn(`${table} row skipped: ${err.message}`);
        }
    }
    console.log(`${table}: copied ${rows.length} source rows, inserted ${inserted} new`);
}

async function resetSequence(dest, table) {
    const seq = (await dest.query(
        `SELECT pg_get_serial_sequence($1, 'id') AS seq`,
        [`public.${table}`]
    ).catch(() => ({ rows: [{}] }))).rows[0];
    if (!seq || !seq.seq) return;
    await dest.query(
        `SELECT setval($1, COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`,
        [seq.seq]
    ).catch(() => {});
}

async function main() {
    const sourceUrl = process.env.SOURCE_DATABASE_URL;
    const destUrl = process.env.DATABASE_URL;
    if (!sourceUrl || !destUrl) {
        throw new Error('Set SOURCE_DATABASE_URL (old Render DB) and DATABASE_URL (Supabase).');
    }
    if (sourceUrl === destUrl) {
        throw new Error('SOURCE_DATABASE_URL and DATABASE_URL must be different.');
    }

    const src = poolFromUrl(sourceUrl);
    const dest = poolFromUrl(destUrl);
    try {
        await src.query('SELECT 1');
        await dest.query('SELECT 1');
        for (const table of TABLES) {
            await copyTable(src, dest, table);
        }
        for (const table of ['users', 'challenges', 'challenge_members', 'credited_problems', 'forum_posts', 'snapshots']) {
            await resetSequence(dest, table);
        }
        console.log('Restore finished.');
    } finally {
        await src.end();
        await dest.end();
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
