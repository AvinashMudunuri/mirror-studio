# Open Questions & Backlog

Living document: the undecided questions and unstarted work items, with the
evidence behind each. Updated 2026-07-06 (post PRs #13–#16).

For what already WORKS, see the run evidence in `output/episodes/…/manifest.json`
and each run's bound script (`episode-script.md`): the 8-agent pipeline
generates an episode with a full NPC roster, revises against reviewer
feedback (bounded at 2 iterations), and has produced `finalStatus: APPROVED`
runs, all under a hard token budget.

---

## 1. Admin tools for content creation (planned, not started)

`PHASE-2-PLAN.md` Track B specifies a web UI (generator form with per-agent
progress, review dashboard, episode viewer, agent config presets), a rich
content editor, and an analytics dashboard. None of it exists — the
`apps/*` workspace glob matches nothing.

Build order and status:

1. **Read-only dashboard** (`apps/admin`) — DONE 2026-07-06. Next.js app on
   port 3300 reading `output/episodes/`: run list with status/verdict
   badges, token cost and revision count; run detail with roster, revision
   history, rendered bound script; raw artifact viewer. Legacy runs render
   as LEGACY, crashed runs as INCOMPLETE.
2. **Generate from the UI**: episode-brief form spawning the pipeline
   script, console streamed via SSE, budget/reviewer-skip controls.
3. **Editing + review workflow**: rich editors, re-run specific agents,
   versioning — backed by the Postgres layer (item 2 below).

## 2. Postgres persistence — DECIDED & WIRED (2026-07-06)

Model: **the filesystem run folder is the source of truth**; Postgres holds
the *latest* episode content per (season, episode_number) plus agent
memory. When `DATABASE_URL` is set, the pipeline writes agent memory to
Postgres and upserts the finished episode (best effort — a DB failure
never kills a completed run); `npm run persist:run [run-folder]` backfills
any committed run for free.

Fixed on the way in (both verified against a live Postgres 16 + pgvector):
- `agent_memory` upsert crashed without `UNIQUE (agent_id, key)` — added
  to the init schema; existing DBs use
  `infrastructure/db/migrations/2026-07-06-agent-memory-fixes.sql`.
- The 3072-dim ivfflat index aborted schema init (pgvector caps indexes at
  2000 dims) — removed; sequential scan until volumes demand halfvec or
  1536-dim embeddings.

**Cross-run continuity — DONE (2026-07-06).** `scripts/lib/load-previous-episodes.js`
reads the APPROVED episodes preceding a target episode number (Postgres
`episodes` table when `DATABASE_URL` is set, else the newest APPROVED run
folder per episode number) and feeds them into the Story Architect's
`brief.previousEpisodes`. `EPISODE_NUMBER` (env, default 1) selects which
brief `scripts/create-real-episode.js` generates — `EPISODE_NUMBER=2` is
now wired to a real "episode 2" brief. Live-verified twice against episode
1's persisted Postgres row, both times producing
`manifest.run.previousEpisodes: [{id: "ep-1", title: "First Bell"}]` /
`source: postgres`:
- `EPISODE_NUMBER=2 DATABASE_URL=... npm run real:episode:dev` (3
  reviewers skipped) — APPROVED "Group Work" after 2 revision iterations;
  synopsis references the returning "Jordan" character from episode 1.
- `EPISODE_NUMBER=2 DATABASE_URL=... npm run real:episode` (**full
  board, all 5 reviewers**) — APPROVED "Cracks in the Terrarium" on the
  first pass, 0 revisions:
  `{creativeDirector: APPROVED, qaReviewer: PASS, childPsychologist:
  APPROVED, gameDesigner: GOOD, ethicsReviewer: GOOD}`. This is the run
  to treat as prod-ready evidence — `real:episode:dev`'s skipped
  reviewers (Child Psychologist, Ethics Reviewer) are exactly the ones
  most relevant to this episode's "cut corners for the group / honesty"
  premise, so the dev-mode run alone doesn't clear it for production.

Still open:
- **Protagonist continuity.** Each run still calls Character Designer for
  a brand-new protagonist regardless of `previousEpisodes` — episode 2's
  protagonist is a different person (name, look, everything) from episode
  1's, even though the outline treats it as the same ongoing story. Fixing
  this needs the Character Designer (or the orchestrator) to accept an
  existing protagonist profile instead of always generating one; NPC ids
  the outline reuses (e.g. "jordan") already get regenerated per-run
  rather than reusing the prior profile, for the same reason.
- Creative Director's `EpisodeReview.previousEpisodes` (`EpisodeReference[]`)
  and QA Reviewer's `episodeReview.previousEpisodes` are still always
  passed `[]` in `create-real-episode.js` — the loader now produces data
  in the right shape for the Creative Director's continuity/tone checks,
  it just isn't wired to that call site yet.
- Semantic search needs `OPENAI_API_KEY` for embeddings and is untested live.

## 3. Message bus (decided: out of runtime — ADR 001)

Decision and full re-enablement price tag documented in
`docs/decisions/001-message-bus-out-of-runtime.md`, including the four
gaps: no request/reply correlation, no orchestrator agent, bus
implementation defects (multi-recipient, poison messages, no consumer
groups, stale broadcast roster), and re-verification cost. Revisit
criteria are listed there; until one is real, this item is CLOSED.

## 4. Review-model precision (haiku QA is noisy)

Reviewers run on `ANTHROPIC_REVIEW_MODEL` (claude-haiku-4-5) for cost.
Evidence of noise: run `12-59-25` QA passed cleanly; runs `13-32-10` and
two aborted runs mixed genuine findings with convention misreadings
("scene has no choices field", "END is not a valid scene id") despite the
data-model documentation added to the QA prompt and the derived
per-scene `transition` object.

Options, cheapest first:
- Pin QA alone back to the creation model: `QA_REVIEWER_MODEL=claude-sonnet-5`
  (env var, no code change). Other four reviewers stay on haiku.
- Strengthen the data-model examples in the QA prompt (worked partially).
- A deterministic pre-QA structural validator in code (the Story
  Architect's `validateTransitions()` already covers the scene graph;
  extending it to character-presence checks would remove the most
  misread-prone checks from the LLM entirely). Likely the best fix.

## 5. Branch selection at runtime (schema gap, flagged by QA)

Branches now carry `id` + `triggeredBy` (`"choiceId:optionId"` paths) and
endings have per-branch `branchDialogue` variants. What is still undefined:
the precedence rule a renderer applies when a player's choice history
matches multiple branches' `triggeredBy` lists (or none). Needs a decision
when a real player-facing renderer exists; until then QA is instructed the
current keying is the convention.

## 6. Zod output validation (schemas exist, unused)

Agent outputs are validated by ad-hoc checks (`requireEnum`,
`requireScore`, envelope checks) rather than the Zod schemas in
`@mirror/schemas`. Now that parsing is centralized in
`packages/agents/src/json-parsing.ts`, there is exactly one place to hook
schema validation. Open question: strict parse (reject + retry ladder) or
lenient parse with warnings? Reviewer outputs should likely stay
fail-loud; creator outputs may warrant one self-repair attempt (the
`ensurePlayableOutline()` pattern).

## 7. Stale docs (misleading for new sessions)

The LangGraph orchestration references (README tech stack, ROADMAP Week-1
decision log, handbook, `.env.example`) are fixed as of 2026-07-06:
LangGraph was never installed, and ADR 002
(`docs/decisions/002-langgraph-features-adopted-natively.md`) documents
the four capabilities we port natively instead — resume-from-run-folder,
Zod validation at the `json-parsing.ts` hook (item 6), structured
per-step events for the admin UI (item 1), and the bounded
rebuttal/CEO-debate round in the revision loop (relates to item 4).

Still stale: the PHASE-* files and several root-level summaries describe pre-PR-#9
architecture (bus-driven orchestration, 4-agent pipeline, broken sample
scripts as entry points). `INTEGRATION-TESTING-COMPLETE.md`,
`TESTING-SUMMARY.md`, `NEXT-STEPS.md`, and `ANTHROPIC-API-TROUBLESHOOTING.md`
overlap and partially contradict current behavior. Consolidate into
`README.md` + `docs/` and delete the rest (git history preserves them).
`output/real-episode/` is the legacy flat evidence folder, superseded by
`output/episodes/…` — keep or delete deliberately.

## 8. Reviewer parse-failure retry (fail-loud today, by design)

Reviewer parse failures throw `ReviewParseError` and crash the run
(deliberate: a fabricated review is worse than a crash). The revision loop
exists now, but there is still no retry/escalation on a *parse* failure —
one malformed reviewer response late in a run wastes the whole run's
tokens. Options: one re-ask with the parse error quoted; or mark the
reviewer's verdict `UNREADABLE` and continue to `NEEDS_HUMAN_REVIEW` with
the raw response saved. Either preserves fail-loud semantics; the second
is cheaper.
