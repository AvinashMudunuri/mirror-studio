# ADR 002: LangGraph is not adopted; its useful capabilities are ported natively

**Status:** Accepted (2026-07-06) — capabilities documented here, implementation tracked per item

## Context

The Week-1 decision log (`docs/ROADMAP.md`) recorded "LangGraph: Agent
orchestration (chosen over custom solution)", and the README, handbook, and
`.env.example` repeated it. In reality LangGraph was never installed — no
`package.json` depends on it and no code imports it. What shipped is the
custom sequential orchestrator (`scripts/create-real-episode.js`), which
ADR 001 confirmed as the runtime model after it produced the first
APPROVED episodes.

Adopting LangGraph now would mean rewriting a live-debugged state machine
(response envelopes, SDK timeouts, token budgets, revision bounds,
stale-cast filtering were all found and fixed on paid runs) and re-verifying
every one of those failure modes inside a framework abstraction — the same
price tag ADR 001 attaches to the message bus, for the same near-zero
payoff while all agents share one process.

But LangGraph is popular for real reasons. This ADR names the specific
capabilities it would have given us, and defines the native equivalent of
each, so we get the value without the rewrite.

## Decision

LangGraph (and LangChain) stay out of the dependency tree. The four
capabilities below are adopted as **native features of the existing
orchestrator and agent framework**, in the priority order given.

---

### 1. Checkpoint / resume (LangGraph: checkpointers)

**What LangGraph gives:** every graph node's state is checkpointed; a
crashed or interrupted run resumes from the last completed node.

**Why we want it:** this is our most expensive failure mode. A late
`ReviewParseError` kills a run and wastes all tokens spent so far
(`docs/OPEN-QUESTIONS.md` item 8); two committed INCOMPLETE run folders are
crash evidence. A full run costs 400–600k tokens — resume protects paid
work.

**Native equivalent:** the run folder already *is* a checkpoint store —
every step writes a numbered artifact (`01-…` through `08-…`,
`revision-N/…`, `manifest.json`). Add a `--resume-from <run-folder>` flag
to `scripts/create-real-episode.js` that loads existing artifacts, skips
completed steps, and continues from the first missing one (including
mid-revision-loop, using the revision-N folder contents). No new storage,
no framework.

**Priority: 1 (highest).** Directly converts crashed INCOMPLETE runs from
total token loss into recoverable state. Pairs with the OQ-8 fix
(UNREADABLE verdict instead of crash), but is valuable independently —
budget exhaustion and SDK failures also kill runs.

---

### 2. Structured output validation (LangChain: `withStructuredOutput`)

**What LangChain gives:** bind a Zod schema to a model call; the response
is parsed and validated against it, with retry on validation failure.

**Why we want it:** `docs/OPEN-QUESTIONS.md` item 6 — Zod schemas exist in
`@mirror/schemas` but agent outputs are validated only by ad-hoc checks.

**Native equivalent:** parsing is already centralized in
`packages/agents/src/json-parsing.ts` (`parseLlmJson` / `parseReviewJson`)
— exactly one hook point. Wire the existing schemas in there:
- **Reviewer outputs: strict** (fail-loud stays; a fabricated review is
  worse than a crash — and with feature 1, a crash no longer wastes the
  run).
- **Creator outputs: one self-repair attempt** (the
  `ensurePlayableOutline()` pattern), then fail.

**Priority: 2.** Few lines at a single hook; removes a whole class of
silently-malformed outputs before reviewers spend tokens on them.

---

### 3. Per-step event streaming (LangGraph: `streamEvents`)

**What LangGraph gives:** a structured event stream (node started/finished,
tokens, intermediate state) that UIs subscribe to.

**Why we want it:** admin dashboard phase 2 (`docs/OPEN-QUESTIONS.md`
item 1) is "generate from the UI" with a live console over SSE. Today the
orchestrator's only progress interface is human-oriented stdout text.

**Native equivalent:** have the orchestrator emit one structured JSON line
per event (step start/end, agent id, verdict, token usage, revision
iteration) — either interleaved on stdout behind an `EMIT_EVENTS=1` env
var (NDJSON, trivially parsed by the SSE relay) or appended to an
`events.ndjson` file in the run folder (which also improves post-hoc run
forensics). The existing console output stays untouched.

**Priority: 3.** No consumer exists until admin phase 2 starts; build it
as the first task of that track, not before.

---

### 4. Cyclic multi-agent debate (LangGraph: supervisor pattern / conditional edges)

**What LangGraph gives:** graphs with cycles and a supervisor node routing
between agents — the natural shape for "reviewer challenges, creator
rebuts, mediator rules".

**Why we want it:** two reasons. (a) The product vision (ADR 001 revisit
discussion; original roadmap Phase 3 "Debate system") is agents that
communicate, question, and debate each other. (b) A measured quality
problem: reviewer noise (`docs/OPEN-QUESTIONS.md` item 4) — haiku
reviewers mix genuine findings with convention misreadings, and today
every finding is treated as ground truth, so one misreading burns a full
revision iteration.

**Native equivalent:** one more orchestrated step inside the existing
revision loop:
1. Reviewer returns NEEDS_REVISION with findings (unchanged).
2. Orchestrator hands findings to the responsible creator agent with a new
   `CONTEST_FINDINGS` input type; the creator accepts or rebuts each
   finding with reasoning.
3. Contested findings go to the CEO agent (exists, barely used) for a
   ruling — the CEO-mediated debate from the vision.
4. Only upheld findings feed the existing `collectRevisionFeedback()` path.
5. Every round is saved as run-folder artifacts
   (`revision-N/rebuttal.json`, `revision-N/ceo-ruling.json`) — the debate
   is fully inspectable, unlike a bus conversation.

Bounded at **one rebuttal round per revision iteration** (debates cost
tokens under a hard budget). The cheaper OQ-4 mitigations (deterministic
pre-QA validator, `QA_REVIEWER_MODEL` pin) should land first so debates
argue about real findings, not noise a validator could have deleted.

**Priority: 4.** Highest token cost, needs prompt work for rebuttal and
adjudication quality, and its payoff improves after the OQ-4 fixes.

---

## What we deliberately do NOT take

- **The graph abstraction itself.** "Every hop is a stack frame and a
  saved artifact" (ADR 001) is the property that made the pipeline
  debuggable on paid runs; a framework layer trades that away.
- **LangChain's model-client layer.** Our gateway does per-run token
  accounting and hard `MAX_RUN_TOKENS` stops; rewiring that through
  framework callbacks is risk with no gain.
- **A checkpointer database.** The filesystem run folder is the source of
  truth (ADR/decision in OPEN-QUESTIONS item 2); resume reads it directly.

## Revisit

Same criteria as ADR 001: agents in separate processes, or orchestration
state that a script genuinely cannot express. If both ADRs' revisit
criteria fire together, evaluate LangGraph *before* hardening the custom
bus — at multi-process scale a maintained framework likely beats
finishing `@mirror/message-bus` ourselves.
