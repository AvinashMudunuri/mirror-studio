# ADR 007: Postgres tables — live vs schema-only

**Status:** Accepted (2026-07-19)
**Related:** ADR 003 (publish), ADR 006 (shared cloud Postgres), `.agents/skills/mirror-postgres/SKILL.md`

## Context

`infrastructure/db/init/01-schema.sql` defines **13 public tables**. After Season 1
shipped (5 published episodes + player progress), a live Neon audit showed most
tables empty and unwired. Agents (and humans) kept treating the full schema as
the product surface — which invites building trait UIs, analytics, or message-bus
persistence “because the table exists.”

## Decision

Treat Postgres tables as two tiers:

### Live (application code reads/writes today)

| Table | Role |
|-------|------|
| `worlds` | Seed FK only (`NEW_SCHOOL`, `SPORTS_ACADEMY`, `ANIME_HERO`). No runtime writes. |
| `seasons` | Upserted by `persist-episode.js`; join key for episodes. |
| `episodes` | Pipeline content + durable `published_*` snapshot (admin publish, player read, continuity). |
| `agent_memory` | `@mirror/memory` during pipeline runs (`AGENT_WORKING` scope). |
| `players` | Anonymous cookie identity (`mirror_player_id` → `ensurePlayer`). |
| `player_progress` | Per-player episode resume / completion / outcome JSONB. |

### Schema-only (do not build product features on these yet)

| Table | Why it exists | Why not live |
|-------|---------------|--------------|
| `characters` | PRD character registry | Cast lives in `episodes.content` / `published_content` JSON |
| `player_traits` | Trait engine | Trait leans summarized into `player_progress.choices` JSON only |
| `character_relationships` | Relationship engine | Same — design metadata in outlines, not runtime rows |
| `analytics_events` | Analytics agent / dashboards | Deferred until real player volume (ADR 003 / ROADMAP) |
| `agent_messages` | Message bus | Deliberately out of runtime (ADR 001) |
| `workflows` | Orchestrator state | Orchestration is `create-real-episode.js`, not DB rows |
| `debates` | CEO debate resolution | Unused path; CEO not in pipeline |

**Rule:** Do not wire application writes to schema-only tables without an explicit
product decision + migration plan. Prefer extending `player_progress.choices`
JSONB or `episodes.published_content` until a table earns its keep with queries
that JSON cannot answer.

## Evidence (Neon, 2026-07-19)

Row counts at audit: `episodes` 5 (all published), `seasons` 1, `worlds` 3 (seed),
`agent_memory` 43, `players` 5, `player_progress` 3; all schema-only tables **0**.

## Consequences

- Docs / skills should name the live set first; list schema-only as aspirational.
- Deleting unused tables is **not** required now (cheap to keep; FK graph is fine).
  Revisit deletion if they confuse onboarding more than they help planning.
- Player polish (trait UI, analytics dashboards) must justify a write path before
  assuming these tables are the storage model.
