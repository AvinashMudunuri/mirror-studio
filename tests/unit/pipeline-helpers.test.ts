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
  mergeChoiceDialogue,
  mergeBranchDialogue,
  unreadableResult,
  reusedCharacterResult,
  findReusableCharacter,
  resolveEpisodeBrief
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

  it('treats an UNREADABLE verdict (unparseable reviewer response) as failing, not passing', () => {
    expect(failingReviewers({
      qaReviewer: unreadableResult('status', { message: 'bad json', rawResponse: 'garbage' }),
      creativeDirector: unreadableResult('decision', { message: 'bad json', rawResponse: 'garbage' })
    })).toEqual(['creativeDirector', 'qaReviewer']);
  });

  // docs/OPEN-QUESTIONS.md item 11: Game Designer / Ethics Reviewer / Child
  // Psychologist previously passed on their coarse status tier alone, with
  // no regard for their own severity findings or readiness booleans — live
  // runs showed a GOOD verdict alongside 5 MAJOR issues and a non-empty
  // mustFix list, and a GOOD ethics verdict alongside readyForPublication:
  // false. These cover the tightened gate.
  it('fails Game Designer GOOD if a CRITICAL/MAJOR issue survived into the verdict', () => {
    expect(failingReviewers({
      gameDesigner: { status: 'GOOD', issues: [{ severity: 'MAJOR', issue: 'railroaded choices' }] }
    })).toEqual(['gameDesigner']);
  });

  it('fails Game Designer GOOD if summary.mustFix is non-empty, even with no MAJOR/CRITICAL issues', () => {
    expect(failingReviewers({
      gameDesigner: { status: 'GOOD', issues: [], summary: { mustFix: ['add an ending that matters'] } }
    })).toEqual(['gameDesigner']);
  });

  it('passes Game Designer GOOD when only MINOR issues are present and mustFix is empty', () => {
    expect(failingReviewers({
      gameDesigner: { status: 'GOOD', issues: [{ severity: 'MINOR', issue: 'pacing nit' }], summary: { mustFix: [] } }
    })).toEqual([]);
  });

  it('always passes Game Designer EXCELLENT regardless of stray issues (top tier)', () => {
    expect(failingReviewers({
      gameDesigner: { status: 'EXCELLENT', issues: [{ severity: 'MINOR', issue: 'nit' }] }
    })).toEqual([]);
  });

  it('fails Ethics Reviewer GOOD if a CRITICAL/MAJOR issue survived into the verdict', () => {
    expect(failingReviewers({
      ethicsReviewer: { status: 'GOOD', issues: [{ severity: 'MAJOR', issue: 'model minority trope' }] }
    })).toEqual(['ethicsReviewer']);
  });

  it('fails Ethics Reviewer whenever readyForPublication is false, regardless of status tier', () => {
    expect(failingReviewers({
      ethicsReviewer: { status: 'GOOD', issues: [], summary: { readyForPublication: false } }
    })).toEqual(['ethicsReviewer']);
    expect(failingReviewers({
      ethicsReviewer: { status: 'EXCELLENT', issues: [], summary: { readyForPublication: false } }
    })).toEqual(['ethicsReviewer']);
  });

  it('passes Ethics Reviewer GOOD when issues are MINOR-only and readyForPublication is not false', () => {
    expect(failingReviewers({
      ethicsReviewer: { status: 'GOOD', issues: [{ severity: 'MINOR', issue: 'nit' }], summary: { readyForPublication: true } }
    })).toEqual([]);
    // Missing summary entirely (older manifests) must not fail on data the reviewer never provided.
    expect(failingReviewers({
      ethicsReviewer: { status: 'GOOD', issues: [] }
    })).toEqual([]);
  });

  it('fails Child Psychologist APPROVED if readyForAudience is explicitly false', () => {
    expect(failingReviewers({
      childPsychologist: { status: 'APPROVED', summary: { readyForAudience: false } }
    })).toEqual(['childPsychologist']);
  });

  it('passes Child Psychologist APPROVED when readyForAudience is true or omitted', () => {
    expect(failingReviewers({
      childPsychologist: { status: 'APPROVED', summary: { readyForAudience: true } }
    })).toEqual([]);
    expect(failingReviewers({
      childPsychologist: { status: 'APPROVED' }
    })).toEqual([]);
  });
});

