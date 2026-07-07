/**
 * Shared episode/world/character context for the review board.
 *
 * All 5 reviewers (Creative Director, QA, Child Psychologist, Game
 * Designer, Ethics Reviewer) are handed the same episode snapshot on the
 * initial review pass. Each reviewer used to embed its own
 * `JSON.stringify(episode, ...)` inline in its task prompt — meaning the
 * same multi-KB payload was paid for in full 5 times over.
 *
 * `buildSharedReviewContext` produces that payload ONCE, byte-identically
 * regardless of which reviewer calls it, so it can be placed in a cached
 * `system` block (see LLMSystemBlock in llm-gateway.ts) and only paid for
 * in full by whichever reviewer runs first — the rest read it from cache
 * at a steep discount. This only pays off within a run where multiple
 * reviewers see the SAME episode content (the initial pass); a reviewer
 * re-invoked after a revision gets different episode content and pays
 * full price again, same as before.
 *
 * Compact (non-pretty-printed) JSON: whitespace formatting doesn't help
 * the model read the structure and only adds token count paid 5x over.
 */

export interface ReviewContextInput {
  episode: unknown;
  characters?: unknown[];
  world: unknown;
}

export function buildSharedReviewContext({ episode, characters, world }: ReviewContextInput): string {
  return `SHARED EPISODE DATA (identical for every reviewer on this episode; the task-specific instructions follow separately):

WORLD:
${JSON.stringify(world)}

CHARACTERS:
${JSON.stringify(characters || [])}

EPISODE:
${JSON.stringify(episode)}`;
}
