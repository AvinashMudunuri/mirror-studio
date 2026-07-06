/**
 * Unit tests for the real-episode pipeline helpers
 * (scripts/lib/pipeline-helpers.js).
 *
 * These cover the two new pipeline behaviors:
 * - NPC roster: collecting supporting-character ids from the outline's
 *   scene character lists (QA's undefined-NPC blocker)
 * - Revision loop: deciding which reviewers fail, routing their feedback
 *   to the Story Architect vs the Dialogue Writer, and merging revised
 *   dialogue over the previous draft
 */

import { describe, it, expect } from '@jest/globals';

// CommonJS module without type declarations
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  collectSupportingCharacterIds,
  describeAppearances,
  activeRoster,
  failingReviewers,
  collectRevisionFeedback,
  mergeSceneDialogue,
  mergeChoiceDialogue
} = require('../../scripts/lib/pipeline-helpers');

// ---------- roster collection ----------

function outlineWith(scenes: any[]) {
  return { scenes };
}

describe('collectSupportingCharacterIds', () => {
  it('collects unique NPC ids in scene order', () => {
    const outline = outlineWith([
      { characters: ['player', 'mia'] },
      { characters: ['mia', 'devon', 'ms_reyes'] },
      { characters: ['player', 'devon'] }
    ]);
    expect(collectSupportingCharacterIds(outline)).toEqual(['mia', 'devon', 'ms_reyes']);
  });

  it('excludes the protagonist and narration markers regardless of case', () => {
    const outline = outlineWith([
      { characters: ['player', 'PLAYER', 'NARRATOR', 'Internal', 'sam'] }
    ]);
    expect(collectSupportingCharacterIds(outline)).toEqual(['sam']);
  });

  it('handles missing scenes/characters arrays', () => {
    expect(collectSupportingCharacterIds({})).toEqual([]);
    expect(collectSupportingCharacterIds(outlineWith([{}]))).toEqual([]);
  });
});

describe('describeAppearances', () => {
  it('describes only the scenes the character appears in', () => {
    const outline = outlineWith([
      { title: 'Arrival', location: 'Entrance', characters: ['player'], description: 'd1', emotionalBeat: 'nervous' },
      { title: 'Hallway', location: 'Hall', characters: ['player', 'mia'], description: 'd2', emotionalBeat: 'relief' }
    ]);
    const appearances = describeAppearances(outline, 'mia');
    expect(appearances).toHaveLength(1);
    expect(appearances[0]).toContain('Hallway');
    expect(appearances[0]).toContain('relief');
  });
});

describe('activeRoster', () => {
  const roster = [
    { id: 'player', name: 'P' },
    { id: 'mia', name: 'Mia' },
    { id: 'maya', name: 'Maya' }
  ];

  it('drops characters the outline no longer references', () => {
    // Revision wrote "maya" out of the story: she must not stay declared.
    const outline = outlineWith([{ characters: ['player', 'mia'] }]);
    expect(activeRoster(outline, roster).map((c: any) => c.id)).toEqual(['player', 'mia']);
  });

  it('always keeps the protagonist', () => {
    const outline = outlineWith([{ characters: ['mia'] }]);
    expect(activeRoster(outline, roster).map((c: any) => c.id)).toEqual(['player', 'mia']);
  });
});

// ---------- verdict gating ----------

describe('failingReviewers', () => {
  it('returns empty when all verdicts are positive', () => {
    expect(failingReviewers({
      creativeDirector: { decision: 'APPROVED' },
      qaReviewer: { status: 'PASS' },
      childPsychologist: { status: 'APPROVED' },
      gameDesigner: { status: 'GOOD' },
      ethicsReviewer: { status: 'EXCELLENT' }
    })).toEqual([]);
  });

  it('flags each reviewer type on its own negative verdicts', () => {
    expect(failingReviewers({
      creativeDirector: { decision: 'NEEDS_REVISION' },
      qaReviewer: { status: 'FAIL' },
      childPsychologist: { status: 'REJECTED' },
      gameDesigner: { status: 'NEEDS_WORK' },
      ethicsReviewer: { status: 'UNACCEPTABLE' }
    })).toEqual(['creativeDirector', 'qaReviewer', 'childPsychologist', 'gameDesigner', 'ethicsReviewer']);
  });

  it('ignores reviewers that have not run', () => {
    expect(failingReviewers({ qaReviewer: { status: 'FAIL' } })).toEqual(['qaReviewer']);
  });
});

// ---------- feedback routing ----------

