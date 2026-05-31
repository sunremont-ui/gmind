-- V5.0 Graph Relationships: extended schema with type, direction, cross-scope, multi-edge.
CREATE TABLE IF NOT EXISTS relationships (
    id                TEXT PRIMARY KEY,
    workbook_id       TEXT NOT NULL,
    -- Endpoints (nullable enable cross-sheet/workbook references)
    from_workbook_id  TEXT DEFAULT '',
    from_sheet_id     TEXT DEFAULT '',
    from_topic_id     TEXT NOT NULL,
    to_workbook_id    TEXT DEFAULT '',
    to_sheet_id       TEXT DEFAULT '',
    to_topic_id       TEXT NOT NULL,
    -- Semantics
    type              TEXT NOT NULL DEFAULT 'relates_to',
    direction         TEXT NOT NULL DEFAULT 'forward',
    title             TEXT DEFAULT '',
    weight            REAL NOT NULL DEFAULT 1.0,
    notes             TEXT DEFAULT '',
    -- Visual overrides
    color             TEXT DEFAULT '',
    style             TEXT NOT NULL DEFAULT 'solid',
    -- Meta
    created_by        TEXT NOT NULL DEFAULT 'user',
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    metadata          TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_rels_workbook   ON relationships(workbook_id);
CREATE INDEX IF NOT EXISTS idx_rels_from_topic ON relationships(from_topic_id);
CREATE INDEX IF NOT EXISTS idx_rels_to_topic   ON relationships(to_topic_id);
CREATE INDEX IF NOT EXISTS idx_rels_type       ON relationships(type);
