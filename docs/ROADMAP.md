# Project MIRROR Studio - Implementation Roadmap

**Version**: 2.0
**Last Updated**: July 7, 2026
**Status**: Content pipeline operational (backend-only); production/frontend phases not started

---

## Overview

This roadmap outlines the implementation strategy for Project MIRROR Studio, breaking down the ambitious vision into concrete, achievable phases.

**Goal**: Build an autonomous AI agent system that creates, reviews, and publishes educational interactive stories for teenagers.

> **v2.0 note**: v1.0 of this document (dated July 3) described a 12-week, week-numbered plan and was last accurate for about half a day. It was superseded almost immediately by ADR 001 (message bus out of the runtime path) and by a burst of real implementation work. This revision reports actual status against the original phase structure instead of a calendar, since "weeks" turned out to be the wrong unit for autonomous-agent work. See `docs/OPEN-QUESTIONS.md` for the live, evidence-backed backlog this roadmap summarizes.

---

## Actual status at a glance

**What exists and works, live-verified against the real Claude API:** an 8-agent pipeline (`scripts/create-real-episode.js`) that takes an episode brief, produces a full outline, protagonist + NPC roster, scene dialogue, runs a 5-agent review board, revises against feedback (bounded loop), and binds a final screenplay — with Postgres persistence, cross-run continuity (episode 2 reads episode 1), prompt-cost optimization, and a read-only admin dashboard over the results.

**What doesn't exist yet:** anything past "generate and internally review an episode." No production/publish agents, no API, no player-facing app, no monitoring. This is a content-generation backend, not yet a product.

| Phase (original) | Status | Notes |
|---|---|---|
| 1. Foundation | ✅ Done — differently than planned | Message bus built but deliberately unused (ADR 001); orchestration is a sequential script, not LangGraph |
| 2. Core Agents | ✅ Done, exceeded milestone | Real episodes generated end-to-end, not just outlines |
| 3. Review Agents | ⚠️ Mostly done | 4 of 5 reviewers built (no Teen Reviewer); debate system never built (feedback routing instead) |
| 4. Production Agents | ✅ Minimal scope done, differently than planned | Publish is a human action in `apps/admin`, not an agent (ADR 003); Analytics still deferred (no players yet) |
| 5. Frontend Experience | ⚠️ Started (minimal) | `apps/player` on port 3400: interactive playthrough of published episodes via the player content projection; not yet profiles, reflection UI, or world selection |
| 6. Polish & Launch | ❌ Not started | No monitoring, nothing published; basic CI exists (build + test) |
| 7. Growth & Iteration | ❌ Not started | N/A until Phase 4-6 exist |

Episode output so far: 2 episode concepts in 1 world (`NEW_SCHOOL`) across ~10 live runs. Roughly half of full-board runs land `NEEDS_HUMAN_REVIEW` rather than a clean `APPROVED` — reviewer verdict variance is a known, documented quirk (`docs/OPEN-QUESTIONS.md` item 4), not a regression. A publish mechanism now exists (item 1b/ADR 003) — a human can click "Publish" in `apps/admin` on a full-board `APPROVED` run — but no database ships with the repo, so a fresh environment starts with nothing published until someone actually clicks it.

---

## Phase 1: Foundation

**Goal**: Establish core infrastructure and type systems

### Status: Done, on a different architecture than planned

- [x] Monorepo structure with Turbo
- [x] Core TypeScript schemas with Zod validation (`@mirror/schemas`)
- [x] Agent type definitions and specifications
- [x] Documentation (PRD, Handbook, Roadmap, ADRs, `OPEN-QUESTIONS.md`)
- [x] Git repository and branch strategy
- [x] Base agent framework (`packages/agents/src/base-agent-v2.ts`)
- [x] LLM integration — Claude (Anthropic), live-verified against the real API; GPT path exists in `llm-gateway.ts` but unused by the pipeline
- [x] Memory architecture — PostgreSQL + pgvector (`@mirror/memory`), live-verified against a real Postgres 16 instance, schema fixes documented in `docs/decisions/`
- [~] Message bus (Redis Streams) — **built, deliberately not wired into the runtime.** ADR 001 (`docs/decisions/001-message-bus-out-of-runtime.md`) decided the sequential orchestrator script is the coordination model; the bus package (`@mirror/message-bus`) is kept as an escape hatch with a documented re-enablement cost, not as in-progress work.

