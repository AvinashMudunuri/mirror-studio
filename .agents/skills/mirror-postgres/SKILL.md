---
name: mirror-postgres
description: >
  Postgres persistence for MIRROR Studio: local setup, schema/migrations,
  the persistence model, and how to run the DB-gated integration tests. Use
  when touching @mirror/memory, scripts/lib/persist-episode.js, the SQL in
  infrastructure/db, or when tests mention TEST_DATABASE_URL. Trigger
  phrases: "postgres", "persistence", "agent memory", "DATABASE_URL".
---

## Persistence model (decided 2026-07-06, PR #17)

The filesystem run folder is the SOURCE OF TRUTH. Postgres holds:
- `episodes`: the latest content per (season, episode_number), upserted at
  end of run and via `npm run persist:run [run-folder]` (zero-token backfill)
- `agent_memory`: agents' remember()/recall() writes during runs

Everything is opt-in via `DATABASE_URL`; without it the pipeline is
filesystem-only. Memory calls are wrapped so DB failures degrade to
warnings — never let persistence kill a paid run.

**Publish + player require Postgres** (ADR 003). For one database across
Codespaces and Cursor Cloud Agents, use a shared cloud instance — see
`docs/runbooks/shared-postgres.md` (ADR 006). Cloud Agents should
generate and commit run folders; run `persist:run` + publish from an env
with the shared `DATABASE_URL`, not ephemeral agent-local Postgres.

## Local setup (no Docker needed; Docker compose also works)

```bash
sudo apt-get install -y postgresql-16 postgresql-16-pgvector
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER mirror WITH PASSWORD 'mirror_dev_password' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE mirror_studio OWNER mirror;"
sudo -u postgres psql -c "CREATE DATABASE mirror_studio_test OWNER mirror;"
PGPASSWORD=mirror_dev_password psql -h localhost -U mirror -d mirror_studio -v ON_ERROR_STOP=1 -f infrastructure/db/init/01-schema.sql
PGPASSWORD=mirror_dev_password psql -h localhost -U mirror -d mirror_studio_test -v ON_ERROR_STOP=1 -f infrastructure/db/init/01-schema.sql

export DATABASE_URL=postgres://mirror:mirror_dev_password@localhost:5432/mirror_studio
export TEST_DATABASE_URL=postgres://mirror:mirror_dev_password@localhost:5432/mirror_studio_test
```

Databases initialized before 2026-07-06 must also apply
`infrastructure/db/migrations/2026-07-06-agent-memory-fixes.sql`; those
before 2026-07-08 must also apply
`infrastructure/db/migrations/2026-07-08-add-published-columns.sql`
(publish workflow — `apps/admin`'s Publish button, see
`docs/decisions/003-publish-scope-proposal.md`).

## Tests

```bash
npm test                          # DB tests SKIP cleanly without TEST_DATABASE_URL
TEST_DATABASE_URL=... npm test    # runs the real-database integration suite too
```

The gated suite is `tests/integration/postgres-persistence.test.ts`.

## Schema landmines (both bit us live — do not reintroduce)

1. `agent_memory` MUST keep `UNIQUE (agent_id, key)`: MemorySystem.store()
   upserts with `ON CONFLICT (agent_id, key)` and throws without it.
2. Do NOT add an ivfflat/hnsw index on the `embedding vector(3072)` column:
   pgvector caps vector indexes at 2000 dims and the CREATE INDEX aborts the
   whole init script. Sequential scan until volumes justify halfvec or
   1536-dim embeddings.
3. `agent_id` is a SQL enum — adding a new agent class requires an ALTER
   TYPE migration, or inserts for that agent fail.
4. Semantic search requires `OPENAI_API_KEY` for embeddings (untested live).
