---
name: mirror-pipeline
description: >
  How to run, verify, and pay for the MIRROR Studio episode pipeline. Use
  when generating episodes, live-verifying pipeline changes, investigating a
  failed run, binding scripts, persisting runs, or reasoning about Claude
  token cost. Trigger phrases: "run the pipeline", "generate an episode",
  "real:episode", "live verify", "bound script", "token budget".
---

## The one-line mental model

`scripts/create-real-episode.js` orchestrates 8 agents by direct calls
(Story Architect → Character Designer [protagonist + NPC roster] → Dialogue
Writer → 5 reviewers → bounded revision loop → bound script → optional
Postgres persist). There is no message bus in the runtime path (ADR:
`docs/decisions/001-message-bus-out-of-runtime.md`).

## Commands

```bash
npm run build              # REQUIRED first — the script loads packages/agents/dist
npm run real:episode       # full board, 800k token budget (~15-50 min, real Claude tokens)
npm run real:episode:dev   # cheap: skips 3 always-passing reviewers, 400k budget (~12-25 min)
npm run bind:script [run-folder]    # (re)compile episode-script.md — zero tokens
npm run persist:run [run-folder]    # upsert run into Postgres — zero tokens, needs DATABASE_URL
npm run dev -w @mirror/admin        # dashboard over run folders at localhost:3300
```

Env knobs: `EPISODE_NUMBER` (default 1; selects which brief in
`EPISODE_BRIEFS` to generate — `2` generates the season's episode 2),
`MAX_RUN_TOKENS` (0 = unlimited), `SKIP_REVIEWERS`
(comma-separated manifest keys), `ANTHROPIC_MODEL` (creation),
`ANTHROPIC_REVIEW_MODEL` (reviewers, default haiku), `<AGENT>_MODEL` /
`<AGENT>_MAX_TOKENS` per-agent overrides, `DATABASE_URL` (Postgres opt-in).

## Cross-run continuity (episode 2+)

`scripts/lib/load-previous-episodes.js` loads the APPROVED episodes before
`EPISODE_NUMBER` in the world — from Postgres (`episodes` table) when
`DATABASE_URL` is set, else the newest APPROVED run folder per episode
number under `output/episodes/` — and feeds them into the Story
Architect's `brief.previousEpisodes`. This is the only cross-run memory
consumer today: NPC ids and the protagonist are still regenerated fresh
each run even when the outline references a "returning" character (see
`docs/OPEN-QUESTIONS.md` item 2). To generate episode 2 against a real
episode 1: `npm run persist:run <episode-1-run-folder>` (or just have
`DATABASE_URL` set during the episode 1 run), then
`EPISODE_NUMBER=2 DATABASE_URL=... npm run real:episode:dev`.

## Cost expectations (from live runs)

- Dev run that passes first try: ~135k tokens, ~12 min.
- Full run with 2 revision iterations: ~400-600k tokens, 27-52 min.
- Dialogue writing is the token hog; reviewers carry the largest inputs.
- The gateway hard-stops at the budget with a BUDGET_EXCEEDED manifest —
  artifacts up to that point are preserved.

## Where results land

`output/episodes/<episode>/run-<timestamp>/`: numbered artifacts
(01-story-outline … 08-ethics-review), `revision-N/` per iteration,
`manifest.json` (verdicts, usage, revision history, finalStatus:
APPROVED / NEEDS_HUMAN_REVIEW / BUDGET_EXCEEDED), `episode-script.md`
(the bound script — FINAL — LOCKED only when APPROVED).

## Live-verifying a pipeline change

1. Unit tests first: `npm test` (fast, no tokens). LLM/infra are mocked.
2. A dummy-key smoke run costs zero tokens and proves wiring:
   `ANTHROPIC_API_KEY=sk-ant-dummy MAX_RUN_TOKENS=1000 node scripts/create-real-episode.js`
   (should reach the first `[LLM] Calling Claude` line, then fail on auth).
3. Real verification: run `real:episode:dev` in a tmux session, tee to a log,
   poll the log. Commit run artifacts as evidence with the PR.
4. If a run crashes mid-flight, kill by PID only (never pkill by name),
   check the tee'd log for the last `[LLM]` line, and delete the partial
   run folder unless it documents the failure.

## Known failure modes (all previously hit live)

- Model returns content without the JSON envelope → parsing is centralized
  in `packages/agents/src/json-parsing.ts`; fix tolerance THERE, not in a
  single agent (this bug shipped twice from duplicated parsers).
- Truncation at max_tokens → the gateway retries with doubled budget; if an
  agent always truncates, raise its `maxTokens` in config.ts instead of
  paying for the wasted first attempt.
- Anthropic SDK default timeout is too short for 32k-token generations —
  gateway sets 30 min; don't lower it.
- Reviewer parse failure throws ReviewParseError and kills the run late
  (known open item in docs/OPEN-QUESTIONS.md).
