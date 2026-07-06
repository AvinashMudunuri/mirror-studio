/**
 * Bus-less agent operation tests
 * (ADR: docs/decisions/001-message-bus-out-of-runtime.md).
 *
 * The runtime pipeline orchestrates agents by direct calls; messageBus is
 * optional in AgentContext. Agents must initialize, process, and even send
 * (unrouted) messages without one.
 *
 * The LLM gateway and infrastructure are mocked; no API calls are made.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { CEOAgent, QAReviewerAgent } from '@mirror/agents';

function llmResponse(text: string) {
  return {
    content: text,
    model: 'claude-sonnet-5',
    provider: 'claude',
    usage: { inputTokens: 100, outputTokens: 100, totalTokens: 200 },
    stopReason: 'end_turn'
  };
}

/** Context WITHOUT a messageBus — what create-real-episode.js now passes. */
function busLessContext(llmCall: jest.Mock) {
  return {
    workflowId: 'wf',
    threadId: 'th',
    memory: { store: async () => {}, retrieve: async () => null, search: async () => [] },
    llm: { call: llmCall }
  } as any;
}

describe('agents without a message bus', () => {
  it('initialize, process, and shut down cleanly', async () => {
    const llmCall = jest.fn<any>().mockResolvedValue(llmResponse(
      '```json\n{"status": "PASS", "errors": [], "warnings": [], "summary": {"totalChecks": 1, "passedChecks": 1, "failedChecks": 0, "warningCount": 0}}\n```'
    ));
    const agent = new QAReviewerAgent();
    await agent.initialize(busLessContext(llmCall));

    const result = await agent.process({
      type: 'REVIEW_EPISODE',
      episodeReview: {
        episode: { id: 'ep-1', title: 'T', scenes: [], choices: [] },
        characters: [],
        world: { id: 'W', name: 'World' }
      }
    });
    expect(result.status).toBe('PASS');

    await agent.shutdown();
  });

  it('CEO approval sends its publish message unrouted instead of crashing', async () => {
    // On APPROVED the CEO calls sendMessage('PUBLISHER', ...). Without a
    // bus this must be a logged no-op, not a crash.
    const llmCall = jest.fn<any>().mockResolvedValue(llmResponse(
      'DECISION: APPROVED\n\nREASONING:\nShip it.'
    ));
    const agent = new CEOAgent();
    await agent.initialize(busLessContext(llmCall));

    const result = await agent.process({
      type: 'APPROVAL_REQUEST',
      episode: {
        content: { id: 'ep-1', title: 'T', worldId: 'W', episodeNumber: 1, synopsis: 's' },
        reviews: [{ agentId: 'QA_REVIEWER', decision: 'PASS' }],
        debates: []
      }
    });
    expect(result.decision).toBe('APPROVED');
  });
});
