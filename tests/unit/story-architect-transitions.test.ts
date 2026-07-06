/**
 * Story Architect scene-graph validation tests.
 *
 * QA's top blocker on the first live run: choice options never declared
 * which scene they lead to, making episodes impossible to execute. The
 * Story Architect now requires explicit transitions (option.nextScene,
 * scene.defaultNextScene), validates the resulting graph (references,
 * dead ends, reachability, termination), and gives the LLM one
 * self-repair attempt before failing loudly.
 *
 * The LLM gateway and infrastructure are mocked; no API calls are made.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { StoryArchitectAgent } from '@mirror/agents';

// ---------- outline builders ----------

function validOutline() {
  return {
    title: 'First Day',
    synopsis: 'Alex starts at a new school.',
    themes: ['Belonging'],
    targetTraits: ['CONFIDENCE', 'EMPATHY', 'ADAPTABILITY'],
    scenes: [
      { id: 'scene-1', title: 'Arrival', location: 'Entrance', characters: ['player'], duration: 2, description: '...', emotionalBeat: 'nervous', defaultNextScene: 'scene-2' },
      { id: 'scene-2', title: 'Hallway', location: 'Hallway', characters: ['player', 'jordan'], duration: 3, description: '...', emotionalBeat: 'relief' },
      { id: 'scene-3a', title: 'Lunch A', location: 'Cafeteria', characters: ['player'], duration: 4, description: '...', emotionalBeat: 'hope', defaultNextScene: 'END' },
      { id: 'scene-3b', title: 'Lunch B', location: 'Cafeteria', characters: ['player'], duration: 4, description: '...', emotionalBeat: 'doubt', defaultNextScene: 'END' }
    ],
    choicePoints: [
      {
        id: 'choice-1',
        scene: 'scene-2',
        prompt: 'Jordan offers help. What do you do?',
        options: [
          { id: 'a', text: 'Accept', nextScene: 'scene-3a' },
          { id: 'b', text: 'Decline', nextScene: 'scene-3b' }
        ],
        traitMapping: { a: { EMPATHY: 1 }, b: { CONFIDENCE: 1 } }
      }
    ],
    branches: [],
    emotionalArc: [],
    characterArcs: [],
    traitMapping: [],
    relationshipDynamics: [],
    replayHooks: [],
    estimatedPlayTime: 12,
    educationalGoals: [],
    conversationStarters: []
  };
}

const validate = (outline: any): string[] => {
  const agent = new StoryArchitectAgent();
  return agent['validateTransitions'](outline);
};

// ---------- graph validation ----------

describe('validateTransitions', () => {
  it('accepts a complete, playable scene graph', () => {
    expect(validate(validOutline())).toEqual([]);
  });

  it('rejects options without nextScene (the QA blocker from the live run)', () => {
    const outline = validOutline();
    delete (outline.choicePoints[0].options[0] as any).nextScene;
    const errors = validate(outline);
    expect(errors.some(e => e.includes('missing "nextScene"'))).toBe(true);
  });

  it('rejects options pointing to unknown scenes', () => {
    const outline = validOutline();
    outline.choicePoints[0].options[1].nextScene = 'scene-99';
    const errors = validate(outline);
    expect(errors.some(e => e.includes('unknown scene "scene-99"'))).toBe(true);
  });

  it('rejects choice points attached to unknown scenes', () => {
    const outline = validOutline();
    outline.choicePoints[0].scene = 'scene-nope';
    const errors = validate(outline);
    expect(errors.some(e => e.includes('attached to unknown scene'))).toBe(true);
  });

  it('rejects dead-end scenes (no choice point, no defaultNextScene)', () => {
    const outline = validOutline();
    delete (outline.scenes[2] as any).defaultNextScene; // scene-3a
    const errors = validate(outline);
    expect(errors.some(e => e.includes('scene-3a') && e.includes('dead end'))).toBe(true);
  });

  it('rejects unreachable scenes', () => {
    const outline = validOutline();
    outline.scenes.push({
      id: 'scene-orphan', title: 'Orphan', location: 'Nowhere', characters: [],
      duration: 1, description: '...', emotionalBeat: 'lost', defaultNextScene: 'END'
    });
    const errors = validate(outline);
    expect(errors.some(e => e.includes('scene-orphan') && e.includes('unreachable'))).toBe(true);
  });

  it('rejects graphs that never reach END', () => {
    const outline = validOutline();
    outline.scenes[2].defaultNextScene = 'scene-1'; // loop back
    outline.scenes[3].defaultNextScene = 'scene-1';
    const errors = validate(outline);
    expect(errors.some(e => e.includes('reaches "END"'))).toBe(true);
  });

  it('rejects an outline with no scenes', () => {
    const outline = validOutline();
    outline.scenes = [];
    expect(validate(outline)).toEqual(['Episode has no scenes']);
  });
});

// ---------- self-repair flow ----------

function llmResponse(outline: any) {
  return {
    content: '```json\n' + JSON.stringify({ episodeOutline: outline, designNotes: 'n' }) + '\n```',
    model: 'claude-sonnet-5',
    provider: 'claude',
    usage: { inputTokens: 100, outputTokens: 100, totalTokens: 200 },
    stopReason: 'end_turn'
  };
}

function brokenOutline() {
  const outline = validOutline();
  delete (outline.choicePoints[0].options[0] as any).nextScene;
  return outline;
}

async function initAgent(llmCall: jest.Mock) {
  const agent = new StoryArchitectAgent();
  await agent.initialize({
    workflowId: 'wf', threadId: 'th',
    messageBus: { publish: async () => {}, subscribe: async () => {}, unsubscribe: async () => {} },
    memory: { store: async () => {}, retrieve: async () => null, search: async () => [] },
    llm: { call: llmCall }
  } as any);
  return agent;
}

const BRIEF = {
  type: 'NEW_EPISODE' as const,
  brief: {
    world: 'New School', season: 'S1', episodeNumber: 1,
    themes: ['Belonging'], targetTraits: ['CONFIDENCE' as const], characters: []
  }
};

describe('Story Architect self-repair', () => {
  it('passes a valid outline through with a single LLM call', async () => {
    const llmCall = jest.fn<any>().mockResolvedValue(llmResponse(validOutline()));
    const agent = await initAgent(llmCall);

    const result = await agent.process(BRIEF);
    expect(result.episodeOutline.title).toBe('First Day');
    expect(llmCall).toHaveBeenCalledTimes(1);
  });

  it('wraps a bare outline object (no episodeOutline key) instead of failing', async () => {
    // Observed live on REVISION_REQUEST: the model returned the outline
    // fields at the top level, crashing the revision loop.
    const bare = {
      content: '```json\n' + JSON.stringify(validOutline()) + '\n```',
      model: 'claude-sonnet-5',
      provider: 'claude',
      usage: { inputTokens: 100, outputTokens: 100, totalTokens: 200 },
      stopReason: 'end_turn'
    };
    const llmCall = jest.fn<any>().mockResolvedValue(bare);
    const agent = await initAgent(llmCall);

    const result = await agent.process({
      type: 'REVISION_REQUEST' as const,
      revisionRequest: {
        currentDraft: validOutline() as any,
        feedback: [{ from: 'QA_REVIEWER', message: 'fix pacing', severity: 'MAJOR' as const }],
        constraints: []
      }
    });
    expect(result.episodeOutline.title).toBe('First Day');
    expect(result.episodeOutline.scenes).toHaveLength(4);
  });

  it('repairs a broken graph via one extra LLM call with the errors in the prompt', async () => {
    const llmCall = jest.fn<any>()
      .mockResolvedValueOnce(llmResponse(brokenOutline()))
      .mockResolvedValueOnce(llmResponse(validOutline()));
    const agent = await initAgent(llmCall);

    const result = await agent.process(BRIEF);
    expect(result.episodeOutline.title).toBe('First Day');
    expect(llmCall).toHaveBeenCalledTimes(2);

    const repairPrompt = (llmCall.mock.calls[1][0] as string);
    expect(repairPrompt).toContain('missing "nextScene"');
    expect(repairPrompt).toContain('UNPLAYABLE');
  });

  it('throws when the graph is still broken after self-repair', async () => {
    const llmCall = jest.fn<any>().mockResolvedValue(llmResponse(brokenOutline()));
    const agent = await initAgent(llmCall);

    await expect(agent.process(BRIEF)).rejects.toThrow(/structurally unplayable after self-repair/);
    expect(llmCall).toHaveBeenCalledTimes(2);
  });
});
