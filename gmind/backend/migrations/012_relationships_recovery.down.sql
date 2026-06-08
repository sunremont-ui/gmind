-- No-op: the `relationships` table is owned by migration 010. Rolling back this
-- recovery migration must not drop it. Use `MigrateDown(10)` to drop the table.
SELECT 1;