### What actually shipped instead of "Base agent can send/receive messages"
A working single-process pipeline where 8 agents are called directly by an orchestrator script, each backed by real Claude calls, real token-usage accounting (including Anthropic prompt-cache accounting), and real Postgres-backed memory. No message passing between agents exists or is planned near-term.

---

## Phase 2: Core Agents

**Goal**: Implement strategic and creative agents

### Status: Done, milestone exceeded

All 5 originally-scoped agents are implemented and running live:

1. **CEO Agent** (`ceo-agent.ts`) — implemented; episode approval/debate-resolution/sprint-planning scope from the original plan was never exercised in practice, since the CEO isn't in the actual episode pipeline (`create-real-episode.js` doesn't call it). It exists as a standalone agent with tests, not a step in the real workflow.
2. **Creative Director** (`creative-director.ts`, Aria) — in the pipeline, reviews every episode, now receives cross-episode continuity data (`previousEpisodes`).
3. **Story Architect** (`story-architect.ts`, River) — in the pipeline, generates full outlines with a validated, self-repairing scene graph.
4. **Character Designer** (`character-designer.ts`, Kai) — in the pipeline, generates the protagonist and a full NPC roster per episode (not just one profile).
5. **Dialogue Writer** (`dialogue-writer.ts`, Echo) — in the pipeline, generates full-episode dialogue including branch-aware endings, with deterministic post-processing (strips model artifacts, self-repairs incomplete choice-response coverage).

### Milestone re-assessed: exceeded "First Episode Outline"
The pipeline doesn't stop at an outline — it produces a complete, playable episode (scenes, choices, branches, full dialogue) and has produced multiple `finalStatus: APPROVED` runs verified against the real Claude API (see `output/episodes/`).

### Gap vs. the original plan
- No agent orchestration engine or message threading was built — replaced by the sequential script (ADR 001).
- No reusable "prompt template system" as a distinct subsystem — prompts are built inline per agent.

---

## Phase 3: Review Agents

**Goal**: Implement validation and quality agents

### Status: Mostly done — one agent and one subsystem missing

Implemented and running live in the review board:

1. **Child Psychologist** (`child-psychologist.ts`, Dr. Sam) — age-appropriateness, emotional safety.
2. **Game Designer** (`game-designer.ts`) — engagement, pacing, replayability.
3. **Ethics Reviewer** (`ethics-reviewer.ts`) — bias/representation checks.
4. **QA Reviewer** (`qa-reviewer.ts`, Alex) — continuity/technical validation; the noisiest reviewer in practice (haiku model, real convention-misreading false positives — see `docs/OPEN-QUESTIONS.md` item 4).

**Not built: Teen Reviewer.** The 5th review agent from the original plan ("authenticity check", "would I play this?") was never implemented. The current review board substitutes Creative Director for tone/quality judgment, but nothing specifically evaluates from a teen-authenticity angle.

**Not built: debate system.** "Agents challenge each other" never happened — deliberately (ADR 001). What exists instead: the orchestrator collects reviewer feedback and routes it to the Story Architect (story-level) or Dialogue Writer (dialogue-level) for a bounded, 2-iteration revision loop. This achieves the "revision workflow" deliverable without agent-to-agent debate.

### What's more mature than planned
- A bounded revision loop with feedback routing by category, re-reviewing only the reviewers that failed.
- Reviewer parse-failure escalation: a malformed reviewer response now degrades to an `UNREADABLE` verdict instead of crashing the whole run.
- Three specific, live-evidenced QA false-positive classes fixed deterministically in code rather than left to prompt engineering (`docs/OPEN-QUESTIONS.md` item 4).
- Prompt caching across the review board, live-verified to produce real `cache_creation`/`cache_read` tokens against the Anthropic API (`docs/OPEN-QUESTIONS.md` item 9).

