/**
 * Bound-script compiler tests (scripts/lib/compile-screenplay.js).
 *
 * The compiler assembles a run's final artifacts into a single
 * human-readable screenplay. It is pure assembly — no LLM calls — so
 * these tests fully specify its behavior.
 */

import { describe, it, expect } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { compileScreenplay, resolveFinalArtifacts } = require('../../scripts/lib/compile-screenplay');

const CAST = [
  { id: 'player', name: 'Sam Okafor', age: 13, pronouns: 'she/her', storyRole: 'Protagonist' },
  { id: 'jordan', name: 'Jordan Alvarez', age: 13, pronouns: 'he/him', storyRole: 'The overlooked classmate' }
];

const OUTLINE = {
  title: 'First Day',
  synopsis: 'Sam starts at a new school.',
  themes: ['Belonging'],
  estimatedPlayTime: 12,
  scenes: [
    {
      id: 'scene-1', title: 'Arrival', location: 'Front steps',
      characters: ['player'], duration: 2,
      description: 'Sam stares up at the school.', emotionalBeat: 'nervous',
      defaultNextScene: 'scene-2'
    },
    {
      id: 'scene-2', title: 'The Hallway', location: 'Hallway',
      characters: ['player', 'jordan'], duration: 3,
      description: 'Books everywhere.', emotionalBeat: 'tension'
    },
    {
      id: 'scene-3', title: 'Ending', location: 'Bus stop',
      characters: ['player'], duration: 2,
      description: 'The day settles.', emotionalBeat: 'resolve',
      defaultNextScene: 'END'
    }
  ],
  choicePoints: [
    {
      id: 'choice-1', scene: 'scene-2', prompt: 'What do you do?',
      options: [
        { id: 'a', text: 'Help pick up the books', nextScene: 'scene-3' },
        { id: 'b', text: 'Keep walking', nextScene: 'scene-3' }
      ],
      traitMapping: {}
    }
  ],
  branches: [
    { id: 'branch-kind', name: 'The Kind Path', triggeredBy: ['choice-1:a'], description: 'Sam helps.', outcome: 'friendship' },
    { id: 'branch-avoidant', name: 'The Avoidant Path', triggeredBy: ['choice-1:b'], description: 'Sam avoids.', outcome: 'regret' }
  ]
};

const DIALOGUE = {
  dialogue: [
    {
      sceneId: 'scene-1',
      lines: [
        { id: 'l1', character: 'NARRATOR', text: 'The school looms.' },
        { id: 'l2', character: 'INTERNAL', text: 'Fifth first day. No system yet.' }
      ]
    },
    {
      sceneId: 'scene-2',
      lines: [
        { id: 'l3', character: 'jordan', text: 'Oh no — sorry — that was my fault.', emotion: 'flustered', action: 'scrambles for books' }
      ]
    }
  ],
  choiceDialogue: [
    {
      choiceId: 'choice-1',
      options: [
        { id: 'a', text: 'Here, let me help.' },
        { id: 'b', text: '(say nothing)' }
      ],
      responseDialogue: {
        a: [{ id: 'r1', character: 'jordan', text: 'Thanks. Really.', pause: 500 }]
      }
    }
  ],
  branchDialogue: [
    { sceneId: 'scene-3', branchId: 'branch-kind', lines: [{ id: 'b1', character: 'INTERNAL', text: 'Worth it.' }] },
    { sceneId: 'scene-3', branchId: 'branch-avoidant', lines: [{ id: 'b2', character: 'INTERNAL', text: 'Should have stopped.' }] }
  ]
};

const APPROVED_MANIFEST = {
  finalStatus: 'APPROVED',
  episode: { number: 1, world: 'NEW_SCHOOL' },
  run: { startedAt: '2026-07-06T12:00:00Z', model: 'claude-sonnet-5' },
  verdicts: { creativeDirector: 'APPROVED', qaReviewer: 'PASS' }
};

function compile(manifest: any = APPROVED_MANIFEST) {
  return compileScreenplay({ outline: OUTLINE, cast: CAST, dialogueResult: DIALOGUE, manifest });
}

