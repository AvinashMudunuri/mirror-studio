# ADR 006: Shared cloud Postgres for publish, player, and cross-environment continuity

**Status:** Accepted (2026-07-10) — runbook at `docs/runbooks/shared-postgres.md`.

## Context

MIRROR Studio uses **two persistence layers** with different jobs:

1. **Filesystem run folders** (`output/episodes/...`) — source of truth for
   pipeline artifacts. Committed to git for approved runs.
2. **Postgres** (`episodes`, `agent_memory`) — optional during generation,
   **required** for publish and the player app. See ADR 003
   (`docs/decisions/003-publish-scope-proposal.md`).

`DATABASE_URL` is opt-in for the pipeline (`persist-episode.js` at end of
run, `npm run persist:run` for backfill). Without it, generation still
works; `loadPreviousEpisodes()` falls back to approved run folders on disk.

**Publish and player do not have a filesystem fallback.** `apps/admin`
(`POST /api/publish`) and `apps/player` (`/play/[world]/[episodeNumber]`)
read `published_content` / `published_at` from Postgres only.

### What went wrong in practice (2026-07-10)

Episode 3 was generated in a **Cursor Cloud Agent** session (Bedrock,
`APPROVED`, artifacts committed in PR #36). That environment had **no
Docker** and no shared `DATABASE_URL` secret. The agent installed an
**ephemeral local Postgres** to persist/publish ep 3 — a database that
does not exist in the user's **Codespaces Docker** instance, where
episodes 1–2 were already published.

Result: three stores with no single answer to "what is live?"

| Store | Ep 1–2 | Ep 3 |
|-------|--------|------|
| Git (approved run folders) | Yes | Yes (after PR #36) |
| Codespaces Docker Postgres | Published | Not until manual `persist:run` + publish |
| Cloud Agent local Postgres | N/A | Published (wrong place) |

The pipeline design is fine; the **deployment model** was wrong for a
workflow that spans Cloud Agent (generate) and Codespaces (play/publish).

## Decision

1. **Operate one shared cloud Postgres** for all environments that need
   publish, player, or cross-run continuity — e.g. Neon, Supabase, or RDS.
   Every environment uses the **same** `DATABASE_URL` connection string.

2. **Cloud Agents: generate and commit; do not provision local Postgres.**
   After merge, run `npm run persist:run` and publish against the shared
   database from Codespaces (or any machine with `DATABASE_URL` set). See
   `docs/runbooks/shared-postgres.md`.

3. **Codespaces: prefer the shared URL over Docker Postgres** for
   admin/player/publish. Docker Compose Postgres remains valid for fully
   offline local dev, but only if it is the *same* database the team
   treats as canonical — not a second silo.

4. **Filesystem + git stay the artifact source of truth.** Cloud Postgres
   holds the latest episode row per `(world, season, episode_number)` and
   durable `published_*` snapshots. It does not replace run folders.

## What we deliberately did NOT build

- **Git-as-player-backend** — publish snapshots are a deliberate product
  boundary (ADR 003); the player reads Postgres, not `output/`.
- **Automatic sync from Cloud Agent to Codespaces Postgres** — one
  `DATABASE_URL` removes the need.
- **Managed Postgres inside this repo** — provider choice (Neon vs
  Supabase vs RDS) is an ops preference; we document wiring, not host it.
- **Requiring Postgres for generation** — pipeline remains filesystem-first.

## Consequences

**Positive**

- Single "what is published?" answer across Cloud Agent, Codespaces, and
  any future hosted admin/player.
- `loadPreviousEpisodes()` uses Postgres when available — faster and
  consistent with publish state.
- Cloud Agent sessions stay stateless for DB: no install-postgres hacks.

**Negative / tradeoffs**

- Small monthly cost and one external dependency (acceptable once player
  and publish are real product paths).
- Schema migrations must be applied to the shared instance explicitly
  (documented in the runbook).
- Secrets hygiene: `DATABASE_URL` contains credentials — Cursor Cloud
  secrets and Codespaces env only, never committed.

## Revisit

- If the team adds a hosted production API that serves published episodes
  without direct Postgres access from Next.js apps, this ADR still holds
  for the canonical store — only the read path changes.
- If CI needs DB-gated integration tests against a disposable DB, use a
  separate `TEST_DATABASE_URL` (see `mirror-postgres` skill); do not point
  tests at the shared production content database.
