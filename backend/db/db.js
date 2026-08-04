const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

let dbInstance = null;

function getDb(dbPath) {
    if (!dbInstance) {
        const dbFile = dbPath || path.join(__dirname, 'streakwars.db');
        dbInstance = new DatabaseSync(dbFile);
        
        try {
            dbInstance.exec('PRAGMA journal_mode = WAL;');
            dbInstance.exec('PRAGMA foreign_keys = ON;');
        } catch (e) {
            console.error('PRAGMA error:', e.message);
        }

        const schemaPath = path.join(__dirname, 'schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            dbInstance.exec(schemaSql);
        }

        migrate(dbInstance);
    }
    return dbInstance;
}

function migrate(db) {
    const alterations = [
        "ALTER TABLE user_stats ADD COLUMN fresh_solves INTEGER DEFAULT 0",
        "ALTER TABLE user_stats ADD COLUMN resubmit_count INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN is_deleted INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN emoji TEXT DEFAULT '👤'",
        "ALTER TABLE users ADD COLUMN car_emoji TEXT DEFAULT '🏎️'"
    ];
    for (const sql of alterations) {
        try { db.exec(sql); } catch {}
    }
    seedSettings(db);
}

function seedSettings(db) {
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)")
      .run('party_stakes', 'lowest score buys the party');
}

module.exports = {
    getDb,
    migrate,
    seedSettings
};
