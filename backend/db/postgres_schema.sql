-- Active participants & registered global users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    leetcode_username VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) UNIQUE,
    display_name VARCHAR(255),
    pin_code VARCHAR(10) DEFAULT '1234',
    avatar_emoji VARCHAR(50) DEFAULT '👤',
    avatar_color VARCHAR(50) DEFAULT '#6366f1',
    color VARCHAR(50) NOT NULL DEFAULT '#6366f1',
    emoji VARCHAR(50) DEFAULT '👤',
    car_emoji VARCHAR(50) DEFAULT '🏎️',
    is_participant INTEGER DEFAULT 1,
    is_deleted INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Global config (challenge_title, challenge_duration_days, challenge_start_date, challenge_end_date)
CREATE TABLE IF NOT EXISTS config (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL
);

-- Raw LeetCode aggregate snapshots (polled hourly)
CREATE TABLE IF NOT EXISTS snapshots (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_fetched TIMESTAMP NOT NULL,
    total_easy INTEGER NOT NULL DEFAULT 0,
    total_medium INTEGER NOT NULL DEFAULT 0,
    total_hard INTEGER NOT NULL DEFAULT 0
);

-- Computed scores & game state -- rebuilt on every sync by gameEngine
CREATE TABLE IF NOT EXISTS user_stats (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    easy_solved INTEGER DEFAULT 0,
    medium_solved INTEGER DEFAULT 0,
    hard_solved INTEGER DEFAULT 0,
    score_raw DOUBLE PRECISION DEFAULT 0,
    score_final DOUBLE PRECISION DEFAULT 0,
    streak_bonus DOUBLE PRECISION DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    on_fire INTEGER DEFAULT 0,
    multiplier_active INTEGER DEFAULT 0,
    reactive_icon VARCHAR(50) DEFAULT '',
    badges TEXT DEFAULT '[]',
    last_synced TIMESTAMPTZ,
    fresh_solves INTEGER DEFAULT 0,
    resubmit_count INTEGER DEFAULT 0,
    fresh_pts DOUBLE PRECISION DEFAULT 0,
    resubmit_pts DOUBLE PRECISION DEFAULT 0
);

-- Per-submission credit log (one row per unique problem slug per user)
CREATE TABLE IF NOT EXISTS credited_problems (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title_slug VARCHAR(255) NOT NULL,
    difficulty VARCHAR(50) NOT NULL,
    credit_type VARCHAR(50) NOT NULL,
    points_awarded DOUBLE PRECISION NOT NULL,
    day_number INTEGER NOT NULL,
    credited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_problem UNIQUE(user_id, title_slug)
);

-- Dedup guard - prevents re-processing a submission across sync runs
CREATE TABLE IF NOT EXISTS processed_submissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submission_id VARCHAR(255) NOT NULL,
    title_slug VARCHAR(255) NOT NULL,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_submission UNIQUE(user_id, submission_id)
);

-- Problem difficulty cache (avoids re-fetching LeetCode for known slugs)
CREATE TABLE IF NOT EXISTS problem_cache (
    title_slug VARCHAR(255) PRIMARY KEY,
    difficulty VARCHAR(50) NOT NULL
);

-- Soft-config editable at runtime (party stakes text, etc.)
CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log of app_settings before any change
CREATE TABLE IF NOT EXISTS scoring_config_history (
    id SERIAL PRIMARY KEY,
    snapshot TEXT NOT NULL,
    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Discussion Forum Posts & Replies
CREATE TABLE IF NOT EXISTS forum_posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) DEFAULT '',
    category VARCHAR(100) DEFAULT 'General',
    author_name VARCHAR(255) NOT NULL,
    author_avatar VARCHAR(50) NOT NULL DEFAULT '🐱‍💻',
    author_color VARCHAR(50) NOT NULL DEFAULT '#6366f1',
    author_handle VARCHAR(100) NOT NULL,
    author_title VARCHAR(100) NOT NULL DEFAULT 'Algo Explorer',
    content TEXT NOT NULL,
    parent_id INTEGER REFERENCES forum_posts(id) ON DELETE CASCADE,
    likes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