### Success criteria re-assessed
"Agents debate and reach consensus" — not applicable, by design. Everything else (episode rejected for valid issues, each reviewer catching its category of problem) is demonstrated in committed run evidence under `output/episodes/`.

---

## Phase 4: Production Agents

**Goal**: Implement production deployment and data systems

### Status: Minimal scope done (2026-07-08), original scope deliberately not built

- **Publisher** — NOT an agent, by design (`docs/decisions/003-publish-scope-proposal.md`, Accepted). Publishing is a human clicking "Publish" in `apps/admin` on a full-board `APPROVED` run, which snapshots content into durable `published_*` columns.
- **Analytics Agent** — still does not exist, deliberately deferred. No player interaction data is collected (there are no players yet).
- **JSON Export Agent** — not built as a separate agent; `GET /api/published/[world]/[episodeNumber]` (`apps/admin`) is the read path a frontend would consume instead.

### What exists now
- `episodes.published_content`/`published_metadata`/`published_at`/`published_run_folder` (migration `2026-07-08-add-published-columns.sql`) — a durable snapshot decoupled from `content`, which every pipeline run keeps mutating.
- `apps/admin`'s Publish button (`src/lib/publish.ts`, `runs/[episode]/[run]/actions.ts`), gated on full-board `APPROVED` (a dev-mode `SKIP_REVIEWERS` run never qualifies, even if `APPROVED`).
- `GET /api/published/[world]/[episodeNumber]` and a minimal `/published/[world]/[episodeNumber]` preview page rendering the published scenes/dialogue directly in the admin app.
- Live-verified end-to-end via the admin UI: publish → success message → API returns content → preview renders it; unpublished episodes 404; non-`APPROVED` runs show why they can't be published.

### Deliberately NOT built
A trimmed player-facing content projection (the read path returns the full authoring shape as-is — deferred until a real frontend needs something narrower), a separate `apps/player` app, and any auth/role gate on who can publish (`apps/admin` has none today). See "What we deliberately did NOT build" in the ADR for the full list.

---

## Phase 5: Frontend Experience

**Goal**: Build player-facing web application

### Status: Minimal preview started (2026-07-10)

**What exists:** `apps/player` — a player-facing Next.js app (port 3400) that reads published Postgres snapshots, projects them via `projectPlayerEpisode()` (`@mirror/schemas`), and renders an interactive playthrough (scene dialogue, choices, branch-specific ending lines). The admin publish API also exposes the same projection at `GET /api/published/[world]/[episodeNumber]?format=player`.

**What doesn't exist yet:** Episode Player polish (no save/resume, no trait UI), Character System, Reflection Interface, World Selection, Profile & Progress. `apps/admin` remains the internal authoring/review dashboard.

### Before this phase can start
Needs Phase 4 (or at least a stable content format/API) so the frontend has something real to consume beyond raw run-folder JSON.

---

## Phase 6: Polish & Launch

**Goal**: Production-ready system with monitoring

### Status: Not started (basic CI is the one exception)

- **Basic CI — done (2026-07-07)**: `.github/workflows/ci.yml` runs build + the full test suite (including the Postgres-gated integration suite, via a `pgvector` service container) on every PR and push to `main`. No LLM API keys needed — the pipeline's unit/integration tests mock the LLM gateway; only a real Postgres instance is required.
- No OpenTelemetry/Grafana/Sentry integration.
- Content creation: 2 episode concepts in 1 world exist (not "3-5 episodes across 2 worlds"), and roughly half of full-board review runs land `NEEDS_HUMAN_REVIEW` rather than a clean pass (see the run table in "Actual status at a glance").
- Testing: 163 unit/integration tests passing (`npm test`), covering agent logic, parsing, pipeline helpers, and Postgres-gated persistence — no end-to-end or load testing, since there's no end-to-end (player-facing) system yet.

---

## Phase 7: Growth & Iteration

**Goal**: Scale content and improve based on data

