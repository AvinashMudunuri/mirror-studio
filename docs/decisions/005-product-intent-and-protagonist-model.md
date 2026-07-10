# ADR 005: Product intent and protagonist model (worlds vs serial)

**Status:** Accepted (2026-07-10)

## Context

The repo has shipped two playable NEW_SCHOOL episodes and is drafting a
five-episode season arc (episodes 3–5 briefs in `EPISODE_BRIEFS`). The
PRD lists eight **worlds** (New School, Sports Academy, …) and the
roadmap Year 1 vision mentions 40+ episodes — but there was no explicit
decision on **what the player-facing product optimizes for** or **how
characters carry across worlds**.

Two competing models were on the table:

1. **Anthology** — new protagonist and cast per world; worlds are separate
   practice scenarios.
2. **Saga** — one protagonist travels across worlds; plot continuity is
   the hook into Sports Academy and beyond.

The team also asked whether the product is a **web series / serial** or
something else. That framing risks optimizing for binge plot instead of
the mission in `docs/PRD-V1.md`.

### What the PRD already commits to

Mission (`docs/PRD-V1.md`):

> Help young people **practice life through stories** before life tests
> them in reality.

Core philosophy — the platform **does NOT**: judge, diagnose, label, or
compare users. It **does**: encourage reflection, promote discussion,
create immersive experiences, help users understand themselves, and
**show growth over time**.

Product pillars include **Story First** (never feel like a quiz),
**Growth Over Scores**, **Reflection**, **Replayability**, and
**Conversation** (parents/teens discuss scenarios).

The PRD's "Netflix-style interactive series" language describes the
**felt experience** (immersion), not the business model (one continuous
IP franchise).

### What the codebase already implements

- **Within a world:** serial continuity — `loadPreviousEpisodes()`,
  `loadPreviousCast()`, protagonist + NPC reuse across episode numbers
  (`scripts/lib/load-previous-episodes.js`, `docs/OPEN-QUESTIONS.md`
  item 2). Live-verified for NEW_SCHOOL episodes 1→2.
- **Across worlds:** nothing — each world is an independent content
  namespace (`worldId` on episodes, publish API
  `/api/published/[world]/[episodeNumber]`). No cross-world protagonist,
  trait import, or plot memory exists in the player app yet.
- **Player app (`apps/player`):** interactive playthrough only — no
  profiles, trait UI, reflection prompts, or world selection.

### Naming trap (PRD vs code)

| PRD label | Product meaning |
|-----------|-----------------|
| "Season 1: New School" | **World** `NEW_SCHOOL` |
| "Season 2: Sports Academy" | **World** `SPORTS_ACADEMY` — not semester 2 of the same story |

In code, `season` under a world is a smaller unit (e.g. "Season 1: First
Year" inside NEW_SCHOOL). Cross-world jumps are **world changes**, not
the next `episodeNumber` in the same world.

## Decision

### 1. Primary product intent (confirmed)

The player-facing product is **interactive social-emotional practice**
disguised as fiction — not a plot-driven web series whose main job is
"what happens next."

**One-line alignment:**

> We are not building one web series; we are building a place where teens
> rehearse hard social choices, notice patterns in their own decisions
> over time, and talk about them — **stories are the gym equipment, not
> the business model.**

Success is measured by **practice, reflection, and player-level growth
patterns** — not by cliffhangers or a single canon character franchise.

MIRROR Studio (the agent pipeline) exists to **produce vetted practice
scenarios**; the player app exists to **deliver practice + reflection**.

### 2. Protagonist model (confirmed): hybrid

| Scope | Model | Rationale |
|-------|--------|-----------|
| **Within a world** | **Serial** — same protagonist, recurring NPCs, episode N reads 1…N−1 | Relationship depth makes choices feel costly; matches implemented continuity |
| **Across worlds** | **Anthology** — new protagonist and cast per world | Each world is a fresh scenario for the same underlying skills (belonging, integrity, teamwork, …) without saga logistics |
| **What persists** | **The player profile** (future) — trait patterns, reflection history, unlock state — not one fictional life | Matches PRD "growth over time" on the **human using the app**, not a single character arc spanning unrelated settings |

**Rejected for now:** saga mode (one protagonist canonically moving from
NEW_SCHOOL to SPORTS_ACADEMY as continuous plot). That optimizes for IP
serialization over practice breadth, requires cross-world pipeline +
player memory not built, and makes every new world depend on prior plot
knowledge.

**Rejected:** pure anthology with no player-level persistence — compatible
with short term, but underserves PRD pillars Growth Over Scores and
Reflection once the player app matures.

### 3. World transitions (confirmed)

Moving from NEW_SCHOOL to SPORTS_ACADEMY (or any other world) **does not
require** a story bridge or the same protagonist.

Optional **product-layer** framing is enough:

- Unlock next world after completing a world's season (or episode
  threshold) — product rule, TBD.
