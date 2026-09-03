-- Login accounts
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
    is_superadmin INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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
);

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
);

CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    date_fetched TEXT NOT NULL,
    total_easy INTEGER NOT NULL DEFAULT 0,
    total_medium INTEGER NOT NULL DEFAULT 0,
    total_hard INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS challenge_baselines (
    challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    challenge_start_date TEXT NOT NULL,
    captured_at TEXT NOT NULL DEFAULT (datetime('now')),
    total_easy INTEGER NOT NULL DEFAULT 0,
    total_medium INTEGER NOT NULL DEFAULT 0,
    total_hard INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (challenge_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_stats (
    challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
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
);

CREATE TABLE IF NOT EXISTS credited_problems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title_slug TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    credit_type TEXT NOT NULL,
    points_awarded REAL NOT NULL,
    day_number INTEGER NOT NULL,
    credited_at TEXT DEFAULT (datetime('now')),
    UNIQUE(challenge_id, user_id, title_slug)
);

CREATE TABLE IF NOT EXISTS processed_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    submission_id TEXT NOT NULL,
    title_slug TEXT NOT NULL,
    processed_at TEXT DEFAULT (datetime('now')),
    UNIQUE(challenge_id, user_id, submission_id)
);

CREATE TABLE IF NOT EXISTS problem_cache (
    title_slug TEXT PRIMARY KEY,
    difficulty TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scoring_config_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot TEXT NOT NULL,
    saved_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS forum_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_id INTEGER REFERENCES challenges(id) ON DELETE CASCADE,
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
