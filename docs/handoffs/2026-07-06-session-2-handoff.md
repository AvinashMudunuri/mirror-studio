# Session Handoff — Project MIRROR Studio (2026-07-06, post-PR #19)

Paste this into a fresh session. Read `.agents/skills/mirror-pipeline/SKILL.md`
and `.agents/skills/mirror-postgres/SKILL.md` before touching anything —
they carry the operational knowledge this handoff only summarizes.

## Context

TypeScript monorepo (npm workspaces + Turbo). An AI studio of agent classes
(`packages/agents`) generates interactive EQ-teaching episodes for teens via
Claude. The pipeline is a sequential orchestrator script —
`scripts/create-real-episode.js` — NOT bus-driven (deliberate: ADR
`docs/decisions/001-message-bus-out-of-runtime.md`). Flow: Story Architect →
Character Designer (protagonist + full NPC roster, ids forced to outline
references) → Dialogue Writer (roster-constrained speakers, branch-aware
ending variants) → 5 reviewers → bounded revision loop (max 2 iterations:
story feedback → Story Architect REVISION_REQUEST + dialogue rewrite;
dialogue feedback → REVISE_DIALOGUE with scene-level merge; only failing
reviewers re-review) → bound script (`episode-script.md`, FINAL — LOCKED
only when APPROVED) → optional Postgres persist.

## State: PRs #13–#19 all merged to main; main is green

- **#13** Live-verified PR #12's scene-transition validation; NPC roster
  generation; revision loop; fixes found live: Story Architect
  REVISION_REQUEST envelope, Anthropic SDK timeout → 30 min, stale-cast
  filtering (`activeRoster`), protagonist/NPC name-collision guard.
- **#14** Reviewer calibration (Creative Director decision rubric; QA
  validates the real data model, not invented fields); branch-aware ending
  dialogue (`branchDialogue` keyed by branch id; branches require
  id + triggeredBy, enforced by validateTransitions self-repair); cost
  controls: creation on `claude-sonnet-5`, reviewers on
  `ANTHROPIC_REVIEW_MODEL` (haiku), xlarge budgets kill wasted truncation
  retries, gateway tracks usage and hard-stops at `MAX_RUN_TOKENS`;
  `npm run real:episode:dev` (skips 3 always-passing reviewers, 400k cap);
  bound-script compiler + `npm run bind:script`. **Evidence: first-ever
  APPROVED runs** — full board (`run-…11-33-54`, 2 revision iterations) and
  dev-mode first-pass (`run-…12-59-25`, 135k tokens, 12 min).
- **#15** JSON parsing dedupe: 8 per-agent parsers → one
  `packages/agents/src/json-parsing.ts` (`parseLlmJson` / `parseReviewJson`,
  envelope + bare-array tolerance); CEO agent migrated off the deleted
  legacy `base-agent.ts` (its callLLM was a throwing stub).
- **#16** ADR 001: message bus out of runtime; `messageBus` optional in
  `AgentContext`; mock-bus boilerplate gone; broken/stale sample scripts
  deleted; re-enablement price tag documented in the ADR (no request/reply
  correlation, needs orchestrator agent, bus defects, re-verification).
- **#17** Postgres persistence: filesystem run folder = source of truth;
  `episodes` table holds latest per (season, episode_number); agent memory
  via `@mirror/memory` behind a resilient guard (DB failure = warning,
  never kills a paid run); `npm run persist:run` backfills any run for
  free. Schema fixes verified live: `UNIQUE (agent_id, key)` on
  agent_memory + removed 3072-dim ivfflat index that aborted init;
  migration in `infrastructure/db/migrations/`.
- **#18** Admin dashboard `apps/admin` (Next.js, port 3300): read-only run
  browser — status/verdict badges, token cost, revision history, rendered
  bound script, artifact viewer. `npm run dev -w @mirror/admin`.
- **#19** Repo agent skills in `.agents/skills/`: community packs
  (`caveman` token compression, `grill-me`+`grilling` plan stress-testing,
  `ponytail` YAGNI) + custom `compound-learning`, `mirror-pipeline`,
  `mirror-postgres`. Cloud Agents auto-discover these from the repo.

Tests: 112 passing + 6 DB-gated (118 with `TEST_DATABASE_URL`). Build clean
from clean clone: `npm install && npm run build && npm test`.

## Environment

- `ANTHROPIC_API_KEY` is in Cloud Agent secrets (injected into new VMs).
- Postgres is NOT preinstalled in cloud VMs — `mirror-postgres` skill has
  the exact apt/setup commands (Postgres 16 + pgvector, user `mirror`,
  DBs `mirror_studio` + `mirror_studio_test`). Consider an env setup agent
  (cursor.com/onboard) to bake this in.
- Cost model per live runs: dev run ~135k tokens (~12 min) when clean;
  full run with 2 revisions 400–600k (~30–50 min). The budget guard stops
  overruns with a BUDGET_EXCEEDED manifest.
- Zero-token wiring smoke: dummy key + tiny budget — see mirror-pipeline
  skill.

## Next work (docs/OPEN-QUESTIONS.md is the authoritative register)

1. **Cross-run memory / episode 2**: nothing reads agent memory across runs
   yet. First consumer: feed episode 1 (from Postgres or the run folder)
   into the Story Architect's `brief.previousEpisodes` and generate
   episode 2. The brief plumbing already exists in `story-architect.ts`.
2. **Deterministic pre-QA validator**: haiku QA is noisy run-to-run (real
   findings mixed with convention misreadings). Extending code-side
   validation (validateTransitions pattern) to character-presence checks
   removes the misread-prone checks from the LLM. Cheap alternative:
   `QA_REVIEWER_MODEL=claude-sonnet-5` env pin.
3. **Reviewer parse-failure handling**: ReviewParseError still kills a run
   late (wasting its tokens). Prefer: mark verdict UNREADABLE, save raw
   response, continue to NEEDS_HUMAN_REVIEW.
4. **Admin phase 2**: generate-from-UI (episode-brief form spawning the
   pipeline, SSE console streaming, budget controls).
5. **Stale docs prune**: root PHASE-*/summary files contradict current
   architecture; consolidate into README + docs/ (compound-learning skill
   forbids recreating them).
6. **Branch selection precedence** for a future renderer (QA flags it,
   non-blocking).

## Known quirks

- Reviewer verdict variance is real: the same pipeline can get CD APPROVED
  first-pass on one run and NEEDS_REVISION on the next. The calibration
  rubric narrowed but did not eliminate it.
- `output/real-episode/` is legacy pre-#11 evidence (flat). New runs:
  `output/episodes/<episode>/run-<timestamp>/`.
- Two committed INCOMPLETE partial run folders exist on purpose (crash
  evidence); the dashboard renders them as INCOMPLETE.
- Zod schemas exist but agent outputs are not schema-validated; the hook
  point is now single (`json-parsing.ts`) if that gets prioritized.
- Never `pkill` — kill runs by PID from the tmux pane.

**First action for a fresh session**: nothing needs verification — main is
green and all handoff-era claims have committed evidence. Pick item 1
(episode 2 via cross-run memory) unless directed otherwise; `/grill-me` the
plan first, and run `real:episode:dev` for any live verification.
