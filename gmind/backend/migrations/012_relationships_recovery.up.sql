-- Recovery migration for the 010↔011 renumbering collision.
--
-- FTS was originally shipped as migration 010. It was later renumbered to 011
-- and a new 010_relationships was added. Databases that had already applied the
-- original 010 (fts) have version 10 recorded in schema_migrations, so the new
-- 010_relationships is skipped forever and the `relationships` table is never
-- created (GET /relationships → 500 "no such table: relationships").
--
-- This forward migration re-runs the relationships DDL idempotently. It is a
-- no-op on fresh databases (where 010_relationships already ran) and repairs
-- stale databases. Keep this in sync with 010_relationships.up.sql.
CREATE TABLE IF NOT EXISTS relationships (
    id                TEXT PRIMARY KEY,
    workbook_id       TEXT NOT NULL,
    from_workbook_id  TEXT DEFAULT '',
    from_sheet_id     TEXT DEFAULT '',
    from_topic_id     TEXT NOT NULL,
    to_workbook_id    TEXT DEFAULT '',
    to_sheet_id       TEXT DEFAULT '',
    to_topic_id       TEXT NOT NULL,
    type              TEXT NOT NULL DEFAULT 'relates_to',
    direction         TEXT NOT NULL DEFAULT 'forward',
    title             TEXT DEFAULT '',
    weight            REAL NOT NULL DEFAULT 1.0,
    notes             TEXT DEFAULT '',
    color             TEXT DEFAULT '',
    style             TEXT NOT NULL DEFAULT 'solid',
    created_by        TEXT NOT NULL DEFAULT 'user',
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    metadata          TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_rels_workbook   ON relationships(workbook_id);
CREATE INDEX IF NOT EXISTS idx_rels_from_topic ON relationships(from_topic_id);
CREATE INDEX IF NOT EXISTS idx_rels_to_topic   ON relationships(to_topic_id);
CREATE INDEX IF NOT EXISTS idx_rels_type       ON relationships(type);
