ALTER TABLE agent_tasks ADD COLUMN chain_to_agent_id TEXT DEFAULT '';
ALTER TABLE agent_tasks ADD COLUMN chain_from_task_id TEXT DEFAULT '';
