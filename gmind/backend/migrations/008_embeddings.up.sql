CREATE TABLE IF NOT EXISTS topic_embeddings (
    topic_id    TEXT NOT NULL,
    workbook_id TEXT NOT NULL,
    sheet_id    TEXT NOT NULL DEFAULT '',
    text        TEXT NOT NULL DEFAULT '',
    embedding   TEXT NOT NULL DEFAULT '[]',
    model       TEXT NOT NULL DEFAULT '',
    updated_at  TEXT NOT NULL,
    PRIMARY KEY (topic_id, workbook_id)
);