describe('unreadableResult', () => {
  it('sets the given verdict field to UNREADABLE and preserves the parse error for debugging', () => {
    const error = { message: '[QA_REVIEWER] missing status', rawResponse: 'not json at all' };
    expect(unreadableResult('status', error)).toEqual({
      status: 'UNREADABLE',
      parseError: '[QA_REVIEWER] missing status',
      rawResponse: 'not json at all'
    });
  });

  it('uses whichever field name the reviewer keys its verdict on', () => {
    const error = { message: 'bad', rawResponse: 'raw' };
    expect(unreadableResult('decision', error).decision).toBe('UNREADABLE');
    expect(unreadableResult('status', error).status).toBe('UNREADABLE');
  });
});

describe('reusedCharacterResult', () => {
  it('wraps the carried-over character in a Character-Designer-shaped output', () => {
    const previousProtagonist = { id: 'player', name: 'Wren Castillo', age: 13, pronouns: 'they/them' };
    const result = reusedCharacterResult(previousProtagonist, 'player');
    expect(result.character).toEqual(previousProtagonist);
    expect(result.designNotes).toMatch(/continuity/i);
    expect(result.uncertainties).toEqual([]);
  });

  it('forces the given id defensively even if the stored profile somehow lacks it', () => {
    const result = reusedCharacterResult({ name: 'Wren Castillo', age: 13 }, 'player');
    expect(result.character.id).toBe('player');
    expect(result.character.name).toBe('Wren Castillo');
  });

  it('works for a reused NPC id, not just the protagonist', () => {
    const result = reusedCharacterResult({ name: 'Jordan Oduya' }, 'jordan');
    expect(result.character.id).toBe('jordan');
  });
});

