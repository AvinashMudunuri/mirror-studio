/**
 * Regression tests: reviewers must tolerate partially-assembled episodes.
 *
 * The real-episode script passes a review payload that is not a full
 * EpisodeSchema object (e.g. no `characters` array, no `targetAge`,
 * targetTraits as objects). The Game Designer crashed in production on
 * `episode.characters.length` and the Ethics Reviewer would have crashed
 * next on `episode.targetAge[0]`. Prompt builders must handle missing
 * summary fields; the full episode JSON is embedded in the prompt anyway.
 *
 * The LLM gateway and infrastructure are mocked; no API calls are made.
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  GameDesignerAgent,
  EthicsReviewerAgent,
  ChildPsychologistAgent,
  QAReviewerAgent
} from '@mirror/agents';

// The exact shape create-real-episode.js used to send (pre-fix): summary
// fields missing, targetTraits as objects, no characters/targetAge.
const PARTIAL_EPISODE = {
  id: 'ep-1',
  worldId: 'NEW_SCHOOL',
  seasonId: 'season-1',
  episodeNumber: 1,
  title: 'First Bell',
  synopsis: 'Alex navigates their first day.',
  scenes: [],
  choices: [],
  outcomes: [],
  themes: ['Belonging'],
  educationalGoals: [],
  targetTraits: [{ traitId: 'CONFIDENCE', changeAmount: 1 }],
  status: 'DRAFT'
};

const CHARACTER = {
  id: 'nova-001',
  name: 'Nova Reyes',
  age: 15,
  pronouns: 'she/her',
  background: 'New in town',
  personality: { coreTraits: ['loyal', 'brave'] }
};

const WORLD = {
  id: 'NEW_SCHOOL',
  name: 'New School',
  description: 'A contemporary middle school',
  themes: ['Belonging'],
  targetAge: [11, 14]
};

const REVIEWS: Record<string, object> = {
  GAME_DESIGNER: {
    status: 'NEEDS_WORK',
    scores: { engagement: 4, choiceQuality: 4, pacing: 5, playerAgency: 4, replayability: 3, overall: 4 }
  },
  ETHICS_REVIEWER: {
    status: 'GOOD',
    scores: { biasAvoidance: 8, representation: 8, tropes: 8, ethicalModeling: 8, culturalSensitivity: 8, overall: 8 }
  },
  CHILD_PSYCHOLOGIST: {
    status: 'NEEDS_REVISION',
    scores: { ageAppropriateness: 7, emotionalSafety: 7, educationalValue: 6, mentalHealthRep: 7, overall: 7 }
  },
  QA_REVIEWER: {
    status: 'FAIL',
    errors: [],
    warnings: []
  }
};

function mockContext(agentId: string) {
  const llmCall = jest.fn<any>().mockResolvedValue({
    content: JSON.stringify(REVIEWS[agentId]),
    model: 'claude-sonnet-5',
    provider: 'claude',
    usage: { inputTokens: 100, outputTokens: 100, totalTokens: 200 },
    stopReason: 'end_turn'
  });
  return {
    context: {
      workflowId: 'wf-test',
      threadId: 'th-test',
      messageBus: { publish: async () => {}, subscribe: async () => {}, unsubscribe: async () => {} },
      memory: { store: async () => {}, retrieve: async () => null, search: async () => [] },
      llm: { call: llmCall }
    } as any,
    llmCall
  };
}

describe('Reviewers tolerate partially-assembled episodes', () => {
  it('Game Designer reviews without characters/estimatedPlayTime fields (crashed in production)', async () => {
    const agent = new GameDesignerAgent();
    const { context, llmCall } = mockContext('GAME_DESIGNER');
    await agent.initialize(context);

    const result = await agent.process({
      type: 'REVIEW_EPISODE',
      episodeReview: { episode: PARTIAL_EPISODE, characters: [CHARACTER], world: WORLD }
    });

    expect(result.status).toBe('NEEDS_WORK');
    expect(llmCall).toHaveBeenCalledTimes(1);
    const prompt = (llmCall.mock.calls[0][0] as string);
    expect(prompt).toContain('Characters: 0');
    expect(prompt).not.toContain('[object Object]'); // targetTraits objects serialized readably
  });

  it('Ethics Reviewer falls back to the world target age when the episode has none', async () => {
    const agent = new EthicsReviewerAgent();
    const { context, llmCall } = mockContext('ETHICS_REVIEWER');
    await agent.initialize(context);

    const result = await agent.process({
      type: 'REVIEW_EPISODE',
      episodeReview: { episode: PARTIAL_EPISODE, characters: [CHARACTER], world: WORLD }
    });

    expect(result.status).toBe('GOOD');
    const prompt = (llmCall.mock.calls[0][0] as string);
    expect(prompt).toContain('Target Age: 11-14');
  });

  it('Child Psychologist reviews an episode without themes', async () => {
    const agent = new ChildPsychologistAgent();
    const { context } = mockContext('CHILD_PSYCHOLOGIST');
    await agent.initialize(context);

    const { themes, ...episodeWithoutThemes } = PARTIAL_EPISODE;
    const result = await agent.process({
      type: 'REVIEW_EPISODE',
      episodeReview: { episode: episodeWithoutThemes, characters: [CHARACTER], world: WORLD }
    });

    expect(result.status).toBe('NEEDS_REVISION');
  });

  it('QA Reviewer handles the partial episode (stringify-only prompt)', async () => {
    const agent = new QAReviewerAgent();
    const { context } = mockContext('QA_REVIEWER');
    await agent.initialize(context);

    const result = await agent.process({
      type: 'REVIEW_EPISODE',
      episodeReview: { episode: PARTIAL_EPISODE, characters: [CHARACTER], world: WORLD, previousEpisodes: [] }
    });

    expect(result.status).toBe('FAIL');
  });
});