### Status: Not applicable yet
Everything in this phase (content expansion, parent/teacher portals, voice/illustration, agent learning from player feedback) depends on having actual players, which depends on Phases 4-6. Not reachable until then.

---

## Technical Debt & Risks (re-assessed)

### Resolved since v1.0
1. ~~**LLM Response Parsing**: regex-based~~ — centralized in `packages/agents/src/json-parsing.ts` (envelope + bare-array tolerance), with structured `ReviewParseError`/`ReviewParseError→UNREADABLE` escalation instead of silent fabrication.
2. ~~**LLM Costs**: high token usage~~ — actively being worked: model selection per role (creation vs. review), prompt caching across the review board (live-verified real savings), and deterministic fixes that avoid tokens spent on preventable revision round-trips.
3. ~~**No CI**~~ — `.github/workflows/ci.yml` now gates every PR and push to `main` on build + the full test suite.

### Still open
1. **Agent State Management**: still simplified — the orchestrator script IS the state machine; no formal state persistence/resume mid-run beyond the run-folder artifacts already on disk.
2. **Memory System**: works, but semantic search (`MemorySystem.search()`) is untested live — needs `OPENAI_API_KEY` for embeddings (`docs/OPEN-QUESTIONS.md` item 2).
3. **Content Quality**: reviewer verdict variance is real and documented, not fully solved — roughly half of full-board runs still need human review. Game Designer/Ethics Reviewer/Child Psychologist's gate was tightened to check severity instead of just status tier (see "New decisions since v1.0" above); this initially made two real episodes fail that previously passed silently, but escalating QA/Game Designer/Ethics Reviewer to `claude-sonnet-5` (their haiku reviews were found to be hallucinating on complex episodes, not just noisy) got both back to genuine first-pass `APPROVED` — so the net effect isn't simply "more human review," it's "haiku alone is no longer sufficient for review at this episode complexity." See `docs/OPEN-QUESTIONS.md` items 4 and 11.
4. **Zod output validation**: schemas exist in `@mirror/schemas` but agent outputs are validated by ad-hoc checks, not the schemas themselves (`docs/OPEN-QUESTIONS.md` item 6).

### Identified risks (re-assessed)
1. **LLM Costs** — partially mitigated (see above); still no batching, no cost dashboard, no per-episode cost ceiling beyond `MAX_RUN_TOKENS`.
2. **Agent Response Time** — unaddressed; the 5-reviewer board still runs sequentially in `runReviewers()` even though the reviewers are independent and could run concurrently. Full-board runs with 2 revision iterations take 25-52 minutes.
3. **Content Quality** — see above; partially mitigated by the revision loop and deterministic fixes, not solved.
4. **Bias in AI** — Ethics Reviewer exists and runs on every episode; no diverse-testing or continuous-monitoring process exists beyond that.
5. **User Engagement** — cannot be assessed; no users exist yet (no Phase 5).

---

## Decision Log

### Foundational decisions (originally "Week 1")
- **Monorepo with Turbo**: kept.
- **TypeScript + Zod**: kept for schemas; agent-output validation against those schemas is still ad-hoc (see Technical Debt item 5).
- **LangGraph**: *SUPERSEDED before Phase 1 finished.* Never installed. The sequential orchestrator (`scripts/create-real-episode.js`) shipped instead and is the decided runtime model (ADR 001). Capabilities LangGraph would have provided that were worth porting natively are documented in ADR 002 (resume-from-run-folder, Zod validation hook point, structured per-step events, bounded revision loop) — all four are now done or explicitly tracked as open items.
- **PostgreSQL**: kept, live-verified (agent memory + episode snapshots), schema landmines documented in `docs/decisions/` and the `mirror-postgres` skill. **Shared cloud Postgres** for publish/player across Cloud Agent + Codespaces: `docs/decisions/006-shared-cloud-postgres.md`, runbook `docs/runbooks/shared-postgres.md`.
- **Redis / message bus**: built, explicitly NOT wired into the runtime (ADR 001). This is the single biggest architectural deviation from the original plan.

