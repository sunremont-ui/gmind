CREATE TABLE IF NOT EXISTS workbooks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workbook_collaborators (
    workbook_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'editor',
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (workbook_id, user_id)
);

CREATE TABLE IF NOT EXISTS agent_tasks (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    action TEXT NOT NULL,
    params TEXT DEFAULT '{}',
    workbook_id TEXT DEFAULT '',
    sheet_id TEXT DEFAULT '',
    topic_id TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'queued',
    result TEXT,
    error_text TEXT,
    max_calls INTEGER NOT NULL DEFAULT 10,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    idempotency_key TEXT DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_tasks_idempotency
    ON agent_tasks(idempotency_key) WHERE idempotency_key != '';