describe('compileScreenplay', () => {
  it('stamps FINAL — LOCKED only for approved runs', () => {
    expect(compile()).toContain('FINAL — LOCKED');
    const draft = compile({ ...APPROVED_MANIFEST, finalStatus: 'NEEDS_HUMAN_REVIEW' });
    expect(draft).toContain('DRAFT (NEEDS_HUMAN_REVIEW)');
    expect(draft).toContain('NOT been approved');
    expect(compile(null)).toContain('DRAFT (no review record)');
  });

  it('includes the title page, cast, and review board', () => {
    const script = compile();
    expect(script).toContain('# First Day');
    expect(script).toContain('**Sam Okafor** (`player`, 13, she/her) — Protagonist');
    expect(script).toContain('creativeDirector: APPROVED | qaReviewer: PASS');
  });

  it('renders scenes with narration, speaker names, emotions, and actions', () => {
    const script = compile();
    expect(script).toContain('### Scene 1: Arrival `scene-1`');
    expect(script).toContain('**NARRATOR**: The school looms.');
    expect(script).toContain('**INTERNAL (V.O.)**: Fifth first day.');
    expect(script).toContain('**JORDAN ALVAREZ** *(flustered)*: Oh no — sorry — that was my fault.');
    expect(script).toContain('*[scrambles for books]*');
  });

  it('renders choice points with spoken option text, destinations, and responses', () => {
    const script = compile();
    expect(script).toContain('#### CHOICE `choice-1` — What do you do?');
    // Spoken text from choiceDialogue wins over the outline's option text
    expect(script).toContain('**(a)** "Here, let me help." → `scene-3`');
    expect(script).toContain('Thanks. Really.');
    expect(script).toContain('*[pause 500ms]*');
  });

  it('renders transitions for choiceless scenes and the episode end', () => {
    const script = compile();
    expect(script).toContain('*[CONTINUE TO `scene-2`]*');
    expect(script).toContain('*[EPISODE END]*');
  });

  it('renders branch-specific ending variants and the branch map', () => {
    const script = compile();
    expect(script).toContain('#### Ending variants for `scene-3`');
    expect(script).toContain('**Branch `branch-kind`** — The Kind Path *(triggered by: choice-1:a)*');
    expect(script).toContain('Worth it.');
    expect(script).toContain('## Branch Map');
    expect(script).toContain('Triggered by: `choice-1:b`');
  });
});

describe('resolveFinalArtifacts', () => {
  const BASE_FILES: Record<string, any> = {
    '01-story-outline.json': { episodeOutline: { ...OUTLINE, title: 'Original' } },
    '03-dialogue.json': { dialogue: [{ sceneId: 'scene-1', lines: [] }] },
    '02-protagonist.json': { character: CAST[0] },
    '02-supporting-characters.json': [{ character: CAST[1] }],
    'manifest.json': APPROVED_MANIFEST
  };

  it('uses the base artifacts when there are no revisions', () => {
    const { outline, cast, manifest } = resolveFinalArtifacts(
      (p: string) => BASE_FILES[p],
      () => []
    );
    expect(outline.title).toBe('Original');
    expect(cast.map((c: any) => c.id)).toEqual(['player', 'jordan']);
    expect(manifest.finalStatus).toBe('APPROVED');
  });

  it('prefers the latest revision artifacts over the base ones', () => {
    const files = {
      ...BASE_FILES,
      'revision-1/story-outline.json': { episodeOutline: { ...OUTLINE, title: 'Rev 1' } },
      'revision-1/dialogue.json': { dialogue: [{ sceneId: 'scene-1', lines: [{ id: 'x', character: 'NARRATOR', text: 'rev1' }] }] },
      'revision-2/dialogue.json': { dialogue: [{ sceneId: 'scene-1', lines: [{ id: 'y', character: 'NARRATOR', text: 'rev2' }] }] }
    };
    const { outline, dialogueResult } = resolveFinalArtifacts(
      (p: string) => files[p as keyof typeof files],
      () => ['revision-1', 'revision-2']
    );
    // Outline only revised in revision 1; dialogue revised again in revision 2
    expect(outline.title).toBe('Rev 1');
    expect(dialogueResult.dialogue[0].lines[0].text).toBe('rev2');
  });

  it('throws when the folder is not a run folder', () => {
    expect(() => resolveFinalArtifacts(() => undefined, () => [])).toThrow(/not a run folder/);
  });
});