describe('findReusableCharacter', () => {
  const previousCast = [
    { id: 'player', name: 'Wren Castillo' },
    { id: 'jordan', name: 'Jordan Oduya' }
  ];

  it('finds a previous NPC by id', () => {
    expect(findReusableCharacter('jordan', previousCast)).toEqual({ id: 'jordan', name: 'Jordan Oduya' });
  });

  it('returns undefined for an id not in the previous cast', () => {
    expect(findReusableCharacter('maya', previousCast)).toBeUndefined();
  });

  it('never matches "player" — the protagonist has its own dedicated continuity path', () => {
    expect(findReusableCharacter('player', previousCast)).toBeUndefined();
  });

  it('tolerates a missing/empty previous cast', () => {
    expect(findReusableCharacter('jordan', undefined)).toBeUndefined();
    expect(findReusableCharacter('jordan', [])).toBeUndefined();
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

  it('collects feedback for a GOOD-status reviewer that the tightened gate now treats as failing', () => {
    // Before the tightened REVIEWER_PASSES gate (docs/OPEN-QUESTIONS.md item
    // 11), a GOOD status short-circuited this function entirely — a MAJOR
    // issue never reached the revision loop even though it should have.
    const { story } = collectRevisionFeedback({
      gameDesigner: {
        status: 'GOOD',
        issues: [{ severity: 'MAJOR', issue: 'choices are cosmetic', location: 'scene-3', fix: 'add real consequence' }]
      },
      ethicsReviewer: {
        status: 'GOOD',
        issues: [],
        summary: { readyForPublication: false }
      }
    });
    expect(story.map((f: any) => f.from)).toEqual(['GAME_DESIGNER']);
    // Ethics had no issues to route (readiness flag alone has no message to
    // extract) — the run still gates via failingReviewers(), just with no
    // actionable feedback to auto-revise against.
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

// ---------- episode brief resolution (admin "generate" form) ----------

describe('resolveEpisodeBrief', () => {
  const briefs = {
    1: { world: 'New School', worldId: 'NEW_SCHOOL', season: 'S1', episodeNumber: 1, title: 'First Day', themes: ['Belonging'], targetTraits: ['CONFIDENCE'], synopsis: '...' }
  };

  it('falls back to the hardcoded table when no override is given', () => {
    expect(resolveEpisodeBrief(briefs, 1, undefined)).toEqual(briefs[1]);
    expect(resolveEpisodeBrief(briefs, 1, '')).toEqual(briefs[1]);
  });

  it('returns undefined for an undefined episode number with no override (existing "no brief" error path)', () => {
    expect(resolveEpisodeBrief(briefs, 99, undefined)).toBeUndefined();
  });

  it('uses a complete custom brief over the hardcoded table, forcing episodeNumber to match the env var', () => {
    const custom = {
      world: 'New School', worldId: 'NEW_SCHOOL', season: 'S1',
      title: 'A New One', themes: ['Trust'], targetTraits: ['INTEGRITY'], synopsis: 'Something happens.'
    };
    const result = resolveEpisodeBrief(briefs, 5, JSON.stringify(custom));
    expect(result).toEqual({ ...custom, episodeNumber: 5 });
  });

  it('throws on invalid JSON instead of silently falling back', () => {
    expect(() => resolveEpisodeBrief(briefs, 1, '{not json')).toThrow(/not valid JSON/);
  });

  it('throws when a required field is missing', () => {
    const incomplete = { world: 'New School', worldId: 'NEW_SCHOOL', season: 'S1', title: 'X', themes: ['A'], targetTraits: ['CONFIDENCE'] }; // no synopsis
    expect(() => resolveEpisodeBrief(briefs, 1, JSON.stringify(incomplete))).toThrow(/missing required field.*synopsis/);
  });

  it('throws when themes or targetTraits is empty or not an array', () => {
    const base = { world: 'New School', worldId: 'NEW_SCHOOL', season: 'S1', title: 'X', synopsis: '...' };
    expect(() => resolveEpisodeBrief(briefs, 1, JSON.stringify({ ...base, themes: [], targetTraits: ['CONFIDENCE'] }))).toThrow(/themes must be a non-empty array/);
    expect(() => resolveEpisodeBrief(briefs, 1, JSON.stringify({ ...base, themes: ['A'], targetTraits: [] }))).toThrow(/targetTraits must be a non-empty array/);
    expect(() => resolveEpisodeBrief(briefs, 1, JSON.stringify({ ...base, themes: 'A', targetTraits: ['CONFIDENCE'] }))).toThrow(/themes must be a non-empty array/);
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

describe('mergeBranchDialogue', () => {
  it('merges by (sceneId, branchId) with revision winning', () => {
    const previous = [
      { sceneId: 's9', branchId: 'authentic', lines: [{ id: 'old' }] },
      { sceneId: 's9', branchId: 'popular', lines: [{ id: 'keep' }] }
    ];
    const revised = [{ sceneId: 's9', branchId: 'authentic', lines: [{ id: 'new' }] }];
    const merged = mergeBranchDialogue(previous, revised);
    expect(merged).toHaveLength(2);
    expect(merged.find((d: any) => d.branchId === 'authentic').lines[0].id).toBe('new');
    expect(merged.find((d: any) => d.branchId === 'popular').lines[0].id).toBe('keep');
  });

  it('treats the same branchId on different scenes as distinct', () => {
    const merged = mergeBranchDialogue(
      [{ sceneId: 's8', branchId: 'authentic', lines: [] }],
      [{ sceneId: 's9', branchId: 'authentic', lines: [] }]
    );
    expect(merged).toHaveLength(2);
  });

  it('tolerates undefined inputs', () => {
    expect(mergeBranchDialogue(undefined, undefined)).toEqual([]);
  });
});