describe('collectRevisionFeedback', () => {
  it('returns no feedback when all reviewers pass', () => {
    const { story, dialogue } = collectRevisionFeedback({
      creativeDirector: { decision: 'APPROVED', specificFeedback: { story: ['ignored'] } },
      qaReviewer: { status: 'PASS', errors: [] }
    });
    expect(story).toEqual([]);
    expect(dialogue).toEqual([]);
  });

  it('routes Creative Director story/character/tone feedback to story and dialogue feedback to dialogue', () => {
    const { story, dialogue } = collectRevisionFeedback({
      creativeDirector: {
        decision: 'NEEDS_REVISION',
        specificFeedback: {
          story: ['pacing sags in act 2'],
          character: ['mia is flat'],
          tone: ['too grim'],
          dialogue: ['jordan sounds like an adult']
        }
      }
    });
    expect(story.map((f: any) => f.message)).toEqual(['pacing sags in act 2', 'mia is flat', 'too grim']);
    expect(dialogue.map((f: any) => f.message)).toEqual(['jordan sounds like an adult']);
    expect(story.every((f: any) => f.from === 'CREATIVE_DIRECTOR' && f.severity === 'MAJOR')).toBe(true);
  });

  it('maps QA severities and routes dialogue-located errors to the Dialogue Writer', () => {
    const { story, dialogue } = collectRevisionFeedback({
      qaReviewer: {
        status: 'FAIL',
        errors: [
          { severity: 'BLOCKER', message: 'unreachable scene', location: 'scenes[4]', fix: 'add transition' },
          { severity: 'CRITICAL', message: 'speaker not in roster', location: 'scenes[2].dialogue[1]' }
        ]
      }
    });
    expect(story).toHaveLength(1);
    expect(story[0].severity).toBe('BLOCKER');
    expect(story[0].message).toContain('Suggested fix: add transition');
    expect(dialogue).toHaveLength(1);
    expect(dialogue[0].severity).toBe('MAJOR');
  });

  it('includes only must-fix or critical psychologist concerns', () => {
    const { story } = collectRevisionFeedback({
      childPsychologist: {
        status: 'NEEDS_REVISION',
        concerns: [
          { severity: 'CRITICAL', issue: 'unresolved distress', location: 'scene-9', recommendation: 'add support', mustFix: false },
          { severity: 'MODERATE', issue: 'must fix anyway', location: 'scene-3', recommendation: 'soften', mustFix: true },
          { severity: 'MINOR', issue: 'nitpick', location: 'scene-1', recommendation: 'ignore', mustFix: false }
        ]
      }
    });
    expect(story.map((f: any) => f.severity)).toEqual(['BLOCKER', 'MAJOR']);
  });

  it('skips minor game and ethics issues but keeps critical/major ones', () => {
    const { story } = collectRevisionFeedback({
      gameDesigner: {
        status: 'NEEDS_WORK',
        issues: [
          { severity: 'CRITICAL', issue: 'no agency', location: 'choice-2', fix: 'add option' },
          { severity: 'MINOR', issue: 'meh pacing', location: 'scene-5', fix: 'tighten' }
        ]
      },
      ethicsReviewer: {
        status: 'NEEDS_WORK',
        issues: [
          { severity: 'MAJOR', issue: 'stereotype risk', location: 'scene-7', recommendation: 'rework' }
        ]
      }
    });
    expect(story.map((f: any) => f.from)).toEqual(['GAME_DESIGNER', 'ETHICS_REVIEWER']);
  });
});

// ---------- dialogue merging ----------

describe('mergeSceneDialogue', () => {
  it('overrides revised scenes and keeps untouched ones', () => {
    const previous = [
      { sceneId: 's1', lines: [{ id: 'a' }] },
      { sceneId: 's2', lines: [{ id: 'b' }] }
    ];
    const revised = [{ sceneId: 's2', lines: [{ id: 'b2' }] }];
    const merged = mergeSceneDialogue(previous, revised);
    expect(merged).toHaveLength(2);
    expect(merged.find((d: any) => d.sceneId === 's2').lines[0].id).toBe('b2');
    expect(merged.find((d: any) => d.sceneId === 's1').lines[0].id).toBe('a');
  });

  it('adds scenes that only exist in the revision', () => {
    const merged = mergeSceneDialogue([{ sceneId: 's1', lines: [] }], [{ sceneId: 's3', lines: [] }]);
    expect(merged.map((d: any) => d.sceneId).sort()).toEqual(['s1', 's3']);
  });
});

describe('mergeChoiceDialogue', () => {
  it('merges by choiceId with revision winning', () => {
    const previous = [{ choiceId: 'c1', options: [{ id: 'a', text: 'old' }] }];
    const revised = [{ choiceId: 'c1', options: [{ id: 'a', text: 'new' }] }];
    expect(mergeChoiceDialogue(previous, revised)[0].options[0].text).toBe('new');
  });

  it('tolerates undefined inputs', () => {
    expect(mergeChoiceDialogue(undefined, undefined)).toEqual([]);
  });
});
