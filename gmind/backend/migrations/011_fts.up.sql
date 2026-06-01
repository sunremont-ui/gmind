-- GI-7: Full-text search over mindmap topics (SQLite FTS5).
-- Topics live inside the workbook JSON blob, so there is no base table to
-- attach triggers to. The index is kept in sync from workbook CRUD in the
-- store layer (Create/Update/Delete + a startup backfill).
CREATE VIRTUAL TABLE IF NOT EXISTS topics_fts USING fts5(
    title,                  -- 0: topic title (indexed)
    notes,                  -- 1: topic notes (indexed)
    workbook_title,         -- 2: parent workbook title (indexed)
    topic_id UNINDEXED,     -- 3
    workbook_id UNINDEXED,  -- 4
    sheet_id UNINDEXED,     -- 5
    tokenize = 'unicode61'
);
