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
| 4. Production Agents | ❌ Not started | No Publisher/Analytics/JSON Export agents, no API |
| 5. Frontend Experience | ❌ Not started | `apps/admin` is an internal dashboard, not a player-facing app |
| 6. Polish & Launch | ❌ Not started | No monitoring, nothing published; basic CI exists (build + test) |
| 7. Growth & Iteration | ❌ Not started | N/A until Phase 4-6 exist |

Episode output so far: 2 episode concepts in 1 world (`NEW_SCHOOL`) across ~10 live runs. Roughly half of full-board runs land `NEEDS_HUMAN_REVIEW` rather than a clean `APPROVED` — reviewer verdict variance is a known, documented quirk (`docs/OPEN-QUESTIONS.md` item 4), not a regression. Nothing has been "published" in the Phase 4 sense — there is no publish step, only a filesystem run folder + a Postgres snapshot of the latest content.

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

### Status: Not started

- **Publisher** — does not exist. There is no concept of "publishing" an episode; `npm run persist:run` upserts the latest run's content into Postgres, which is closer to a cache than a publish step.
- **Analytics Agent** — does not exist. No player interaction data is collected (there are no players yet).
- **JSON Export Agent** — does not exist. No API payload format has been defined.

### What exists instead
- Postgres holds the latest episode content per (season, episode_number) plus agent memory (`docs/OPEN-QUESTIONS.md` item 2) — a real, working piece of infrastructure this phase would build on, just not the phase itself.
- The admin dashboard (`apps/admin`) reads run folders directly from the filesystem, bypassing any API layer.

### Before this phase can start
Needs a decision on what "published" means for a text/choice-driven episode with no player yet — likely blocked on Phase 5 existing first (an API only matters once something consumes it).

---

## Phase 5: Frontend Experience

**Goal**: Build player-facing web application

### Status: Not started

None of the 5 planned components (Episode Player, Character System, Reflection Interface, World Selection, Profile & Progress) exist. `apps/admin` is the only frontend in the repo, and it is explicitly internal/read-only: a Next.js dashboard over `output/episodes/` for run status, verdicts, token cost, revision history, and the rendered bound script. It has no concept of a player, a session, or making a choice.

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
3. **Content Quality**: reviewer verdict variance is real and documented, not fully solved — roughly half of full-board runs still need human review.
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
- **PostgreSQL**: kept, live-verified (agent memory + episode snapshots), schema landmines documented in `docs/decisions/` and the `mirror-postgres` skill.
- **Redis / message bus**: built, explicitly NOT wired into the runtime (ADR 001). This is the single biggest architectural deviation from the original plan.

### New decisions since v1.0
- **Reviewers run on a cheaper model than creators** (`claude-haiku-4-5` vs `claude-sonnet-5`), with prompt caching layered on top for the review board specifically.
- **Fail-loud over fabrication**: reviewers that can't parse a response throw rather than default to a fabricated verdict; the orchestrator escalates that to `UNREADABLE` + `NEEDS_HUMAN_REVIEW` rather than crashing.
- **Cross-run continuity reads from Postgres or the filesystem, whichever is authoritative**: episode N's brief includes real synopses of APPROVED earlier episodes, not a stub.

### Pending decisions (unchanged from v1.0 — still not reached)
- Illustration generation (Midjourney API vs. DALL-E vs. Stable Diffusion)
- Voice narration (ElevenLabs vs. Google Cloud TTS)
- Frontend hosting (Vercel vs. custom deployment)
- Analytics platform (custom vs. Mixpanel/Amplitude)
- **New pending decision**: what "publish" means for this content type, and what the player-facing API/frontend actually needs from Phase 4 before Phase 4 is built.

---

## Next Actions (re-derived from `docs/OPEN-QUESTIONS.md`, not a calendar)

Done since this list was written (2026-07-07):
- ~~Basic CI~~ — `.github/workflows/ci.yml` builds + runs the full test suite (including the Postgres-gated integration suite, via a `pgvector` service container) on every PR and push to `main`.
- ~~Protagonist continuity across episodes~~ — `loadPreviousProtagonist()` carries the protagonist's full profile into episode 2+ and skips Character Designer for it entirely; live-verified the Story Architect using the carried-over name unprompted 44 times in one outline. See `docs/OPEN-QUESTIONS.md` item 2.

Cheap, well-scoped, not yet done:
1. Extend `previousEpisodes` continuity to the remaining 3 reviewers if evidence shows it's worth it.
2. NPC continuity — ids the outline reuses (e.g. "jordan") still get a brand-new Character Designer profile every run rather than reusing the prior episode's version of that id (narrower/lower-value than the protagonist fix above, deliberately not extended yet — see `docs/OPEN-QUESTIONS.md` item 2).

Bigger, would start actual Phase 4/5 work:
3. Decide what "publish" means for one episode with no players yet (Phase 4 blocker).
4. Admin phase 2: generate-from-UI (episode-brief form, SSE streaming) — still internal tooling, not Phase 5, but the natural next step for the admin app.
5. A real Phase 5 kickoff (episode player) is not recommended until Phase 4's data contract exists — building a frontend against a shape that's still `output/episodes/*.json` invites a rewrite.

---

## Long-Term Vision (unchanged)

**Year 1**: Platform with 8 worlds, 40+ episodes, 10,000+ players

**Year 2**: Expanded to multiple languages, partnerships with schools

**Year 3**: Agent framework licensed to other educational content creators

**Year 5**: Project MIRROR Studio becomes the OS for autonomous AI collaboration across industries

These are unchanged from v1.0 and unre-assessed — at 2 episode concepts in 1 world, it's too early to have evidence either way about the Year 1+ vision.

---

**Current Status**: The content-generation backend works and is live-verified against real infrastructure (Claude, Postgres). Everything from "publish" onward — API, frontend, players, monitoring, launch — has not been started.
