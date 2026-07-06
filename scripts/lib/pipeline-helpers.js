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
 * Positive-verdict predicates per reviewer key (keys match the manifest).
 */
const REVIEWER_PASSES = {
  creativeDirector: r => r?.decision === 'APPROVED',
  qaReviewer: r => r?.status === 'PASS',
  childPsychologist: r => r?.status === 'APPROVED',
  gameDesigner: r => r?.status === 'EXCELLENT' || r?.status === 'GOOD',
  ethicsReviewer: r => r?.status === 'EXCELLENT' || r?.status === 'GOOD'
};

/** Reviewer keys whose current result blocks approval. */
function failingReviewers(reviews) {
  return Object.keys(REVIEWER_PASSES).filter(
    key => reviews[key] !== undefined && !REVIEWER_PASSES[key](reviews[key])
  );
}

function isDialogueLocated(text) {
  return /dialogue|line|speech|says|spoken/i.test(text);
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
  if (cd && cd.decision !== 'APPROVED') {
    const fb = cd.specificFeedback || {};
    for (const m of fb.story || []) story.push({ from: 'CREATIVE_DIRECTOR', message: m, severity: 'MAJOR' });
    for (const m of fb.character || []) story.push({ from: 'CREATIVE_DIRECTOR', message: m, severity: 'MAJOR' });
    for (const m of fb.tone || []) story.push({ from: 'CREATIVE_DIRECTOR', message: m, severity: 'MAJOR' });
    for (const m of fb.dialogue || []) dialogue.push({ from: 'CREATIVE_DIRECTOR', message: m, severity: 'MAJOR' });
  }

  const qa = reviews.qaReviewer;
  if (qa && qa.status !== 'PASS') {
    for (const e of qa.errors || []) {
      route({
        from: 'QA_REVIEWER',
        message: `${e.message}${e.fix ? ` — Suggested fix: ${e.fix}` : ''} (location: ${e.location})`,
        severity: e.severity === 'BLOCKER' ? 'BLOCKER' : 'MAJOR'
      }, `${e.location} ${e.message}`);
    }
  }

  const psych = reviews.childPsychologist;
  if (psych && psych.status !== 'APPROVED') {
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
  if (game && game.status !== 'EXCELLENT' && game.status !== 'GOOD') {
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
  if (ethics && ethics.status !== 'EXCELLENT' && ethics.status !== 'GOOD') {
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

module.exports = {
  RESERVED_SPEAKER_IDS,
  collectSupportingCharacterIds,
  describeAppearances,
  REVIEWER_PASSES,
  failingReviewers,
  collectRevisionFeedback,
  mergeSceneDialogue,
  mergeChoiceDialogue
};
