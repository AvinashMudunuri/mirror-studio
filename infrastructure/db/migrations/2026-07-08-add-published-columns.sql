-- Migration for databases initialized before 2026-07-08.
-- (docker-entrypoint init scripts only run on a fresh volume, so existing
-- databases must apply this manually: psql -f <this file>)
--
-- Publish workflow (docs/decisions/003-publish-scope-proposal.md): the
-- `episodes` table already held `content`/`metadata`/`status`, mutated by
-- every pipeline run (persist-episode.js), plus an unused `published_at`
-- column and a `PUBLISHED` value in the `episode_status` enum that
-- nothing ever set. Publishing needs a DURABLE snapshot decoupled from
-- "whatever the latest run happened to produce" — otherwise re-running
-- the pipeline on an already-published episode (routine in this repo's
-- workflow) would silently change what's live. `persist-episode.js`'s
-- UPSERT never lists these new columns, so ordinary pipeline runs leave
-- them untouched; only the admin publish action ever writes them.

BEGIN;

ALTER TABLE episodes
  ADD COLUMN IF NOT EXISTS published_content JSONB,
  ADD COLUMN IF NOT EXISTS published_metadata JSONB,
  ADD COLUMN IF NOT EXISTS published_run_folder VARCHAR(500);

COMMIT;