- Short copy: "New story, new setting — the patterns you've noticed come
  with you."
- Sports (etc.) episode 1 briefs may **echo themes** (belonging on a
  team) without referencing NEW_SCHOOL plot or character names.

A **narrative hook** in NEW_SCHOOL episode 5 (tryouts, spring team, friend
invites you to rec league) is **optional flavor**, not a requirement for
unlocking Sports Academy.

### 4. Season finales within a world (confirmed)

An within-world finale (e.g. NEW_SCHOOL episode 5 "Last Bell") should:

- **Resolve** that world's semester/year arc emotionally.
- **Not** rely on a cliffhanger into another world as the primary hook.
- May include a **soft forward beat** (unresolved text, spring flyer) if
  it serves reflection — not mandatory for cross-world transition.

Cross-world eager anticipation comes from **"new practice context
unlocked"**, not "to be continued in Sports Academy episode 1."

## Consequences

### Content / pipeline

- Continue **episode-level continuity inside `worldId`** — no change to
  `loadPreviousEpisodes()` scope.
- **Do not** wire cross-world protagonist or plot memory until an explicit
  future ADR revisits saga mode.
- New worlds get their own `EPISODE_BRIEFS` tables (or custom briefs);
  episode 1 of each world is a **pilot**, not a sequel.
- Episode briefs should state **target traits and themes** explicitly;
  plot connections to other worlds are out of scope unless this ADR is
  superseded.

### Player app (Phase 5 — future work)

Build toward:

1. **Player profile** — trait pattern summaries, reflection history
   (PRD Reflection Engine); not character biography.
2. **World selection** — worlds as practice packs; completion/unlock rules
   TBD separately.
3. **Post-episode reflection** — thoughtful observations, not grades
   (Pillar 3).
4. **No user comparison** — patterns are personal (PRD philosophy).

Do **not** prioritize binge/cliffhanger UX over reflection moments.

### NEW_SCHOOL Season 1 (immediate)

- Episodes 1–2 published; briefs 3–5 drafted as **serial within world**.
- Episode 5 closes the school-year arc; revise its brief for optional
  soft forward beat only if it aids reflection — not a Sports cliffhanger
  requirement.

### Sports Academy / other worlds (when started)

- New protagonist; themes mapped to world (e.g. resilience, teamwork,
  leadership).
- No dependency on Wren (or current NEW_SCHOOL cast) in synopsis or
  pipeline continuity inputs.

## What we deliberately did NOT decide

- Exact **unlock rules** (finish ep 5 vs any ep 1 vs parent gate).
- **Trait engine** schema and how much carries across worlds in v1 player.
- Whether episode 5 gets a **specific** tryout/sports teaser line in the
  brief — optional, not required by this ADR.
- Re-assessment of saga mode if product strategy pivots to character IP as
  the primary business.

## Revisit

Reopen this ADR if:

- Player research shows teens only engage with **character attachment**
  across worlds, not theme/trait practice.
- A commercial or partnership deal **requires** one canon protagonist.
- Cross-world pipeline + player memory are implemented and saga mode is
  explicitly proposed as a replacement.

Until then, **serial in world, anthology across worlds, growth on the
player** is the decided model.

## References

- `docs/PRD-V1.md` — mission, philosophy, pillars
- `docs/ROADMAP.md` — Phase 5 player scope; Year 1 vision (8 worlds)
- `docs/OPEN-QUESTIONS.md` item 2 — within-world continuity (done)
- `scripts/create-real-episode.js` — `EPISODE_BRIEFS` (NEW_SCHOOL 1–5)
- `packages/schemas/src/player-projection.ts` — player content contract
