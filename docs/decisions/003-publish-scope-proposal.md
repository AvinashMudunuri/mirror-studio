# ADR 003: What "publish" means, and the minimal scope for Phase 4

**Status:** Accepted (2026-07-08) — decided and implemented. Originally
posted 2026-07-07 as a proposal; the human decisions below were made the
next day and the resulting scope was built the same session.

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

## Decision

### What "publish" means (confirmed by a human, 2026-07-08)

An episode is **published** when:
1. Its most recent run was reviewed by the **full board** and got
   `finalStatus === 'APPROVED'` — a dev-mode run (`SKIP_REVIEWERS`) never
   qualifies even if `APPROVED`, since it skips exactly the reviewers most
   likely to catch real issues (`docs/OPEN-QUESTIONS.md` item 4). This
   refinement over the original proposal came from implementation: the
   manifest already records `skippedReviewers`, so enforcing "full board
   only" cost nothing extra.
2. A human explicitly confirms it, via a button — not automatic on
   `APPROVED`. Confirmed: reviewer verdict variance means `APPROVED`
   should be necessary but not sufficient.
3. ~~Its content is projected into a stable, player-facing shape~~ —
   **descoped for this iteration.** The full authoring `content` shape is
   snapshotted as-is into `published_content`; trimming it to a true
   player-facing projection is deferred until a real frontend exists to
   define what it actually needs (see "What we deliberately did NOT
   build," below). The durable-snapshot property (item 2 below) is what
   mattered architecturally; shape-trimming is a separable, easy-to-add-
   later concern.

### Scope built

1. **A `publish` action inside `apps/admin`, not a standalone script or
   an agent** (confirmed: "In the admin portal we complete"). Publishing
   is deterministic (validate + snapshot + flip a status) — same
   philosophy as `compile-screenplay.js`. `apps/admin/src/lib/publish.ts`:
   `reasonNotPublishable()`/`isPublishable()` (pure, unit-tested),
   `findEpisodeRow()`, `publishEpisode()`. Wired to a "Publish" button
   (`publish-button.tsx`, a `'use server'` action in `actions.ts`) on the
   run-detail page. This is the ONLY code path that ever sets
   `status = 'PUBLISHED'` or writes the `published_*` columns.
2. **A durable snapshot, not a live pointer.** `content`/`metadata` are
   mutated by every pipeline run (`persist-episode.js`) — publishing
   copies them into separate `published_content`/`published_metadata`/
   `published_run_folder`/`published_at` columns
   (`infrastructure/db/migrations/2026-07-08-add-published-columns.sql`).
   `persist-episode.js`'s UPSERT never lists these columns, so an
   ordinary re-run (routine in this repo's workflow — this session alone
   re-ran the pipeline a dozen times while testing continuity features)
   can never silently change what's already published. Re-publishing an
   unchanged episode is idempotent (`status: 'PUBLISHED'` counts as
   "was approved" on re-check).
3. **The simplest possible read path**, inside `apps/admin` (confirmed
   open question 2, option (a)): `GET /api/published/[world]/[episodeNumber]`
   reads ONLY the `published_*` columns — never `content` — 404s until a
   human has published at least once. This is the actual contract a
   future frontend would consume.
4. **A minimal preview page** (`/published/[world]/[episodeNumber]`),
   beyond original scope but cheap and valuable: renders the published
   snapshot's title/synopsis/cast/scenes/dialogue directly in the admin
   app, so a human can SEE that publishing produced something real
   without waiting for a player app to exist.
5. **Deferred, as originally proposed:**
   - **Analytics Agent** — no players exist yet.
   - **Publisher Agent / JSON Export Agent as LLM agents** — publishing
     stayed code, never became an agent.
   - **A production database schema separate from what exists** — three
     new columns on `episodes`, no new tables.

## Open questions — resolved

1. **Manual publish button, or automatic on `APPROVED`?** → Manual.
   Confirmed by a human ("approved by our agents and one final approval
   by human").
2. **Where does the read path live?** → Inside `apps/admin` (confirmed:
   "In the admin portal we complete"), not a new `apps/player`. The
   preview page item 4 above is the concrete result.
3. **Versioning.** → Resolved by the durable-snapshot design (item 2
   above): `published_content`/`published_at` are frozen at publish time,
   decoupled from `content`, which keeps mutating with every pipeline run.

## What we deliberately did NOT build

- A trimmed player-facing content projection (see "descoped" note above)
  — the read path returns the full authoring shape; a real frontend will
  define what to strip once one exists.
- Illustration, voice narration, or any other Phase 7 feature.
- A full player-facing frontend (Phase 5 itself, the interactive
  scenes-with-choices experience) — the preview page renders dialogue
  linearly, with no choice interaction; that's genuinely Phase 5.
- Changing how episodes are AUTHORED (the pipeline in
  `scripts/create-real-episode.js`) — this was purely about what happens
  to an episode after `finalStatus: APPROVED`.
- Any auth/role gate on who can click "Publish" — `apps/admin` has none
  today; out of scope for this decision.
- Un-publishing. Only forward publish/re-publish exists.

Live-verified end-to-end via the admin UI: published episode 1 ("First
Bell," a full-board `APPROVED` run), confirmed the success message and
the "Re-publish (no changes)" state on re-check, confirmed
`GET /api/published/NEW_SCHOOL/1` returns the full content (19 scenes)
while `GET /api/published/NEW_SCHOOL/2` (never published) 404s, and
confirmed the preview page renders real scene/dialogue content. Also
confirmed the rejection path renders correctly for a non-`APPROVED` run
("Not publishable: Latest run's status is IN_REVIEW, not APPROVED.").

## Revisit

If real players/testers become available, revisit the Analytics
deferral and the player-content-projection descope specifically — both
are better designed against real usage than guessed at in advance.
