/**
 * CEO agent smoke tests.
 *
 * The CEO agent previously extended the legacy base-agent whose callLLM
 * was an unimplemented stub that always threw — any APPROVAL_REQUEST
 * crashed. It now extends base-agent-v2 (LLM gateway wired). These tests
 * prove the migrated agent initializes and completes an episode review.
 *
 * The LLM gateway and infrastructure are mocked; no API calls are made.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { CEOAgent } from '@mirror/agents';

function llmResponse(text: string) {
  return {
    content: text,
    model: 'claude-sonnet-5',
    provider: 'claude',
    usage: { inputTokens: 100, outputTokens: 100, totalTokens: 200 },
    stopReason: 'end_turn'
  };
}

async function initAgent(llmCall: jest.Mock) {
  const agent = new CEOAgent();
  await agent.initialize({
    workflowId: 'wf', threadId: 'th',
    messageBus: { publish: async () => {}, subscribe: async () => {}, unsubscribe: async () => {} },
    memory: { store: async () => {}, retrieve: async () => null, search: async () => [] },
    llm: { call: llmCall }
  } as any);
  return agent;
}

const APPROVAL_REQUEST = {
  type: 'APPROVAL_REQUEST' as const,
  episode: {
    content: {
      id: 'ep-1',
      title: 'First Day',
      worldId: 'NEW_SCHOOL',
      episodeNumber: 1,
      synopsis: 'A new school, a new start.'
    },
    reviews: [
      { agentId: 'QA_REVIEWER', decision: 'PASS', notes: 'Clean.' }
    ],
    debates: []
  }
};

describe('CEO agent (post base-agent-v2 migration)', () => {
  it('completes an APPROVAL_REQUEST using the working callLLM', async () => {
    const llmCall = jest.fn<any>().mockResolvedValue(llmResponse(
      'DECISION: APPROVED\n\nREASONING:\nStrong episode that serves the mission.\n\nSTRATEGIC NOTES:\nMore like this.'
    ));
    const agent = await initAgent(llmCall);

    const result = await agent.process(APPROVAL_REQUEST);

    expect(llmCall).toHaveBeenCalledTimes(1);
    expect(result.decision).toBe('APPROVED');
    expect(result.reasoning).toContain('serves the mission');
  });

  it('parses NEEDS_REVISION decisions', async () => {
    const llmCall = jest.fn<any>().mockResolvedValue(llmResponse(
      'DECISION: NEEDS_REVISION\n\nREASONING:\nEnding is rushed.'
    ));
    const agent = await initAgent(llmCall);

    const result = await agent.process(APPROVAL_REQUEST);
    expect(result.decision).toBe('NEEDS_REVISION');
  });
});
