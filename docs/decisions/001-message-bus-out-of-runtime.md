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
