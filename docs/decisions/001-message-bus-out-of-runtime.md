# ADR 001: Message bus stays out of the runtime path

**Status:** Accepted (2026-07-06)

## Context

The repo has a working Redis Streams message bus (`@mirror/message-bus`) and
a full agent messaging API (`sendMessage`, `request`/`respond`, `challenge`,
`approve`, `reject` in `base-agent-v2.ts`). But no agent-to-agent
communication has ever happened in production: the episode pipeline
(`scripts/create-real-episode.js`) orchestrates the 8 agents by direct
`process()` calls and passed a **mock** bus whose `publish`/`subscribe` were
no-ops. Reviewer feedback is routed to creators by the orchestrator (the
revision loop), not by messages. The CEO agent's `sendMessage('PUBLISHER',…)`
published into the mock void.

That ambiguity — bus wired everywhere, used nowhere — was itself a cost:
every caller had to construct mock-bus boilerplate, and it was unclear
whether new features should be built on messages or on orchestration.

## Decision

1. **Sequential script orchestration is the runtime model.** It produced the
   first APPROVED episodes, is debuggable (every hop is a stack frame and a
   saved artifact), and has no delivery/ordering failure modes.
2. **`messageBus` is optional in `AgentContext`.** Agents initialize and run
   without one; `sendMessage` without a bus constructs and returns the
   message but logs that it was not routed. No more mock-bus boilerplate.
3. **The `@mirror/message-bus` package is retained but not wired.** It is
   the escape hatch for the revisit criteria below, and Phase-1 tooling
   (`scripts/build-story-architect.ts`) still demonstrates it against real
   Redis.
4. `scripts/create-sample-episode.ts` (broken since the bus/memory config
   APIs changed) and `scripts/create-real-episode-simple.ts` (pre-run-folder
   duplicate, unreferenced) are deleted — both superseded by `real:episode`.

## Revisit when

- Agents need to run in separate processes/machines (horizontal scaling).
- We want emergent behaviors that are genuinely peer-to-peer: agents
  challenging each other's outputs mid-flight, CEO-mediated debates.
- A UI needs live agent-level progress that the orchestrator cannot provide
  (today, streaming the pipeline's stdout is simpler and sufficient).

Until one of those is real, building on the bus adds failure modes
(delivery, ordering, timeouts, lost messages) without buying anything the
orchestrator does not already do.

## What re-enabling requires (the price tag)

Reviewed 2026-07-06 against `packages/message-bus/src/index.ts`. Passing a
bus into `agent.initialize()` is one field, but making the bus the actual
coordination mechanism requires closing these gaps first, roughly in order:

1. **Request/reply correlation (the foundation).** `BaseAgent.request()`
   returns a message *id*, not a way to await the answer. Nothing lets a
   sender block on, time out on, or receive the `RESPONSE` that a recipient
   emits via `respond()`. The pipeline is inherently request/response, so
   without a correlation layer (match `replyTo`, timeouts, error
   propagation) the bus cannot express what the pipeline does. Everything
   else sits on this.
2. **An orchestrator agent.** The revision loop, feedback routing, roster
   management, budget enforcement, and artifact saving live in
   `scripts/create-real-episode.js` as one state machine. Message-driven
   coordination means rebuilding that control flow as an agent that owns
   the state — a pipeline rewrite, not a wiring change.
3. **Bus hardening.** Known defects in the current implementation:
   - Multi-recipient messages break: `publish()` keys the stream off
     `message.to as AgentId`, but `to` may be an `AgentId[]` — the stream
     name becomes the array's string form.
   - No poison-message handling: a handler error never advances
     `lastProcessedId`, so a failing message retries forever; there is no
     dead-letter queue.
   - Polling loop (100 ms) instead of Redis consumer groups
     (`XREADGROUP`). Consequence: the multi-process scenario — the main
     reason to want a bus — is unsafe, because processes would race on the
     shared `mirror:agent:<id>:last_message_id` key.
   - `broadcast()` hardcodes a stale agent roster (`TECH_LEAD`,
     `BACKEND_DEVELOPER` do not exist in the current agent set).
   - `getThread()` is a stub returning `[]`; the "PostgreSQL archive"
     fallback in `getMessage()` is not implemented.
4. **Re-verification.** Every live-debugged failure mode of the current
   pipeline (response envelopes, SDK timeouts, token budgets, revision
   bounds) must be re-proven in an async context, where a lost or
   re-delivered message replaces a stack trace.

The current payoff for that work is zero while all agents share one
process; the orchestrator already provides everything the bus would.
