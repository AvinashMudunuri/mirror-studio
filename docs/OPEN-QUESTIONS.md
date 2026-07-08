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
4. **Publish / "preview as player"** — DONE 2026-07-08. See item 1b.

## 1b. What "publish" means / Phase 4 scope — DONE (2026-07-08)

`docs/decisions/003-publish-scope-proposal.md` (Accepted): a human is
required to click "Publish" on a run in `apps/admin` — automatic on
`finalStatus: APPROVED` was explicitly rejected, and so is a dev-mode
(`SKIP_REVIEWERS`) run even if `APPROVED` (full board required). The
click snapshots `content`/`metadata` into durable `published_*` columns
(migration `2026-07-08-add-published-columns.sql`) decoupled from later
pipeline re-runs — `persist-episode.js`'s UPSERT never touches them.
`GET /api/published/[world]/[episodeNumber]` (`apps/admin`) is the read
path a frontend would consume, plus a minimal preview page rendering the
published scenes/dialogue directly in the admin app. Publisher/Analytics/
JSON-Export were NOT built as agents (confirmed: publishing is
deterministic code); Analytics stays deferred until real players exist.

Descoped for this iteration: the read path returns the full authoring
content shape as-is, not a trimmed player-facing projection — deferred
until a real frontend exists to define what it actually needs.

Live-verified end-to-end via the admin UI (publish → success message →
`GET /api/published/NEW_SCHOOL/1` returns 19 scenes → preview page
renders them; an unpublished episode 404s; a non-`APPROVED` run shows
"Not publishable: ...").

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

**Creative Director / QA Reviewer previousEpisodes — DONE (2026-07-07).**
Both now receive the real `previousEpisodes` `loadPreviousEpisodes()`
already loads for the Story Architect (`create-real-episode.js` threads
it through `runReviewers()` to `reviewer.run(episode, roster,
previousEpisodes)`). Creative Director's `EpisodeReference[]` shape was
already an exact match; QA's declared `Episode[]` type is looser than
what it actually reads (only `previousEpisodes.length`, for a
continuity-checking blurb), so the lighter reference shape is fine there
too. Live-verified (`run-2026-07-07_01-02-55`): queried both agents'
`last_input` from Postgres `agent_memory` directly and confirmed episode
1's real title/synopsis/themes/episodeNumber are present, not the old
hardcoded `[]`. childPsychologist/gameDesigner/ethicsReviewer don't have
a `previousEpisodes` field in their input types at all — not wired,
lower value since QA/Creative Director are the two that reason about
narrative continuity across episodes.

**Protagonist continuity — DONE (2026-07-07).** `loadPreviousProtagonist()`
(`scripts/lib/load-previous-episodes.js`) fetches the full protagonist
("player") character profile from the single most recent APPROVED
episode before the target one — Postgres `episodes.content->'cast'` when
`DATABASE_URL` is set, else the newest APPROVED run folder's
`02-protagonist.json` (protagonist is never touched by a run's revision
loop, so the base file is always definitive — no revision-awareness
needed, unlike the episode-reference loader). Two effects:
1. `create-real-episode.js` skips Character Designer entirely for the
   protagonist when one carries over (`reusedProtagonistResult()` in
   `pipeline-helpers.js` — zero extra tokens, exact same profile).
2. The carried-over character is also given to the Story Architect's
   `brief.characters` BEFORE the outline is written (previously always
   `[]`), so scene descriptions and the synopsis use the established
   name/pronouns/traits from the start instead of a generic "player"
   placeholder some other step has to reconcile later.

