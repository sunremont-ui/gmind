CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_topic_id ON comments (topic_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments (user_id);