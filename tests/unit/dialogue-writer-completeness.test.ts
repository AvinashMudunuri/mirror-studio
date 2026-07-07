/**
 * Dialogue Writer deterministic cleanup/validation tests.
 *
 * Grounded in real recurring QA findings across live runs (episode 1 and
 * episode 2), each of which previously cost a full revision iteration to
 * fix:
 * - "[CHOICE POINT: choice-1]" leaking into the dialogue array as if it
 *   were spoken text (4 occurrences in one live QA review) — always
 *   wrong, stripped deterministically, no LLM call needed.
 * - choiceDialogue.responseDialogue missing an entry for one of a
 *   choice's options (2 occurrences in one live QA review) — always a
 *   defect, given ONE targeted self-repair call before ever reaching a
 *   reviewer.
 *
 * The LLM gateway and infrastructure are mocked; no API calls are made.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { DialogueWriterAgent } from '@mirror/agents';

const CHARACTER = {
  id: 'player',
  name: 'Nico',
  age: 13,
  pronouns: 'they/them',
  personality: {
    coreTraits: ['curious'],
    speechPatterns: ['short sentences'],
    mannerisms: ['taps pencil']
  },
  voiceGuidelines: { examples: ['"Okay. Fine."'] }
};

function outlineWithChoice(options: Array<{ id: string; nextScene: string }>) {
  return {
    title: 'Group Work',
    synopsis: 'A group project goes sideways.',
    themes: ['Honesty'],
    targetTraits: ['INTEGRITY'],
    scenes: [
      { id: 'scene-1', title: 'Meeting', location: 'Library', characters: ['player'], duration: 2, description: '...', emotionalBeat: 'tension' },
      { id: 'scene-2', title: 'Aftermath', location: 'Hallway', characters: ['player'], duration: 2, description: '...', emotionalBeat: 'resolve', defaultNextScene: 'END' }
    ],
    choicePoints: [
      {
        id: 'choice-1',
        scene: 'scene-1',
        prompt: 'Jordan wants to cut corners. What do you do?',
        options: options.map(o => ({ ...o, text: `Option ${o.id}` })),
        traitMapping: {}
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

// ---------- placeholder-marker stripping ----------

describe('Dialogue Writer sanitization', () => {
  it('strips [CHOICE POINT: ...] lines the model echoed as spoken dialogue', async () => {
    const llmCall = jest.fn<any>().mockResolvedValue(llmResponse({
      dialogue: [
        {
          sceneId: 'scene-1',
          lines: [
            { id: 'l1', character: 'player', text: 'Real line.' },
            { id: 'l2', character: 'NARRATOR', text: '[CHOICE POINT: choice-1]' }
          ]
        }
      ],
      choiceDialogue: [
        { choiceId: 'choice-1', options: [], responseDialogue: { a: [{ id: 'r1', character: 'player', text: 'ok' }], b: [{ id: 'r2', character: 'player', text: 'no' }] } }
      ],
      voiceNotes: 'n'
    }));
    const agent = await initAgent(llmCall);

    const result = await agent.process(writeRequest(outlineWithChoice([{ id: 'a', nextScene: 'scene-2' }, { id: 'b', nextScene: 'scene-2' }])));

    expect(result.dialogue[0].lines).toHaveLength(1);
    expect(result.dialogue[0].lines[0].text).toBe('Real line.');
    // No completeness gap here, so sanitize is the only extra step — one LLM call.
    expect(llmCall).toHaveBeenCalledTimes(1);
  });

  it('leaves dialogue untouched when there is no placeholder marker', async () => {
    const llmCall = jest.fn<any>().mockResolvedValue(llmResponse({
      dialogue: [{ sceneId: 'scene-1', lines: [{ id: 'l1', character: 'player', text: 'Hey.' }] }],
      choiceDialogue: [
        { choiceId: 'choice-1', options: [], responseDialogue: { a: [{ id: 'r1', character: 'player', text: 'ok' }], b: [{ id: 'r2', character: 'player', text: 'no' }] } }
      ],
      voiceNotes: 'n'
    }));
    const agent = await initAgent(llmCall);

    const result = await agent.process(writeRequest(outlineWithChoice([{ id: 'a', nextScene: 'scene-2' }, { id: 'b', nextScene: 'scene-2' }])));
    expect(result.dialogue[0].lines).toHaveLength(1);
  });
});

// ---------- responseDialogue completeness self-repair ----------

describe('Dialogue Writer choiceDialogue completeness', () => {
  it('passes through with one LLM call when every option has response dialogue', async () => {
    const llmCall = jest.fn<any>().mockResolvedValue(llmResponse({
      dialogue: [],
      choiceDialogue: [
        { choiceId: 'choice-1', options: [], responseDialogue: { a: [{ id: 'r1', character: 'player', text: 'ok' }], b: [{ id: 'r2', character: 'player', text: 'no' }] } }
      ],
      voiceNotes: 'n'
    }));
    const agent = await initAgent(llmCall);

    const result = await agent.process(writeRequest(outlineWithChoice([{ id: 'a', nextScene: 'scene-2' }, { id: 'b', nextScene: 'scene-2' }])));
    expect(result.choiceDialogue[0].responseDialogue).toHaveProperty('a');
    expect(result.choiceDialogue[0].responseDialogue).toHaveProperty('b');
    expect(llmCall).toHaveBeenCalledTimes(1);
  });

  it('requests a targeted self-repair for missing option coverage and merges the fix', async () => {
    const initial = llmResponse({
      dialogue: [],
      choiceDialogue: [
        // option "c" has no responseDialogue entry
        { choiceId: 'choice-1', options: [], responseDialogue: { a: [{ id: 'r1', character: 'player', text: 'ok' }], b: [{ id: 'r2', character: 'player', text: 'no' }] } }
      ],
      voiceNotes: 'n'
    });
    const repair = llmResponse({
      dialogue: [],
      choiceDialogue: [
        { choiceId: 'choice-1', options: [], responseDialogue: { c: [{ id: 'r3', character: 'player', text: 'maybe' }] } }
      ],
      voiceNotes: 'n'
    });
    const llmCall = jest.fn<any>().mockResolvedValueOnce(initial).mockResolvedValueOnce(repair);
    const agent = await initAgent(llmCall);

    const result = await agent.process(writeRequest(outlineWithChoice([
      { id: 'a', nextScene: 'scene-2' }, { id: 'b', nextScene: 'scene-2' }, { id: 'c', nextScene: 'scene-2' }
    ])));

    expect(llmCall).toHaveBeenCalledTimes(2);
    const repairPrompt = llmCall.mock.calls[1][0] as string;
    expect(repairPrompt).toContain('choice-1');
    expect(repairPrompt).toContain('for option(s): c');

    // Original a/b responses preserved, new c response merged in.
    const responseDialogue = result.choiceDialogue[0].responseDialogue;
    expect(responseDialogue.a[0].text).toBe('ok');
    expect(responseDialogue.b[0].text).toBe('no');
    expect(responseDialogue.c[0].text).toBe('maybe');
  });

  it('does not throw and leaves the gap for QA when self-repair still misses coverage', async () => {
    const initial = llmResponse({
      dialogue: [],
      choiceDialogue: [{ choiceId: 'choice-1', options: [], responseDialogue: { a: [{ id: 'r1', character: 'player', text: 'ok' }] } }],
      voiceNotes: 'n'
    });
    const stillIncomplete = llmResponse({ dialogue: [], choiceDialogue: [], voiceNotes: 'n' });
    const llmCall = jest.fn<any>().mockResolvedValueOnce(initial).mockResolvedValueOnce(stillIncomplete);
    const agent = await initAgent(llmCall);

    const result = await agent.process(writeRequest(outlineWithChoice([{ id: 'a', nextScene: 'scene-2' }, { id: 'b', nextScene: 'scene-2' }])));

    expect(llmCall).toHaveBeenCalledTimes(2);
    expect(result.choiceDialogue[0].responseDialogue).toEqual({ a: [{ id: 'r1', character: 'player', text: 'ok' }] });
  });

});