Live-verified (`run-2026-07-07_16-51-12`): log line `👤 Continuity:
protagonist "Wren Castillo" carries over from postgres`, `✅ Protagonist
carried over (0.0s)` (confirming zero Character Designer calls for it),
and — the strongest evidence — the Story Architect's own output used
"Wren" 44 times unprompted throughout the synopsis and scene descriptions,
correctly used her established pronouns, and referenced "since day one"
tying back to episode 1's events. `manifest.run.previousProtagonist:
{name: "Wren Castillo", source: "postgres"}`.

**NPC continuity — DONE (2026-07-07).** Generalized the protagonist
mechanism: `loadPreviousCast()` replaces `loadPreviousProtagonist()`
internally (which now just finds `id === 'player'` in the result) and
returns the FULL cast of the most recent APPROVED episode — protagonist
and every supporting character, including any added mid-run by a
revision (via `resolveFinalArtifacts()`, unlike the protagonist which
never needs revision-awareness). Two effects, mirroring the protagonist:
1. The full previous cast (not just the protagonist) is now given to the
   Story Architect's `brief.characters`. `story-architect.ts`'s
   `buildContext()` shows each character's id and explicitly says
   bringing an NPC back is OPTIONAL (reuse their exact id if you do) —
   unlike the protagonist, which is mandatory every episode.
2. `generateMissingSupportingCharacters()` checks `findReusableCharacter()`
   (`pipeline-helpers.js`) before generating any NPC id the outline
   references; a match skips Character Designer entirely
   (`reusedCharacterResult()`, the same helper the protagonist now also
   uses, generalized to take an explicit id instead of hardcoding "player").

Live-verified (`run-2026-07-07_23-19-42`): the Story Architect brought
back **all 3** of episode 1's supporting characters by id — log lines
`♻️ Continuity: reusing supporting character "mia"/"alex"/"jordan"` (zero
Character Designer calls for any of them), and the outline's own synopsis
named all three with personalities consistent with episode 1 ("magnetic,
controlling Mia Delgado, still-guarded Alex Nakamura, easygoing Jordan
Oduya"). The SAME run also correctly generated a brand-new character
("Priya Patel", id `ms-patel`) introduced by a revision — confirming the
reuse-vs-generate branch works correctly for a mixed cast, not just an
all-reused or all-fresh one. `manifest.run.reusedSupportingCharacters:
[{id: "mia", ...}, {id: "alex", ...}, {id: "jordan", ...}]`.

Still open:
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

**Three specific, recurring false-positive/defect classes fixed
deterministically (2026-07-06), grounded in real QA findings across
episode 1 and episode 2 live runs (not the speculative "character-presence
checks" originally proposed here):**
1. **`[CHOICE POINT: choice-N]` leaking into dialogue as spoken text** —
   recurred 4x in one live QA review, always wrong. `DialogueWriterAgent`
   now strips any line matching that pattern deterministically
   (`sanitizeDialogue`, zero LLM cost) instead of paying for a QA-driven
   revision to remove it.
2. **`choiceDialogue.responseDialogue` missing an entry for one of a
   choice's options** — recurred 2x in one live QA review, always a
   defect. `DialogueWriterAgent.ensureCompleteChoiceDialogue()` detects
   the gap and requests ONE targeted self-repair call (only the missing
   option's dialogue, not a full resend) before the output ever reaches a
   reviewer — mirrors the Story Architect's `ensurePlayableOutline()`
   self-repair pattern.
3. **"`defaultNextScene: null` but also defines transition.type: 'choice'"
   false BLOCKER/CRITICAL** — recurred 6x in a single live QA review
   (episode 1, `run-2026-07-06_13-32-10/revision-1`). Caused by
   `buildEpisodeForReview()` spreading the outline's raw (often `null`)
   `defaultNextScene` onto choice-scenes alongside the derived
   `transition` object; QA misread the mere presence of the field as a
   conflict — `null` there is correct (it means "not applicable, this
   scene uses a choice instead"). Now stripped from the review payload
   for choice-scenes — the reviewer only ever sees the authoritative
   transition mechanism.

Deliberately NOT automated: a choicePoint where every option routes to
the same `nextScene` (flagged as a BLOCKER on one real choice, but as an
intentional "low-stakes calibration choice" on another in the same
episode) — telling a legitimate design pattern apart from a bug needs
narrative judgment a mechanical rule doesn't have; hard-blocking it would
just add a new class of false positive to fix the old one.

Live-verified before/after on episode 2, same brief and continuity input,
for fixes 1 and 2 (fix 3's "before" evidence is from episode 1, above —
episode 2 never happened to hit it): `run-2026-07-06_17-10-26` (before —
its QA reviews are where the choice-marker and missing-responseDialogue
patterns were found: 6 and 11 occurrences respectively) vs.
`run-2026-07-06_23-49-37` (after — none of the three recurred in any of
the runs since; QA's remaining findings were genuinely new/legitimate
each time, e.g. real duplicate scene ids, real missing dialogue on a
newly-introduced choice). Verdict variance is otherwise unchanged — see
Known Quirks in the session handoff.

Remaining options, cheapest first:
- Pin QA alone back to the creation model: `QA_REVIEWER_MODEL=claude-sonnet-5`
  (env var, no code change). Other four reviewers stay on haiku.
- Strengthen the data-model examples in the QA prompt (worked partially).
- Extend the deterministic checks above to character-presence
  (the originally-proposed fix here) if it turns out to be a real
  recurring class — it wasn't among what actually recurred live, so it's
  deprioritized until evidenced.

**Update (2026-07-08), evidenced escalation — haiku hallucinates outright on
larger/more complex episodes, not just misreads conventions:** while
re-running episode 1 to reach APPROVED under the tightened gate (item 11),
QA on haiku reported 22 errors against a 27-scene revision, 20 of them
claiming specific scenes had a stray `defaultNextScene` alongside a choice
— e.g. "Scene scene-4a-popular-table ... also defines a defaultNextScene
(scene-5a-project-assignment)". Directly inspected the exact JSON object
QA received (`buildEpisodeForReview()`'s output, which already strips
`defaultNextScene` from choice-scenes per fix 3 above): **none of the 5
scenes QA named had that field at all** — QA fabricated a claim with a
specific (wrong) value, not just misread an ambiguous field. Re-ran the
identical review payload with `QA_REVIEWER_MODEL=claude-sonnet-5`: error
count dropped from 22 to 1, and that 1 was a genuine, previously-unfound
defect (a character's pronouns used inconsistently between the roster and
one dialogue variant). Cost: 41,677 tokens for one sonnet QA call vs. the
repeated haiku calls that produced only noise.

Also spot-checked Game Designer (haiku had reported 4 MAJOR issues,
blocking under the tightened gate): re-run on `claude-sonnet-5` against
the identical payload returned `GOOD` with the same 4 concerns downgraded
to MINOR — i.e., haiku wasn't fabricating findings out of nothing here,
but was over-severity-rating them past what a stronger model judged
appropriate. Ethics Reviewer, by contrast, returned materially similar
substance on both models (representation concerns about a Korean-coded
character's model-minority-adjacent traits, and a bullying incident no
adult ever addresses) — these read as genuine issues, not hallucination or
miscalibrated severity, and need an actual content revision, not a bigger
model.

Net: haiku's cost savings on QA/Game Designer specifically stop being a
good trade once an episode's scene count/complexity grows past whatever
threshold makes structural review error-prone for a cheap model — this
episode ballooned to 27 scenes over 3 revision rounds (each round adding
sub-branch "aftermath" scenes rather than simplifying), which is well
past `validateOutline`'s own 10-15 minute play-time guideline. Not yet
promoted to a permanent config default (would raise review cost on every
run, including ones that never hit this failure mode) — used as an env
override (`QA_REVIEWER_MODEL`/`GAME_DESIGNER_MODEL=claude-sonnet-5`) for
this specific recovery attempt instead. Worth revisiting as a permanent
policy if this recurs on other episodes, or if a scene-count guardrail on
the Story Architect's revision prompt (discouraging complexity growth
across revisions) turns out to be the more targeted fix.

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

**`docs/ROADMAP.md` rewritten (2026-07-07, v2.0)**: v1.0 described a
12-week, week-numbered plan and was accurate for about half a day before
ADR 001 superseded its core premise (LangGraph + message-bus
orchestration). v2.0 reports actual per-phase status instead of a
calendar: Phases 1-2 done (differently than planned — see ADR 001),
Phase 3 mostly done (no Teen Reviewer, no debate system), Phases 4-7
(publish/API, player frontend, launch, growth) not started at all. Also
surfaces two things v1.0 didn't mention: no CI is configured anywhere in
the repo, and roughly half of full-board episode runs land
`NEEDS_HUMAN_REVIEW` rather than a clean pass (verdict variance, item 4)
— i.e. nothing has actually been "published" in the Phase 4 sense.

Still stale: the PHASE-* files and several root-level summaries describe pre-PR-#9
architecture (bus-driven orchestration, 4-agent pipeline, broken sample
scripts as entry points). `INTEGRATION-TESTING-COMPLETE.md`,
`TESTING-SUMMARY.md`, `NEXT-STEPS.md`, and `ANTHROPIC-API-TROUBLESHOOTING.md`
overlap and partially contradict current behavior. Consolidate into
`README.md` + `docs/` and delete the rest (git history preserves them).
`output/real-episode/` is the legacy flat evidence folder, superseded by
`output/episodes/…` — keep or delete deliberately.

## 8. Reviewer parse-failure retry — DONE (2026-07-07)

Took the cheaper of the two options previously listed here: `runReviewers()`
in `create-real-episode.js` now catches `ReviewParseError` specifically
(`instanceof` check — any other error, network/auth/budget/bug, still
propagates and crashes the run as before) and marks that reviewer's
verdict `UNREADABLE` via `pipeline-helpers.js`'s `unreadableResult()`,
saving the raw unparseable response to the same review file a normal
result would get. `UNREADABLE` never matches a `REVIEWER_PASSES`
predicate, so it flows through the exact same machinery as a genuine
FAIL/NEEDS_REVISION — gates the run to `NEEDS_HUMAN_REVIEW`, gets
re-invoked on the next revision iteration if there's budget left, all for
free (no new special-casing needed downstream).

Fail-loud semantics are preserved: a fabricated review is still never
possible — the synthetic result is unambiguously `UNREADABLE`, not a
made-up verdict, and the raw response is preserved for a human to read.

Tested: `tests/unit/pipeline-helpers.test.ts` (pure `unreadableResult`/
`failingReviewers` behavior) and `tests/unit/review-parse-failure.test.ts`
(a REAL agent + a REAL thrown `ReviewParseError`, caught the exact way
`runReviewers()` does it, verifying both the escalation path and that a
non-parse error still propagates instead of being swallowed). A live
run confirmed the wrapper doesn't change behavior when reviewers parse
normally (no regression to the common path); forcing a genuine parse
failure from the real API isn't practical to reproduce on demand (the
model rarely misbehaves this way), so that specific trigger condition
relies on the unit-level coverage above rather than a live repro.

## 9. Prompt caching across the review board — DONE (2026-07-06)

Token-cost investigation: the 5 reviewers each embedded their own
`JSON.stringify(episode/characters/world, null, 2)` — the same multi-KB
payload paid for in full up to 5 times per run. Naively caching each
agent's own system prompt does NOT work here: Anthropic's cache key is a
byte-exact prefix match over `tools -> system -> messages`, and (a) every
agent's static system prompt (301–1357 tokens measured) is below even
Haiku's 4096-token cache minimum on its own, and (b) reviewers only share
identical episode content on the FIRST review pass — a reviewer
re-invoked after a revision gets different content and can't reuse the
old cache entry regardless.

Fix: `packages/agents/src/review-context.ts` (`buildSharedReviewContext`)
serializes `{world, characters, episode}` once, byte-identically
regardless of which reviewer calls it (unit-tested:
`tests/unit/review-board-caching.test.ts` drives all 5 reviewers through
`.process()` and asserts the block is identical across them). Each
reviewer places it as the FIRST block of a structured `system` array with
`cache: true`, followed by its own persona/instructions (uncached) —
order matters, since `cache_control` caches everything up to and
including the marked block. `LLMGateway` (`llm-gateway.ts`) gained
`LLMSystemBlock`/structured `systemPrompt` support and surfaces
`cache_creation_input_tokens`/`cache_read_input_tokens` in usage stats.
Creative Director's `episodeReview.characters` field was added (it
previously didn't receive the roster at all) so its block matches the
other four byte-for-byte.

Live-verified (`run-2026-07-06_23-49-37`, full board): `67,939 tokens
written, 81,800 tokens read` — reads are billed at ~10% of normal input
price, so this run's haiku reviewer calls paid full price for roughly
11k of the ~161k input tokens they actually processed. Also live-verified
the "shares the cache across a full review round, not just within one
API call" claim specifically: a later reviewer's log line read `Cache: 0
tokens written, 20450 tokens read` — it read a cache entry an EARLIER
reviewer wrote in a prior HTTP call.

**Bug found and fixed via this live verification** (would have shipped
wrong if not tested against the real API): Anthropic's `usage.input_tokens`
excludes `cache_creation_input_tokens`/`cache_read_input_tokens` — they're
accounted separately (`total_input_tokens = cache_read + cache_creation +
input_tokens`). `LLMGateway` was summing only `input_tokens + output_tokens`
into `totalTokens`, silently undercounting real usage (and the
`MAX_RUN_TOKENS` budget check with it) by exactly the cached portion
whenever caching was active. Fixed in both `recordUsage()` (cumulative
gateway stats) and `toClaudeResponse()` (the per-call `LLMResponse.usage`
`BaseAgent` reads for its own token bookkeeping).

Still open:
- Only pays off within an un-revised review round (all N enabled
  reviewers seeing the same first-draft episode) — a revision iteration's
  re-review always starts a fresh, unshared cache entry. Runs that pass
  first-try benefit the most.
- QA Reviewer's `episodeReview.previousEpisodes` and Creative Director's
  are still not wired to real data in `create-real-episode.js` (see item
  2) — feeding them would grow the shared block further, which is exactly
  the kind of content caching is meant to absorb.

## 10. AWS Bedrock as an alternative Claude backend — DONE (2026-07-08)

Ask: "we're using Claude for APIs, can we have an alternative to use AWS
Bedrock as well" — for teams that want AWS-native billing/IAM instead of
an Anthropic API key.

`docs/decisions/004-aws-bedrock-alternative-backend.md` (Accepted):
`LLMGateway` (`llm-gateway.ts`) now takes a `claudeBackend: 'anthropic' |
'bedrock'` config (default `'anthropic'`, override via `CLAUDE_BACKEND`
env var), and constructs an `AnthropicBedrock` client
(`@anthropic-ai/bedrock-sdk`, new dependency) instead of the direct
`Anthropic` client when `'bedrock'` is selected. Every other code path
(adaptive-thinking headroom, retry/truncation, prompt caching, usage
accounting) is unchanged and shared across both backends — confirmed via
research (not assumed) that `AnthropicBedrock.messages.create()` accepts
the identical request/response shape for the non-streaming calls this
gateway makes, including top-level `thinking`/`output_config` and
`cache_control` (a maintainer-confirmed-stale SDK doc comment claims
Bedrock doesn't support prompt caching; it does, via the standard
`.messages.create()` path).

**Requires setting Bedrock-specific model IDs.** Bedrock's model ID
strings differ from the direct API's (e.g. `claude-sonnet-5` vs a Bedrock
ID/inference-profile like `us.anthropic.claude-sonnet-5`, account/region-
specific) — no mapping table was built (would go stale/be wrong per
account), so `ANTHROPIC_MODEL`/`ANTHROPIC_REVIEW_MODEL`/`<AGENT>_MODEL`
must be set to the Bedrock ID when using this backend. Documented in
`.env.example`, `packages/agents/README.md`, and the `mirror-pipeline`
skill.

Verified: 10 new unit tests
(`tests/unit/llm-gateway-bedrock.test.ts`) mock `AnthropicBedrock` and
mirror the existing Anthropic-backend coverage (adaptive thinking,
retries, budget, caching) against the Bedrock path; a build/type-check
pass confirms the real SDK's TypeScript types accept the request shape
sent. Additionally live-verified the real network path with dummy AWS
credentials (`CLAUDE_BACKEND=bedrock AWS_ACCESS_KEY_ID=dummy
AWS_SECRET_ACCESS_KEY=dummy node scripts/create-real-episode.js`): the
request reached AWS's real `bedrock-runtime` endpoint and failed with a
genuine AWS auth error (`403 PermissionDeniedError: The security token
included in the request is invalid`) rather than any client-side/wiring
error — proof the SigV4-signed request format is accepted by AWS, only
the credentials are fake. Full end-to-end verification against a real
Bedrock model response needs a human to provision real AWS credentials
with Bedrock model access (no AWS secrets exist in this environment).

## 11. Reviewer calibration — Game Designer / Ethics Reviewer / Child Psychologist gate tightened — DONE (2026-07-08)

Ask: those three reviewers had passed every live run so far (`SKIP_REVIEWERS`
treats them as the cheap-to-skip trio) — is that because content is
genuinely fine, or because the gate is miscalibrated?

Investigated against real run data before changing anything (not
assumed): the LLMs ARE doing real analysis — Game Designer and Ethics
Reviewer routinely list specific MAJOR-severity issues (e.g. "choices are
cosmetic," "model minority" stereotyping) — but `REVIEWER_PASSES`
(`scripts/lib/pipeline-helpers.js`) only ever checked the coarse status
tier (`GOOD`/`EXCELLENT`), never the severity of the reviewer's own
findings or its own readiness booleans. Both reviewers' prompts map
overall score 6-7 to `GOOD`, which passed unconditionally regardless of
what `issues`/`mustFix`/`readyForPublication` said. Child Psychologist's
prompt explicitly said "not overly cautious" with no counter-pressure
against false negatives.

Fix, three parts:
1. **`REVIEWER_PASSES` now checks severity, not just the status tier.**
   Game Designer: `GOOD` only passes with zero CRITICAL/MAJOR issues and
   an empty `summary.mustFix`; `EXCELLENT` always passes (top tier).
   Ethics Reviewer: same severity rule, plus `readyForPublication` must
   not be explicitly `false` regardless of tier. Child Psychologist:
   `APPROVED` only passes if `summary.readyForAudience` is not explicitly
   `false`. `collectRevisionFeedback` was refactored to call the same
   `REVIEWER_PASSES` predicates instead of re-deriving its own inline
   status check, so a reviewer the gate now treats as failing always gets
   its findings routed into the revision loop too — no divergence between
   "does this block the run" and "does this feed the revision loop."
2. **Prompts gained an explicit calibration rubric** (mirroring Creative
   Director's PR #14 rubric): each reviewer is now told directly that any
   CRITICAL/MAJOR issue (or `mustFix`/`readyForPublication: false`) makes
   `GOOD`/`EXCELLENT` a calibration error, with a "downgrade the status,
   don't downgrade the finding" consistency check. This is best-effort
   (LLM compliance isn't guaranteed) — the code-level gate in item 1 is
   the actual enforcement and doesn't depend on the LLM applying this
   correctly.
3. Child Psychologist's "not overly cautious" framing was rebalanced to
   also warn against under-reporting: "a missed CRITICAL issue reaches
   real teenagers."

**Verified against real historical data, not just synthetic tests**:
replayed all 6 real runs where these reviewers actually ran their real
LLM output through the new `failingReviewers()`. Every single one now
fails Game Designer and/or Ethics Reviewer that the old gate passed
silently — including the two runs previously documented elsewhere in this
file as "prod-ready evidence" (episode 1 "First Bell," episode 2 "Cracks
in the Terrarium," item 2 above). Both had real MAJOR-severity issues
(and one had `readyForPublication: false`) sitting inside a `GOOD`
verdict that the old gate never looked at. This means those specific
historical approvals would NOT re-earn `APPROVED` if re-run today — that
is the intended effect, not a regression; their PUBLISHED snapshots
(ADR 003) are unaffected since publishing is a durable snapshot, not a
live re-check. Also added 15 new unit tests directly covering the new
predicates in `tests/unit/pipeline-helpers.test.ts`.

Not done / deliberately out of scope:
- Did not touch QA Reviewer or Creative Director — both already gate on
  their own findings correctly (binary PASS/FAIL; an explicit calibration
  rubric from PR #14).
- Did not re-run the full pipeline live to observe the new revision loop
  end-to-end (would cost real tokens/time for a purely deterministic code
  change with strong historical-replay evidence already in hand) — if a
  live confirmation run is wanted, `npm run real:episode` (full board)
  is the way to see it.
- Did not change `MAX_REVISION_ITERATIONS` (still 2) — stricter gating
  will plausibly increase how often that bound is hit and a run ends
  `NEEDS_HUMAN_REVIEW` instead of `APPROVED`; revisit if that turns out
  to block real production use.
