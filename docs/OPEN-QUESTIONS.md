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

The data layer is now in place for the cheapest first step: per-run folders
with `manifest.json` (verdicts, revision history, token usage, final
status) and `episode-script.md` (the bound script). Sensible build order:

1. **Read-only dashboard** (`apps/admin`): run list with verdict badges and
   token cost, bound-script viewer, manifest drill-down. No DB required.
2. **Generate from the UI**: episode-brief form spawning the pipeline
   script, console streamed via SSE, budget/reviewer-skip controls.
3. **Editing + review workflow**: rich editors, re-run specific agents,
   versioning — depends on Postgres persistence (item 2 below).

Open question: is step 1 worth doing before Postgres persistence, given it
would read the filesystem it already has? (Recommendation: yes — it makes
runs reviewable by humans without reading JSON, today.)

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

Still open: nothing *reads* agent memory across runs yet (previous-episode
context for the Story Architect is the obvious first consumer); semantic
search needs `OPENAI_API_KEY` for embeddings and is untested live.

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

The PHASE-* files and several root-level summaries describe pre-PR-#9
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