### New decisions since v1.0
- **Reviewers run on a cheaper model than creators** (`claude-haiku-4-5` vs `claude-sonnet-5`), with prompt caching layered on top for the review board specifically.
- **Fail-loud over fabrication**: reviewers that can't parse a response throw rather than default to a fabricated verdict; the orchestrator escalates that to `UNREADABLE` + `NEEDS_HUMAN_REVIEW` rather than crashing.
- **Cross-run continuity reads from Postgres or the filesystem, whichever is authoritative**: episode N's brief includes real synopses of APPROVED earlier episodes, not a stub.
- **Claude is callable via AWS Bedrock as well as the direct Anthropic API** (`docs/decisions/004-aws-bedrock-alternative-backend.md`, Accepted): `CLAUDE_BACKEND=bedrock` swaps `LLMGateway`'s client with no other pipeline changes, for teams standardizing on AWS IAM/billing instead of an Anthropic API key.
- **Reviewer approval gate now checks severity, not just status tier**: Game Designer/Ethics Reviewer/Child Psychologist previously passed on a coarse `GOOD`/`APPROVED` status alone; `REVIEWER_PASSES` (`pipeline-helpers.js`) now also requires zero CRITICAL/MAJOR issues and an honest readiness boolean. Verified against real historical run data: this correctly flips every real run where these reviewers ran — including two previously-documented "prod-ready" runs — from passing to failing on findings the old gate silently ignored. See `docs/OPEN-QUESTIONS.md` item 11.
- **QA Reviewer (and to a lesser extent Game Designer) on haiku fabricated findings on one real complex episode**, not just misread conventions — live-verified a 22-error QA review against a 27-scene episode where 20 of the errors named fields that provably did not exist in the data QA received. Escalating QA/Game Designer/Ethics Reviewer to `claude-sonnet-5` (env override, not yet a permanent default) let both episode 1 and episode 2 reach genuine `APPROVED` on their first pass, using far fewer tokens than the haiku attempts that chased fabricated findings. **Open question, not yet a settled conclusion**: whether this generalizes below 27 scenes, and whether to promote the escalation to a permanent default — see `docs/OPEN-QUESTIONS.md` item 4's "OPEN" subsection.
- **Product intent and protagonist model** (`docs/decisions/005-product-intent-and-protagonist-model.md`, Accepted 2026-07-10): player product = SEL practice + reflection, not plot franchise; **serial within a world**, **anthology across worlds** (new protagonist per world); **player profile** (future) holds growth, not one canon character saga. Cross-world story bridges optional; Sports Academy does not require NEW_SCHOOL plot continuity.
- **Shared cloud Postgres** (`docs/decisions/006-shared-cloud-postgres.md`, Accepted 2026-07-10): one `DATABASE_URL` for publish/player/continuity across Codespaces and Cloud Agents; pipeline artifacts stay in git. Runbook: `docs/runbooks/shared-postgres.md`.

### Pending decisions (unchanged from v1.0 — still not reached)
- Illustration generation (Midjourney API vs. DALL-E vs. Stable Diffusion)
- Voice narration (ElevenLabs vs. Google Cloud TTS)
- Frontend hosting (Vercel vs. custom deployment)
- Analytics platform (custom vs. Mixpanel/Amplitude)
- ~~What "publish" means for this content type~~ — decided and implemented 2026-07-08 (`docs/decisions/003-publish-scope-proposal.md`, Accepted): manual gate in `apps/admin`, full board required, durable snapshot columns.

---

## Next Actions (re-derived from `docs/OPEN-QUESTIONS.md`, not a calendar)

