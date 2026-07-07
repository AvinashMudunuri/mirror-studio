/**
 * Review-board caching integration test.
 *
 * The whole point of moving the episode/character/world payload into a
 * shared, cached system block (see review-context.ts) only holds if ALL
 * FIVE reviewers build that block identically for the same episode. If
 * even one reviewer's block differs by a byte, Anthropic's prefix-match
 * cache misses for it and the "shared" cache buys nothing.
 *
 * This drives each reviewer through `.process()` with a mocked LLM call
 * and asserts the `systemPrompt` sent to the gateway is
 * [cachedSharedBlock, reviewerPersona] with the cached block byte-for-byte
 * identical across all five.
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  CreativeDirectorAgent,
  QAReviewerAgent,
  ChildPsychologistAgent,
  GameDesignerAgent,
  EthicsReviewerAgent,
  buildSharedReviewContext
} from '@mirror/agents';

const WORLD = {
  id: 'NEW_SCHOOL',
  name: 'New School',
  description: 'A contemporary middle school setting.',
  setting: 'Contemporary middle school',
  tone: 'Grounded realism',
  themes: ['Belonging'],
  targetAge: [11, 14] as [number, number],
  seasons: ['Season 1']
};

const CHARACTERS = [
  {
    id: 'player', name: 'Nico', age: 13, pronouns: 'they/them',
    personality: { coreTraits: ['curious'], speechPatterns: [], mannerisms: [] },
    background: 'New to the school.',
    storyRole: 'Protagonist',
    voiceGuidelines: { examples: [] }
  },
  {
    id: 'jordan', name: 'Jordan', age: 13, pronouns: 'he/him',
    personality: { coreTraits: ['impulsive'], speechPatterns: [], mannerisms: [] },
    background: 'Wants an easy A.',
    storyRole: 'Groupmate',
    voiceGuidelines: { examples: [] }
  }
] as any;

const EPISODE = {
  id: 'ep-2', worldId: 'NEW_SCHOOL', seasonId: 'season-1', episodeNumber: 2,
  title: 'Group Work', synopsis: 'A group project goes sideways.',
  scenes: [{ id: 's1', title: 'Meeting', location: 'Library', characters: ['player', 'jordan'], duration: 2, description: '...', emotionalBeat: 'tension' }],
  choices: [], choiceDialogue: [], branchDialogue: [], outcomes: [],
  emotionalArc: [], themes: ['Honesty'], educationalGoals: [],
  targetTraits: [{ traitId: 'INTEGRITY', changeAmount: 1 }],
  targetAge: [11, 14], characters: ['player', 'jordan'],
  estimatedPlayTime: 12, status: 'DRAFT',
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
} as any;

function llmResponse(json: unknown) {
  return {
    content: '```json\n' + JSON.stringify(json) + '\n```',
    model: 'claude-haiku-4-5-20251001',
    provider: 'claude',
    usage: { inputTokens: 100, outputTokens: 100, totalTokens: 200 },
    stopReason: 'end_turn'
  };
}

async function initAgent<T extends { initialize: Function }>(agent: T, llmCall: jest.Mock): Promise<T> {
  await (agent as any).initialize({
    workflowId: 'wf', threadId: 'th',
    messageBus: { publish: async () => {}, subscribe: async () => {}, unsubscribe: async () => {} },
    memory: { store: async () => {}, retrieve: async () => null, search: async () => [] },
    llm: { call: llmCall }
  });
  return agent;
}

/** The system prompt's first (cached) block, as actually sent to the gateway. */
function cachedBlockSentTo(llmCall: jest.Mock): string {
  const options = llmCall.mock.calls[0][1] as any;
  const systemPrompt = options.systemPrompt;
  expect(Array.isArray(systemPrompt)).toBe(true);
  expect(systemPrompt[0].cache).toBe(true);
  expect(systemPrompt[1].cache).toBeFalsy();
  return systemPrompt[0].text;
}

describe('Review board shared cache block', () => {
  const expectedBlock = buildSharedReviewContext({ episode: EPISODE, characters: CHARACTERS, world: WORLD });

  it('Creative Director builds the identical shared block', async () => {
    const llmCall = jest.fn<any>().mockResolvedValue(llmResponse({ decision: 'APPROVED', creativeNotes: 'n' }));
    const agent = await initAgent(new CreativeDirectorAgent(), llmCall);
    await agent.process({
      type: 'EPISODE_REVIEW',
      episodeReview: { episode: EPISODE, worldContext: WORLD, previousEpisodes: [], characters: CHARACTERS }
    });
    expect(cachedBlockSentTo(llmCall)).toBe(expectedBlock);
  });

  it('QA Reviewer builds the identical shared block', async () => {
    const llmCall = jest.fn<any>().mockResolvedValue(llmResponse({ status: 'PASS', errors: [], warnings: [] }));
    const agent = await initAgent(new QAReviewerAgent(), llmCall);
    await agent.process({
      type: 'REVIEW_EPISODE',
      episodeReview: { episode: EPISODE, characters: CHARACTERS, world: WORLD }
    });
    expect(cachedBlockSentTo(llmCall)).toBe(expectedBlock);
  });

  it('Child Psychologist builds the identical shared block', async () => {
    const llmCall = jest.fn<any>().mockResolvedValue(llmResponse({
      status: 'APPROVED',
      scores: { ageAppropriateness: 8, emotionalSafety: 8, educationalValue: 8, mentalHealthRep: 8, overall: 8 }
    }));
    const agent = await initAgent(new ChildPsychologistAgent(), llmCall);
    await agent.process({
      type: 'REVIEW_EPISODE',
      episodeReview: { episode: EPISODE, characters: CHARACTERS, world: WORLD }
    });
    expect(cachedBlockSentTo(llmCall)).toBe(expectedBlock);
  });

  it('Game Designer builds the identical shared block', async () => {
    const llmCall = jest.fn<any>().mockResolvedValue(llmResponse({
      status: 'GOOD',
      scores: { engagement: 7, choiceQuality: 8, pacing: 7, playerAgency: 8, replayability: 6, overall: 7 }
    }));
    const agent = await initAgent(new GameDesignerAgent(), llmCall);
    await agent.process({
      type: 'REVIEW_EPISODE',
      episodeReview: { episode: EPISODE, characters: CHARACTERS, world: WORLD }
    });
    expect(cachedBlockSentTo(llmCall)).toBe(expectedBlock);
  });

  it('Ethics Reviewer builds the identical shared block', async () => {
    const llmCall = jest.fn<any>().mockResolvedValue(llmResponse({
      status: 'GOOD',
      scores: { biasAvoidance: 8, representation: 8, tropes: 8, ethicalModeling: 8, culturalSensitivity: 8, overall: 8 }
    }));
    const agent = await initAgent(new EthicsReviewerAgent(), llmCall);
    await agent.process({
      type: 'REVIEW_EPISODE',
      episodeReview: { episode: EPISODE, characters: CHARACTERS, world: WORLD }
    });
    expect(cachedBlockSentTo(llmCall)).toBe(expectedBlock);
  });
});
