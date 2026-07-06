/**
 * Dialogue Writer branch-aware ending tests.
 *
 * QA critical from the first live run: the ending scene contained a single
 * generic narrator line despite the outline promising a choice-reactive
 * resolution. The WRITE_DIALOGUE prompt must now demand branchDialogue
 * entries for every (ending scene, branch) pair, and the parser must
 * surface branchDialogue (defaulting to []).
 *
 * The LLM gateway and infrastructure are mocked; no API calls are made.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { DialogueWriterAgent } from '@mirror/agents';

const CHARACTER = {
  id: 'player',
  name: 'Maya',
  age: 13,
  pronouns: 'she/her',
  personality: {
    coreTraits: ['curious'],
    speechPatterns: ['short sentences'],
    mannerisms: ['taps pencil']
  },
  voiceGuidelines: { examples: ['"Okay. Fine. Whatever."'] }
};

function outline(overrides: Record<string, unknown> = {}) {
  return {
    title: 'First Day',
    synopsis: 'Maya starts at a new school.',
    themes: ['Belonging'],
    targetTraits: ['CONFIDENCE'],
    scenes: [
      { id: 'scene-1', title: 'Arrival', location: 'Hall', characters: ['player'], duration: 2, description: '...', emotionalBeat: 'nervous', defaultNextScene: 'scene-9' },
      { id: 'scene-9', title: 'Ending', location: 'Bus stop', characters: ['player'], duration: 2, description: '...', emotionalBeat: 'resolve', defaultNextScene: 'END' }
    ],
    choicePoints: [],
    branches: [
      { id: 'branch-authentic', name: 'Authentic', triggeredBy: ['choice-1:a'], description: 'Maya stayed true to herself', outcome: 'earned real friends' },
      { id: 'branch-popular', name: 'Popular', triggeredBy: ['choice-1:b'], description: 'Maya chased status', outcome: 'popular but hollow' }
    ],
    emotionalArc: [],
    characterArcs: [],
    traitMapping: [],
    relationshipDynamics: [],
    replayHooks: [],
    estimatedPlayTime: 12,
    educationalGoals: [],
    conversationStarters: [],
    ...overrides
  };
}

function llmResponse(payload: unknown) {
  return {
    content: '```json\n' + JSON.stringify(payload) + '\n```',
    model: 'claude-sonnet-5',
    provider: 'claude',
    usage: { inputTokens: 100, outputTokens: 100, totalTokens: 200 },
    stopReason: 'end_turn'
  };
}

async function initAgent(llmCall: jest.Mock) {
  const agent = new DialogueWriterAgent();
  await agent.initialize({
    workflowId: 'wf', threadId: 'th',
    messageBus: { publish: async () => {}, subscribe: async () => {}, unsubscribe: async () => {} },
    memory: { store: async () => {}, retrieve: async () => null, search: async () => [] },
    llm: { call: llmCall }
  } as any);
  return agent;
}

function writeRequest(episodeOutline: any) {
  return {
    type: 'WRITE_DIALOGUE' as const,
    writeRequest: {
      episodeOutline,
      characters: [CHARACTER],
      scenes: episodeOutline.scenes,
      emotionalBeats: [],
      choicePoints: episodeOutline.choicePoints
    }
  };
}

describe('Dialogue Writer branch-aware endings', () => {
  it('demands branchDialogue for every ending/branch pair in the prompt', async () => {
    const llmCall = jest.fn<any>().mockResolvedValue(
      llmResponse({ dialogue: [], choiceDialogue: [], voiceNotes: 'n' })
    );
    const agent = await initAgent(llmCall);
    await agent.process(writeRequest(outline()));

    const prompt = llmCall.mock.calls[0][0] as string;
    expect(prompt).toContain('BRANCH-AWARE ENDINGS (MANDATORY)');
    expect(prompt).toContain('scene-9');
    expect(prompt).toContain('branch-authentic');
    expect(prompt).toContain('branch-popular');
    // Branch context is listed for the writer
    expect(prompt).toContain('BRANCHES (paths the player can be on by the end)');
    expect(prompt).toContain('earned real friends');
  });

  it('omits the branch-ending rules when the outline has no branches', async () => {
    const llmCall = jest.fn<any>().mockResolvedValue(
      llmResponse({ dialogue: [], choiceDialogue: [], voiceNotes: 'n' })
    );
    const agent = await initAgent(llmCall);
    await agent.process(writeRequest(outline({ branches: [] })));

    const prompt = llmCall.mock.calls[0][0] as string;
    expect(prompt).not.toContain('BRANCH-AWARE ENDINGS');
  });

  it('also flags choice-terminated endings (option nextScene = END)', async () => {
    const llmCall = jest.fn<any>().mockResolvedValue(
      llmResponse({ dialogue: [], choiceDialogue: [], voiceNotes: 'n' })
    );
    const agent = await initAgent(llmCall);

    const o = outline({
      scenes: [
        { id: 'scene-1', title: 'Arrival', location: 'Hall', characters: ['player'], duration: 2, description: '...', emotionalBeat: 'nervous', defaultNextScene: 'scene-2' },
        { id: 'scene-2', title: 'Decision', location: 'Yard', characters: ['player'], duration: 2, description: '...', emotionalBeat: 'tension' }
      ],
      choicePoints: [
        {
          id: 'choice-1', scene: 'scene-2', prompt: 'Go home or stay?',
          options: [
            { id: 'a', text: 'Stay', nextScene: 'END' },
            { id: 'b', text: 'Go', nextScene: 'END' }
          ],
          traitMapping: {}
        }
      ]
    });
    await agent.process(writeRequest(o));

    const prompt = llmCall.mock.calls[0][0] as string;
    expect(prompt).toContain('BRANCH-AWARE ENDINGS (MANDATORY)');
    expect(prompt).toContain('scene-2');
  });

  it('wraps a bare scene array (no dialogue envelope) instead of failing', async () => {
    // Observed live on REVISE_DIALOGUE: the model returned a JSON array of
    // scene dialogues at the top level, crashing revision iteration 2.
    const bareArray = {
      content: '```json\n' + JSON.stringify([
        { sceneId: 'scene-1', lines: [{ id: 'l1', character: 'player', text: 'Revised line.' }] }
      ]) + '\n```',
      model: 'claude-sonnet-5',
      provider: 'claude',
      usage: { inputTokens: 100, outputTokens: 100, totalTokens: 200 },
      stopReason: 'end_turn'
    };
    const agent = await initAgent(jest.fn<any>().mockResolvedValue(bareArray));

    const result = await agent.process({
      type: 'REVISE_DIALOGUE' as const,
      revisionRequest: {
        currentDialogue: [{ sceneId: 'scene-1', lines: [] }],
        feedback: [{ from: 'QA_REVIEWER', message: 'fix the surname', severity: 'MAJOR' as const }]
      }
    });
    expect(result.dialogue).toHaveLength(1);
    expect(result.dialogue[0].lines[0].text).toBe('Revised line.');
    expect(result.choiceDialogue).toEqual([]);
    expect(result.branchDialogue).toEqual([]);
  });

  it('passes branchDialogue through and defaults it to [] when absent', async () => {
    const withBranches = llmResponse({
      dialogue: [{ sceneId: 'scene-9', lines: [{ id: 'l1', character: 'NARRATOR', text: 'Shared beat.' }] }],
      choiceDialogue: [],
      branchDialogue: [
        { sceneId: 'scene-9', branchId: 'branch-authentic', lines: [{ id: 'b1', character: 'INTERNAL', text: 'It was worth it.' }] }
      ],
      voiceNotes: 'n'
    });
    const agent = await initAgent(jest.fn<any>().mockResolvedValue(withBranches));
    const result = await agent.process(writeRequest(outline()));
    expect(result.branchDialogue).toHaveLength(1);
    expect(result.branchDialogue[0].branchId).toBe('branch-authentic');

    const agent2 = await initAgent(
      jest.fn<any>().mockResolvedValue(llmResponse({ dialogue: [], choiceDialogue: [], voiceNotes: 'n' }))
    );
    const result2 = await agent2.process(writeRequest(outline()));
    expect(result2.branchDialogue).toEqual([]);
  });
});