Done since this list was written (2026-07-07):
- ~~Basic CI~~ — `.github/workflows/ci.yml` builds + runs the full test suite (including the Postgres-gated integration suite, via a `pgvector` service container) on every PR and push to `main`.
- ~~Protagonist continuity across episodes~~ — `loadPreviousProtagonist()` carries the protagonist's full profile into episode 2+ and skips Character Designer for it entirely; live-verified the Story Architect using the carried-over name unprompted 44 times in one outline. See `docs/OPEN-QUESTIONS.md` item 2.
- ~~NPC continuity~~ — generalized to `loadPreviousCast()`; the Story Architect can now optionally bring back any previous episode's supporting character by id. Live-verified: it brought back all 3 of episode 1's NPCs by name in one run, with zero Character Designer calls for any of them, while still correctly generating a genuinely new character introduced mid-revision. See `docs/OPEN-QUESTIONS.md` item 2.
- ~~Decide what "publish" means and scope Phase 4~~ — decided AND implemented 2026-07-08: `docs/decisions/003-publish-scope-proposal.md` (Accepted). Manual publish button in `apps/admin`, full board required, durable `published_*` snapshot columns, a read API + preview page. Live-verified end-to-end.
- ~~AWS Bedrock as an alternative Claude backend~~ — `docs/decisions/004-aws-bedrock-alternative-backend.md` (Accepted, 2026-07-08). `CLAUDE_BACKEND=bedrock` routes Claude calls through `@anthropic-ai/bedrock-sdk` instead of the direct Anthropic API; every other gateway feature (adaptive thinking, prompt caching, retries, usage accounting) is shared unchanged. Live-verified the real network path with dummy AWS credentials (genuine AWS 403, proving the request format is accepted); full verification against a real Bedrock response needs a human to provision AWS credentials with Bedrock access.
- ~~Reviewer calibration: tighten Game Designer/Ethics Reviewer/Child Psychologist~~ — `docs/OPEN-QUESTIONS.md` item 11 (2026-07-08). `REVIEWER_PASSES` now checks issue severity and readiness booleans instead of trusting the coarse status tier alone; prompts gained an explicit calibration rubric mirroring Creative Director's. Verified by replaying all 6 real historical runs where these reviewers ran through the new gate — every one now correctly fails on findings the old gate ignored.
- ~~Get episode 1 and episode 2 back to APPROVED under the tightened gate~~ — done 2026-07-08, live-verified. Along the way: fixed QA's truncating `maxTokens`, raised `MAX_REVISION_ITERATIONS` to 3, fixed a real Story Architect bug (`validateTransitions()` never checked choice-bearing scenes for a stray `defaultNextScene`), and discovered/escalated QA's haiku hallucination problem (see above). Both episodes reached genuine `APPROVED` on the first pass once QA/Game Designer/Ethics Reviewer ran on `claude-sonnet-5`.
- ~~Admin phase 2: generate-from-UI~~ — done 2026-07-08. `/generate`: episode-brief form (not limited to the 2 hardcoded episodes anymore), budget/revision/skip-reviewer controls, console streamed live via SSE from a server-spawned `create-real-episode.js` process. Live-verified end-to-end with a real (token-capped) run. See `docs/OPEN-QUESTIONS.md` item 1.

Cheap, well-scoped, not yet done:
1. Extend `previousEpisodes` continuity to the remaining 3 reviewers if evidence shows it's worth it.

Bigger, would start actual Phase 4/5 work:
2. ~~A trimmed player-facing content projection~~ — done 2026-07-10. `projectPlayerEpisode()` in `@mirror/schemas`; admin API `?format=player`; consumed by `apps/player`.
3. Admin phase 3: rich editors, re-run specific agents, versioning — backed by the Postgres layer.
4. Phase 5 expansion: save/resume, trait tracking UI, reflection prompts, world selection — building on the player projection + `apps/player` skeleton.

---

## Long-Term Vision (unchanged)

**Year 1**: Platform with 8 worlds, 40+ episodes, 10,000+ players

**Year 2**: Expanded to multiple languages, partnerships with schools

**Year 3**: Agent framework licensed to other educational content creators

**Year 5**: Project MIRROR Studio becomes the OS for autonomous AI collaboration across industries

These are unchanged from v1.0 and unre-assessed — at 2 episode concepts in 1 world, it's too early to have evidence either way about the Year 1+ vision.

---

**Current Status**: The content-generation backend works and is live-verified against real infrastructure (Claude, Postgres). Everything from "publish" onward — API, frontend, players, monitoring, launch — has not been started.
