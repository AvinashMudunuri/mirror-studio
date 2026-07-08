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
npm run real:episode:dev   # cheap: skips 3 reviewers (childPsychologist/gameDesigner/ethicsReviewer), 400k budget (~12-25 min)
npm run bind:script [run-folder]    # (re)compile episode-script.md — zero tokens
npm run persist:run [run-folder]    # upsert run into Postgres — zero tokens, needs DATABASE_URL
npm run dev -w @mirror/admin        # dashboard over run folders at localhost:3300
```

Env knobs: `EPISODE_NUMBER` (default 1; selects which brief in
`EPISODE_BRIEFS` to generate — `2` generates the season's episode 2),
`MAX_RUN_TOKENS` (0 = unlimited), `SKIP_REVIEWERS`
(comma-separated manifest keys), `ANTHROPIC_MODEL` (creation),
`ANTHROPIC_REVIEW_MODEL` (reviewers, default haiku), `<AGENT>_MODEL` /
`<AGENT>_MAX_TOKENS` per-agent overrides, `DATABASE_URL` (Postgres opt-in),
`CLAUDE_BACKEND` (`anthropic` default, or `bedrock` — see below).

## Claude backend: Anthropic API or AWS Bedrock

`CLAUDE_BACKEND=bedrock` routes all Claude calls through AWS Bedrock
instead of the Anthropic API, authenticated with AWS credentials
(`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_REGION`, or the default
provider chain — `~/.aws/credentials`/IAM role — if those are unset)
instead of `ANTHROPIC_API_KEY`. Full rationale, request-shape details, and
caveats: `docs/decisions/004-aws-bedrock-alternative-backend.md`.

**The one thing that WILL bite you:** Bedrock model IDs are different
strings than the direct API's (e.g. `claude-sonnet-5` vs a Bedrock ID like
`us.anthropic.claude-sonnet-5` — exact IDs are account/region-specific,
look them up in the AWS console). Set `ANTHROPIC_MODEL` /
`ANTHROPIC_REVIEW_MODEL` / `<AGENT>_MODEL` to the Bedrock ID when using
this backend — reusing the direct-API model name will fail with a "model
not found" error from Bedrock.

A zero-token smoke run to confirm wiring (same pattern as the dummy-key
check below, but with dummy AWS creds instead):
`CLAUDE_BACKEND=bedrock AWS_ACCESS_KEY_ID=dummy AWS_SECRET_ACCESS_KEY=dummy AWS_REGION=us-east-1 MAX_RUN_TOKENS=1000 node scripts/create-real-episode.js`
(should reach the first `[LLM] Calling Claude` line, then fail on auth).

## Cross-run continuity (episode 2+)

`scripts/lib/load-previous-episodes.js` exports three loaders, all
Postgres-first (`episodes` table when `DATABASE_URL` is set) with a
filesystem fallback (newest APPROVED run folder per episode number under
`output/episodes/`), degrading gracefully to the fallback on any DB error:
- `loadPreviousEpisodes()` — every APPROVED episode before `EPISODE_NUMBER`,
  feeds `brief.previousEpisodes` (Story Architect, Creative Director, QA
  Reviewer).
- `loadPreviousCast()` — the full cast (protagonist + every supporting
  character, revision-aware) of the single most recent APPROVED episode.
  `create-real-episode.js` hands the whole thing to the Story Architect's
  `brief.characters` before the outline is written: the protagonist is
  ALWAYS referenced as "player" (mandatory continuity — see
  `generateProtagonist()`/`reusedCharacterResult()`, skips Character
  Designer entirely when one carries over), and any supporting character
  MAY be brought back by the outline reusing their exact id (optional —
  `generateMissingSupportingCharacters()` checks `findReusableCharacter()`
  before designing anyone new). Live-verified bringing back all 3 of an
  episode's NPCs in one run, zero Character Designer calls for any of
  them, while still correctly generating a genuinely new character
  introduced mid-revision.
- `loadPreviousProtagonist()` — thin wrapper around `loadPreviousCast()`
  for callers that only want the protagonist.

To generate episode 2 against a real episode 1: `npm run persist:run
<episode-1-run-folder>` (or just have `DATABASE_URL` set during the
episode 1 run), then `EPISODE_NUMBER=2 DATABASE_URL=... npm run
real:episode:dev`. Look for `👤 Continuity: protagonist "..." carries
over` and `✅ Protagonist carried over (0.0s)` in the log to confirm it
worked instead of silently falling through to a fresh generation.

## Cost expectations (from live runs)

- Dev run that passes first try: ~135k tokens, ~12 min.
- Full run with 2 revision iterations: ~400-600k tokens, 27-52 min.
- Dialogue writing is the token hog; reviewers carry the largest inputs.
- The gateway hard-stops at the budget with a BUDGET_EXCEEDED manifest —
  artifacts up to that point are preserved.
- The review board is prompt-cached (`review-context.ts` + `LLMSystemBlock`
  in `llm-gateway.ts`): the episode/character/world payload is identical
  across all 5 reviewers, so only the first to run in an un-revised review
  pass pays full price for it; the rest read it at ~10% cost. Watch for
  `[LLM] Cache: N tokens written/read` in the log, or
  `usage.cacheCreationInputTokens`/`cacheReadInputTokens` in the manifest.
  Only pays off on a pass where multiple reviewers see the same episode
  content — a revision's re-review starts a fresh cache entry. If you add
  a 6th reviewer or touch the review prompts, keep the shared block a
  byte-identical FIRST system block (see `tests/unit/review-board-caching.test.ts`)
  or the cache silently stops matching (no error, just no discount).
- Three previously-recurring QA false-positive/defect classes are now
  fixed deterministically instead of costing a revision round trip: choice-
  point markers leaking into dialogue, incomplete `responseDialogue`
  coverage, and a "redundant transition mechanism" misread — see
  `docs/OPEN-QUESTIONS.md` item 4 for the evidence and what's deliberately
  NOT automated (a choice where every option leads to the same scene can
  be a legitimate design choice, not always a bug).

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
- Reviewer parse failure throws ReviewParseError — `runReviewers()` now
  catches it specifically and marks that reviewer `UNREADABLE` (raw
  response saved) instead of crashing the run; any other error still
  propagates. See docs/OPEN-QUESTIONS.md item 8.
