-- Migration for databases initialized before 2026-07-06.
-- (docker-entrypoint init scripts only run on a fresh volume, so existing
-- databases must apply this manually: psql -f <this file>)
--
-- 1. MemorySystem.store() upserts with ON CONFLICT (agent_id, key), but the
--    original schema only had a non-unique index — every store() threw
--    "there is no unique or exclusion constraint matching the ON CONFLICT
--    specification" (verified live).
-- 2. The ivfflat index on embedding vector(3072) exceeds pgvector's
--    2000-dimension index cap, which aborted the original init script at
--    that line (verified live). Drop it if a partial init left one, and do
--    not recreate: sequential scan is fine at current volumes.

BEGIN;

-- De-duplicate any rows that would violate the new constraint
-- (keep the most recently created row per (agent_id, key)).
DELETE FROM agent_memory a
USING agent_memory b
WHERE a.agent_id = b.agent_id
  AND a.key = b.key
  AND a.created_at < b.created_at;

ALTER TABLE agent_memory
  ADD CONSTRAINT agent_memory_agent_id_key_unique UNIQUE (agent_id, key);

-- The old non-unique index is redundant with the constraint's index.
DROP INDEX IF EXISTS idx_memory_key;

DROP INDEX IF EXISTS idx_memory_embedding;

COMMIT;
