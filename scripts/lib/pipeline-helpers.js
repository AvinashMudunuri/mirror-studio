/**
 * Pure helpers for the real-episode pipeline (scripts/create-real-episode.js).
 *
 * Kept free of I/O and agent dependencies so they can be unit-tested
 * (tests/unit/pipeline-helpers.test.ts).
 */

'use strict';

/** Speaker ids that never need a character profile. */
const RESERVED_SPEAKER_IDS = new Set(['player', 'narrator', 'internal']);

/**
 * Collect the supporting-character ids referenced by the outline's scene
 * character lists (everything except the protagonist/narrator markers).
 */
function collectSupportingCharacterIds(outline) {
  const ids = [];
  const seen = new Set();
  for (const scene of outline.scenes || []) {
    for (const raw of scene.characters || []) {
      const id = String(raw).trim();
      if (!id || seen.has(id) || RESERVED_SPEAKER_IDS.has(id.toLowerCase())) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Describe where a character appears in the outline, for the
 * Character Designer's requirements.
 */
function describeAppearances(outline, characterId) {
  return (outline.scenes || [])
    .filter(s => (s.characters || []).includes(characterId))
    .map(s => `scene "${s.title}" (${s.location}): ${s.description} [emotional beat: ${s.emotionalBeat}]`);
}

/**
 * True if any issue is CRITICAL or MAJOR severity. MINOR issues never
 * block — this mirrors the threshold collectRevisionFeedback already used
 * (below) for deciding which findings are worth a revision round trip; the
 * gate now applies the SAME threshold instead of ignoring severity entirely.
 */
function hasBlockingIssue(issues) {
  return (issues || []).some(i => i?.severity === 'CRITICAL' || i?.severity === 'MAJOR');
}

/**
 * Positive-verdict predicates per reviewer key (keys match the manifest).
 *
 * Game Designer / Ethics Reviewer / Child Psychologist previously passed
 * on their coarse status tier alone (GOOD/EXCELLENT, or APPROVED) with no
 * regard for the severity of their own findings or their own readiness
 * booleans — live run data showed this let a GOOD verdict through
 * alongside 5 MAJOR issues and a non-empty mustFix list, and a GOOD ethics
 * verdict alongside `readyForPublication: false`. See
 * docs/OPEN-QUESTIONS.md item 11. Now:
 * - Game Designer: GOOD only passes with zero CRITICAL/MAJOR issues AND an
 *   empty `summary.mustFix`; EXCELLENT always passes (it's the top tier).
 * - Ethics Reviewer: same issue-severity rule, PLUS `readyForPublication`
 *   must not be explicitly false, regardless of status tier.
 * - Child Psychologist: APPROVED only passes if `readyForAudience` is not
 *   explicitly false — a status/readiness mismatch is a real
 *   inconsistency to catch, not something to trust past.
 * Missing/absent issues or summary fields (older manifests, or a reviewer
 * that didn't populate them) are treated as "no red flags" rather than
 * failing the run on data the reviewer never provided.
 */
const REVIEWER_PASSES = {
  creativeDirector: r => r?.decision === 'APPROVED',
  qaReviewer: r => r?.status === 'PASS',
  childPsychologist: r => r?.status === 'APPROVED' && r?.summary?.readyForAudience !== false,
  gameDesigner: r =>
    r?.status === 'EXCELLENT' ||
    (r?.status === 'GOOD' && !hasBlockingIssue(r?.issues) && (r?.summary?.mustFix?.length ?? 0) === 0),
  ethicsReviewer: r =>
    r?.summary?.readyForPublication !== false &&
    (r?.status === 'EXCELLENT' || (r?.status === 'GOOD' && !hasBlockingIssue(r?.issues)))
};

/** Reviewer keys whose current result blocks approval. */
function failingReviewers(reviews) {
  return Object.keys(REVIEWER_PASSES).filter(
    key => reviews[key] !== undefined && !REVIEWER_PASSES[key](reviews[key])
  );
}

/**
 * Synthetic verdict for a reviewer whose response couldn't be parsed
 * (ReviewParseError — see packages/agents/src/errors.ts). Left unhandled,
 * that exception crashes the whole run late, wasting every token spent so
 * far. "UNREADABLE" never matches a REVIEWER_PASSES predicate above, so it
 * correctly gates the run to NEEDS_HUMAN_REVIEW exactly like a genuine
 * FAIL/NEEDS_REVISION — the run finishes instead of crashing, and the raw
 * response is preserved for debugging.
 */
function unreadableResult(verdictField, error) {
  return {
    [verdictField]: 'UNREADABLE',
    parseError: error.message,
    rawResponse: error.rawResponse
  };
}

/**
 * Character-Designer-shaped output for a character carried over from a
 * previous episode (loadPreviousProtagonist()/loadPreviousCast()),
 * instead of generating a brand new one. `id` is forced defensively — the
 * loader should already have it, since every persisted character went
 * through this same id assignment on the run that originally created it.
 * Used for both the protagonist (id "player") and reused NPCs (id is
 * whatever the outline calls that character, e.g. "jordan").
 */
function reusedCharacterResult(existingCharacter, id) {
  return {
    character: { ...existingCharacter, id },
    designNotes: 'Continuity: reused an established character from a previous episode rather than designing a new one.',
    uncertainties: []
  };
}

/**
 * The previous-cast entry (if any) an outline's reference to `characterId`
 * should reuse, rather than generating a brand-new character with that
 * id. Never matches "player" here — the protagonist has its own,
 * separate continuity path (loadPreviousProtagonist() + generateProtagonist()),
 * since it's unconditional (every episode has exactly one), whereas NPC
 * reuse is opportunistic (only when the current outline happens to
 * reference an id a previous episode's cast also used).
 */
function findReusableCharacter(characterId, previousCast) {
  if (characterId === 'player') return undefined;
  return (previousCast || []).find(c => c.id === characterId);
}

function isDialogueLocated(text) {
  return /dialogue|line|speech|says|spoken/i.test(text);
}

/** Fields a custom episode brief (e.g. from the admin "generate" form) must provide. */
const REQUIRED_BRIEF_FIELDS = ['world', 'worldId', 'season', 'title', 'themes', 'targetTraits', 'synopsis'];

/**
 * Resolve which episode brief a run uses: a custom one (JSON string, e.g.
 * from `EPISODE_BRIEF_JSON` — the admin "generate" form's episode-brief
 * form) takes priority over the hardcoded `episodeBriefs[episodeNumber]`
 * table, so the UI isn't limited to the two pre-written episodes. Throws
 * (fail loud) rather than silently falling back on malformed/incomplete
 * custom JSON — a partially-wrong brief would waste a real pipeline run.
 */
function resolveEpisodeBrief(episodeBriefs, episodeNumber, briefJsonOverride) {
  if (!briefJsonOverride) return episodeBriefs[episodeNumber];

  let custom;
  try {
    custom = JSON.parse(briefJsonOverride);
  } catch (error) {
    throw new Error(`EPISODE_BRIEF_JSON is not valid JSON: ${error.message}`);
  }

  const missing = REQUIRED_BRIEF_FIELDS.filter(key => {
    const value = custom[key];
    return value === undefined || value === null || value === '';
  });
  if (missing.length > 0) {
    throw new Error(`EPISODE_BRIEF_JSON is missing required field(s): ${missing.join(', ')}`);
  }
  if (!Array.isArray(custom.themes) || custom.themes.length === 0) {
    throw new Error('EPISODE_BRIEF_JSON.themes must be a non-empty array');
  }
  if (!Array.isArray(custom.targetTraits) || custom.targetTraits.length === 0) {
    throw new Error('EPISODE_BRIEF_JSON.targetTraits must be a non-empty array');
  }

  return { ...custom, episodeNumber };
}

/**
 * Turn negative reviews into revision feedback, split by revision target:
 * - story: goes to Story Architect REVISION_REQUEST
 * - dialogue: goes to Dialogue Writer REVISE_DIALOGUE
 *
 * Feedback items use the { from, message, severity } shape both agents accept.
 */
function collectRevisionFeedback(reviews) {
  const story = [];
  const dialogue = [];

  const route = (item, locationHint) =>
    (isDialogueLocated(locationHint || '') ? dialogue : story).push(item);

  const cd = reviews.creativeDirector;
  if (cd && !REVIEWER_PASSES.creativeDirector(cd)) {
    const fb = cd.specificFeedback || {};
    for (const m of fb.story || []) story.push({ from: 'CREATIVE_DIRECTOR', message: m, severity: 'MAJOR' });
    for (const m of fb.character || []) story.push({ from: 'CREATIVE_DIRECTOR', message: m, severity: 'MAJOR' });
    for (const m of fb.tone || []) story.push({ from: 'CREATIVE_DIRECTOR', message: m, severity: 'MAJOR' });
    for (const m of fb.dialogue || []) dialogue.push({ from: 'CREATIVE_DIRECTOR', message: m, severity: 'MAJOR' });
  }

  const qa = reviews.qaReviewer;
  if (qa && !REVIEWER_PASSES.qaReviewer(qa)) {
    for (const e of qa.errors || []) {
      route({
        from: 'QA_REVIEWER',
        message: `${e.message}${e.fix ? ` — Suggested fix: ${e.fix}` : ''} (location: ${e.location})`,
        severity: e.severity === 'BLOCKER' ? 'BLOCKER' : 'MAJOR'
      }, `${e.location} ${e.message}`);
    }
  }

  const psych = reviews.childPsychologist;
  if (psych && !REVIEWER_PASSES.childPsychologist(psych)) {
    for (const c of psych.concerns || []) {
      if (!c.mustFix && c.severity !== 'CRITICAL') continue;
      route({
        from: 'CHILD_PSYCHOLOGIST',
        message: `${c.issue} — Recommendation: ${c.recommendation} (location: ${c.location})`,
        severity: c.severity === 'CRITICAL' ? 'BLOCKER' : 'MAJOR'
      }, `${c.location} ${c.issue}`);
    }
  }

  const game = reviews.gameDesigner;
  if (game && !REVIEWER_PASSES.gameDesigner(game)) {
    for (const i of game.issues || []) {
      if (i.severity === 'MINOR') continue;
      story.push({
        from: 'GAME_DESIGNER',
        message: `${i.issue} — Suggested fix: ${i.fix} (location: ${i.location})`,
        severity: i.severity === 'CRITICAL' ? 'BLOCKER' : 'MAJOR'
      });
    }
  }

  const ethics = reviews.ethicsReviewer;
  if (ethics && !REVIEWER_PASSES.ethicsReviewer(ethics)) {
    for (const i of ethics.issues || []) {
      if (i.severity === 'MINOR') continue;
      route({
        from: 'ETHICS_REVIEWER',
        message: `${i.issue} — Recommendation: ${i.recommendation} (location: ${i.location})`,
        severity: i.severity === 'CRITICAL' ? 'BLOCKER' : 'MAJOR'
      }, `${i.location} ${i.issue}`);
    }
  }

  return { story, dialogue };
}

/**
 * Restrict the roster to characters the outline still references
 * (plus the protagonist). Revisions can write characters out of the
 * story; keeping them in the declared roster makes QA flag phantom
 * characters that never appear in any scene.
 */
function activeRoster(outline, roster) {
  const referenced = new Set(collectSupportingCharacterIds(outline));
  return roster.filter(c => c.id === 'player' || referenced.has(c.id));
}

/**
 * Merge revised scene dialogue over the previous set by sceneId,
 * so a revision that only returns changed scenes never loses the rest.
 */
function mergeSceneDialogue(previous, revised) {
  const bySceneId = new Map((previous || []).map(d => [d.sceneId, d]));
  for (const d of revised || []) bySceneId.set(d.sceneId, d);
  return [...bySceneId.values()];
}

/** Same merge for choiceDialogue entries, keyed by choiceId. */
function mergeChoiceDialogue(previous, revised) {
  const byChoiceId = new Map((previous || []).map(d => [d.choiceId, d]));
  for (const d of revised || []) byChoiceId.set(d.choiceId, d);
  return [...byChoiceId.values()];
}

/** Same merge for branchDialogue entries, keyed by (sceneId, branchId). */
function mergeBranchDialogue(previous, revised) {
  const key = d => `${d.sceneId}::${d.branchId}`;
  const byKey = new Map((previous || []).map(d => [key(d), d]));
  for (const d of revised || []) byKey.set(key(d), d);
  return [...byKey.values()];
}

module.exports = {
  RESERVED_SPEAKER_IDS,
  collectSupportingCharacterIds,
  describeAppearances,
  activeRoster,
  REVIEWER_PASSES,
  failingReviewers,
  unreadableResult,
  reusedCharacterResult,
  findReusableCharacter,
  collectRevisionFeedback,
  mergeSceneDialogue,
  mergeChoiceDialogue,
  mergeBranchDialogue,
  resolveEpisodeBrief
};
