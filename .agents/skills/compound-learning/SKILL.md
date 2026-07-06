---
name: compound-learning
description: >
  Capture a solved problem so the knowledge compounds instead of evaporating
  with the session. Use after fixing a non-obvious bug, finishing a milestone,
  making an architecture decision, or whenever the user says "compound this",
  "document this learning", "capture this", or "write this down for next time".
  Also use proactively at the end of a work session that surfaced anything a
  future session would otherwise have to rediscover.
---

Knowledge in this repo compounds through three registers. Route each learning
to the right one — do not dump everything in one place:

## 1. Solved problems → `docs/solutions/<kebab-case-slug>.md`

For non-obvious bugs and their fixes. Structure:

```markdown
# <One-line problem statement>

**Date:** YYYY-MM-DD | **Evidence:** <run folder / PR / test name>

## Symptom
What was observed (exact error, wrong behavior).

## Root cause
The actual mechanism — not the guess, the verified cause.

## Fix
What changed, where, and why that is the right layer for the fix.

## How to recognize it next time
The tell-tale signature that should trigger memory of this document.
```

Rules:
- One problem per file. If the session solved three things, write three files.
- Cite evidence: the failing run folder, the regression test, the PR number.
- If a regression test exists, name it — the test is the enforcement, the doc
  is the explanation.

## 2. Open questions & decisions → `docs/OPEN-QUESTIONS.md` / `docs/decisions/`

- Undecided questions with their evidence go into `docs/OPEN-QUESTIONS.md`
  (update the existing item if one exists; mark items DECIDED/DONE with a
  date rather than deleting them).
- Deliberate architecture decisions get an ADR in `docs/decisions/`
  (numbered, with Context / Decision / Revisit-when sections, and an honest
  price tag for reversing the decision).

## 3. Session-to-session operational knowledge → repo skills

If the learning changes HOW future sessions should work (a new command, a
cost trap, a testing convention), fold it into the relevant skill under
`.agents/skills/` (e.g. `mirror-pipeline`) instead of writing prose nobody
re-reads. Keep skills short; link to docs for depth.

## Anti-patterns

- Do not create a new top-level `*-SUMMARY.md` or `*-COMPLETE.md` in the repo
  root — that is how the stale PHASE-* doc pile formed.
- Do not restate what git history already says (what changed); capture what
  the diff cannot say (why, and how to recognize the problem again).
- Do not defer: capture learnings in the same session they were earned,
  while the evidence (run folders, logs) is still fresh.
