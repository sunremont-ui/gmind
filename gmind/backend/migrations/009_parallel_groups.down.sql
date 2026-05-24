DROP INDEX IF EXISTS idx_agent_tasks_parallel_group;
ALTER TABLE agent_tasks DROP COLUMN parallel_group_id;
