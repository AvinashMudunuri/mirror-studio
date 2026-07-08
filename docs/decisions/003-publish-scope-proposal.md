# ADR 003 (proposed): What "publish" means, and the minimal scope for Phase 4

**Status:** Proposed (2026-07-07) — recommendations below, NOT yet
implemented. This is a decision-first task, not a code-first one: the
open questions at the end need a human call before any of this should be
built.

## Context

`docs/ROADMAP.md`'s original Phase 4 ("Production Agents") specified a
Publisher Agent, an Analytics Agent, a JSON Export Agent, a production
database schema, and API endpoints — none of which exist. Phase 5
(the player-facing frontend) is specified as depending on Phase 4's data
contract, and Phase 4 has no reason to exist until something consumes
it — a circular dependency that has left both phases at 0% for the
entire life of this project, while Phases 1-3 (the content-generation
backend) matured well past their original scope.

What DOES exist today, found while writing this proposal:
- The `episodes` table (`infrastructure/db/init/01-schema.sql`) already
  holds the LATEST content per (season, episode_number), automatically
  upserted by `persist-episode.js` whenever a run finishes — this is
  functionally "the current content," just not exposed to anything.
- `episode_status` (the SQL enum) and `EpisodeSchema.metadata.status`
  (the Zod schema in `@mirror/schemas`) BOTH already include a
  `PUBLISHED` value. **Nothing in the codebase ever sets it.**
  `persist-episode.js`'s `STATUS_BY_FINAL` only ever maps a run's
  `finalStatus` to `APPROVED`/`IN_REVIEW`/`DRAFT` — the schema
  anticipated a publish step that was never wired up.
- `compile-screenplay.js` and `persist-episode.js` are the precedent for
  "deterministic, zero-LLM-call, pure-function" pipeline steps — the
  bound script and the Postgres upsert are both assembled from already-
  generated content, not created by an agent call.

## Decision (recommended)

### What "publish" means

An episode is **published** when:
1. Its most recent run's `finalStatus === 'APPROVED'` (already required
   — this is not new).
2. A human explicitly confirms it. Not automatic on `APPROVED` — reviewer
   verdict variance is real and documented (`docs/OPEN-QUESTIONS.md` item
   4; roughly half of full-board runs need human review even when they
   eventually pass), so an `APPROVED` pipeline verdict should be a
   necessary condition for publishing, not a sufficient one.
3. Its content is projected into a stable, **player-facing** shape —
   distinct from the authoring shape currently in `output/episodes/*.json`
   / `episodes.content` — that hides pipeline internals (run folder
   paths, reviewer verdicts, revision history, agent design notes,
   `parseError`/`rawResponse` debug fields) and exposes only what a
   renderer needs: scenes, dialogue, choices, branch outcomes, metadata.

### Recommended minimal Phase 4 scope

1. **A `publish` action, not an agent.** Publishing is deterministic
   (validate + transform + flip a status), not creative — same
   philosophy as `compile-screenplay.js`. Recommend a
   `scripts/publish-episode.js` (zero LLM calls, mirrors
   `persist-run.js`'s shape) callable from the CLI and, once it exists,
   from an admin-dashboard button. It should be the ONLY code path that
   ever sets `status = 'PUBLISHED'`.
2. **A player-content projection function.** A pure transform
   (`episode row → player-facing JSON`) that strips everything a
   renderer doesn't need. This is the actual Phase 4/5 "data contract" —
   defining it is what unblocks Phase 5 without needing the rest of
   Phase 4's original scope.
3. **The simplest possible read path.** A Next.js API route (in
   `apps/admin`, or a new minimal app — see open questions) that reads
   the published projection from Postgres. No separate backend service.
4. **Explicitly deferred, with reasoning:**
   - **Analytics Agent** — no players exist yet, so there is no data to
     analyze. Building this now would mean guessing at an event schema
     with zero real usage to validate it against.
   - **Publisher Agent / JSON Export Agent as LLM agents** — per point 1,
     these should never have been agents; the "agent" framing in the
     original roadmap doesn't fit a deterministic operation.
   - **A production database schema separate from what exists** — the
     `episodes` table already does the job; no evidence yet that it needs
     to change beyond adding the publish action above.

This scope is deliberately much smaller than the original Phase 4 — it
trades "3 production agents + full production infra" for "one
deterministic script + one schema + one read route," sized to what's
actually needed to break the Phase 4/5 circular dependency, not to
build a production system nothing uses yet.

## Open questions (need a human decision before implementation)

1. **Manual publish button, or automatic on `APPROVED`?** Recommend
   manual (see "what publish means" above) — but this is a product
   call, not a technical one.
2. **Where does the read path live?** Options, cheapest first:
   - (a) A "preview as player" route inside `apps/admin` — reuses the
     existing app, cheapest way to validate the player-content schema
     before investing in a real player app. **Recommended first step.**
   - (b) A new minimal `apps/player` app — the eventual real answer, but
     premature before (a) has validated the schema against actual
     rendered content.
3. **Versioning.** Postgres holds only the LATEST content per (season,
   episode_number) today. If a published episode's underlying run gets
   regenerated, does the live/published version silently change, or does
   publishing need to snapshot a durable, versioned copy (e.g. a
   `published_episodes` table, or a `published_at`/`published_content`
   pair on the existing row)? Given there are no real players yet, the
   stakes of overwriting-in-place are low today — but this should be a
   deliberate choice, not a default.

## What we deliberately do NOT propose

- Illustration, voice narration, or any other Phase 7 feature — those
  depend on having a publish step and players first.
- A full player-facing frontend (Phase 5 itself) — this proposal only
  scopes the data contract Phase 5 would consume, per the "before this
  phase can start" note in `docs/ROADMAP.md`'s Phase 5 section.
- Changing how episodes are AUTHORED (the pipeline in
  `scripts/create-real-episode.js`) — this is purely about what happens
  to an episode after `finalStatus: APPROVED`.

## Revisit

If real players/testers become available before this is implemented,
revisit the Analytics deferral specifically — an early, even primitive
event schema informed by real usage beats one guessed at in advance.
