ALTER TABLE agent_tasks ADD COLUMN parallel_group_id TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_agent_tasks_parallel_group ON agent_tasks(parallel_group_id);
