-- Active participants & registered global users
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    leetcode_username TEXT NOT NULL UNIQUE,
    username TEXT UNIQUE,
    display_name TEXT,
    pin_code TEXT DEFAULT '1234',
    avatar_emoji TEXT DEFAULT '👤',
    avatar_color TEXT DEFAULT '#6366f1',
    color TEXT NOT NULL DEFAULT '#6366f1',
    emoji TEXT DEFAULT '👤',
    car_emoji TEXT DEFAULT '🏎️',
    is_participant INTEGER DEFAULT 1,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Global config (challenge_title, challenge_duration_days, challenge_start_date, challenge_end_date)
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Raw LeetCode aggregate snapshots (polled hourly)
CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    date_fetched TEXT NOT NULL,
    total_easy INTEGER NOT NULL DEFAULT 0,
    total_medium INTEGER NOT NULL DEFAULT 0,
    total_hard INTEGER NOT NULL DEFAULT 0
);

-- Immutable aggregate totals captured before the active challenge begins.
CREATE TABLE IF NOT EXISTS challenge_baselines (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    challenge_start_date TEXT NOT NULL,
    captured_at TEXT NOT NULL DEFAULT (datetime('now')),
    total_easy INTEGER NOT NULL DEFAULT 0,
    total_medium INTEGER NOT NULL DEFAULT 0,
    total_hard INTEGER NOT NULL DEFAULT 0
);

-- Computed scores & game state -- rebuilt on every sync by gameEngine
CREATE TABLE IF NOT EXISTS user_stats (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    easy_solved INTEGER DEFAULT 0,
    medium_solved INTEGER DEFAULT 0,
    hard_solved INTEGER DEFAULT 0,
    score_raw REAL DEFAULT 0,          -- fresh pts + resubmit bonus (pre-multiplier)
    score_final REAL DEFAULT 0,        -- after streak/underdog multipliers
    streak_bonus REAL DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    on_fire INTEGER DEFAULT 0,         -- 1 if streak >= 3
    multiplier_active INTEGER DEFAULT 0,
    reactive_icon TEXT DEFAULT '',
    badges TEXT DEFAULT '[]',          -- JSON array of emoji strings
    last_synced TEXT,
    fresh_solves INTEGER DEFAULT 0,
    resubmit_count INTEGER DEFAULT 0,
    fresh_pts REAL DEFAULT 0,
    resubmit_pts REAL DEFAULT 0,
    sync_status TEXT DEFAULT 'verified',
    sync_warning TEXT DEFAULT ''
);

-- Per-submission credit log (one row per unique problem slug per user)
CREATE TABLE IF NOT EXISTS credited_problems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title_slug TEXT NOT NULL,
    difficulty TEXT NOT NULL,          -- 'Easy' | 'Medium' | 'Hard'
    credit_type TEXT NOT NULL,          -- 'fresh' | 'resubmit'
    points_awarded REAL NOT NULL,
    day_number INTEGER NOT NULL,
    credited_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, title_slug)        -- one credit per problem ever
);

-- Dedup guard - prevents re-processing a submission across sync runs
CREATE TABLE IF NOT EXISTS processed_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    submission_id TEXT NOT NULL,
    title_slug TEXT NOT NULL,
    processed_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, submission_id)
);

-- Problem difficulty cache (avoids re-fetching LeetCode for known slugs)
CREATE TABLE IF NOT EXISTS problem_cache (
    title_slug TEXT PRIMARY KEY,
    difficulty TEXT NOT NULL           -- 'Easy' | 'Medium' | 'Hard'
);

-- Soft-config editable at runtime (party stakes text, etc.)
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audit Log of app_settings before any change
CREATE TABLE IF NOT EXISTS scoring_config_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot TEXT NOT NULL,            -- JSON of all app_settings at time of change
    saved_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Discussion Forum Posts & Replies
CREATE TABLE IF NOT EXISTS forum_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title TEXT DEFAULT '',
    category TEXT DEFAULT 'General',
    author_name TEXT NOT NULL,
    author_avatar TEXT NOT NULL DEFAULT '🐱‍💻',
    author_color TEXT NOT NULL DEFAULT '#6366f1',
    author_handle TEXT NOT NULL,
    author_title TEXT NOT NULL DEFAULT 'Algo Explorer',
    content TEXT NOT NULL,
    parent_id INTEGER REFERENCES forum_posts(id) ON DELETE CASCADE,
    likes INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
