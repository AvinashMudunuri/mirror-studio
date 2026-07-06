/**
 * LLM Gateway tests — adaptive thinking token budget handling.
 *
 * Reproduces the production failure where Claude 5's adaptive thinking
 * consumed the entire max_tokens budget and returned a thinking-only
 * response (no text block, stop_reason: 'max_tokens'), which the gateway
 * previously surfaced as an empty string.
 *
 * The Anthropic client is mocked; no API calls are made.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { LLMGateway, TokenBudgetExceededError } from '@mirror/agents';

interface MockBlock {
  type: string;
  text?: string;
  thinking?: string;
}

function mockMessage(blocks: MockBlock[], stopReason: string, outputTokens = 100) {
  return {
    content: blocks,
    stop_reason: stopReason,
    usage: { input_tokens: 500, output_tokens: outputTokens }
  };
}

const THINKING_ONLY = mockMessage(
  [{ type: 'thinking', thinking: '...' }],
  'max_tokens',
  8192
);

const TEXT_RESPONSE = mockMessage(
  [
    { type: 'thinking', thinking: '...' },
    { type: 'text', text: '{"dialogue": []}' }
  ],
  'end_turn'
);

function createGateway(createMock: jest.Mock) {
  const gateway = new LLMGateway({ anthropicApiKey: 'test-key' });
  gateway['anthropic'] = { messages: { create: createMock } } as any;
  return gateway;
}

describe('LLMGateway adaptive thinking budget handling (Claude 5+)', () => {
  it('adds thinking headroom on top of the requested response budget', async () => {
    const create = jest.fn<any>().mockResolvedValue(TEXT_RESPONSE);
    const gateway = createGateway(create);

    await gateway.call('write dialogue', {
      model: 'claude-sonnet-5',
      maxTokens: 8192,
      temperature: 0.8 // -> high effort -> 8192 headroom
    });

    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0][0] as any;
    expect(params.max_tokens).toBe(16384); // 8192 requested + 8192 headroom
    expect(params.thinking).toEqual({ type: 'adaptive' });
    expect(params.output_config).toBeUndefined(); // high is the default
    expect(params.temperature).toBeUndefined(); // Claude 5 rejects sampling params
  });

  it('retries a thinking-only response with a doubled budget', async () => {
    const create = jest.fn<any>()
      .mockResolvedValueOnce(THINKING_ONLY)
      .mockResolvedValueOnce(TEXT_RESPONSE);
    const gateway = createGateway(create);

    const response = await gateway.call('write dialogue', {
      model: 'claude-sonnet-5',
      maxTokens: 8192,
      temperature: 0.8
    });

    expect(response.content).toBe('{"dialogue": []}');
    expect(create).toHaveBeenCalledTimes(2);
    const first = create.mock.calls[0][0] as any;
    const second = create.mock.calls[1][0] as any;
    expect(first.max_tokens).toBe(16384);
    expect(second.max_tokens).toBe(32768); // doubled, capped at 32768
  });

  it('lowers effort on the final attempt to leave room for text', async () => {
    const create = jest.fn<any>()
      .mockResolvedValueOnce(THINKING_ONLY)
      .mockResolvedValueOnce(THINKING_ONLY)
      .mockResolvedValueOnce(TEXT_RESPONSE);
    const gateway = createGateway(create);

    const response = await gateway.call('write dialogue', {
      model: 'claude-sonnet-5',
      maxTokens: 8192,
      temperature: 0.8
    });

    expect(response.content).toBe('{"dialogue": []}');
    expect(create).toHaveBeenCalledTimes(3);
    const third = create.mock.calls[2][0] as any;
    expect(third.output_config).toEqual({ effort: 'medium' });
  });

  it('throws a descriptive error when every attempt is thinking-only', async () => {
    const create = jest.fn<any>().mockResolvedValue(THINKING_ONLY);
    const gateway = createGateway(create);

    await expect(
      gateway.call('write dialogue', {
        model: 'claude-sonnet-5',
        maxTokens: 8192,
        temperature: 0.8
      })
    ).rejects.toThrow(/no text after 3 attempts[\s\S]*adaptive thinking/);
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('returns truncated text after exhausting retries rather than dropping it', async () => {
    const truncated = mockMessage(
      [{ type: 'text', text: '{"dialogue": [{"sceneId":' }],
      'max_tokens',
      32768
    );
    const create = jest.fn<any>().mockResolvedValue(truncated);
    const gateway = createGateway(create);

    const response = await gateway.call('write dialogue', {
      model: 'claude-sonnet-5',
      maxTokens: 8192,
      temperature: 0.8
    });

    expect(response.content).toBe('{"dialogue": [{"sceneId":');
    expect(response.stopReason).toBe('max_tokens');
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('uses temperature and no thinking config for pre-Claude-5 models', async () => {
    const create = jest.fn<any>().mockResolvedValue(TEXT_RESPONSE);
    const gateway = createGateway(create);

    await gateway.call('write dialogue', {
      model: 'claude-sonnet-4-5-20250929',
      maxTokens: 8192,
      temperature: 0.8
    });

    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0][0] as any;
    expect(params.max_tokens).toBe(8192); // no headroom
    expect(params.temperature).toBe(0.8);
    expect(params.thinking).toBeUndefined();
  });
});

describe('LLMGateway usage tracking and token budget', () => {
  function budgetGateway(createMock: jest.Mock, maxTotalTokens?: number) {
    const gateway = new LLMGateway({ anthropicApiKey: 'test-key', maxTotalTokens });
    gateway['anthropic'] = { messages: { create: createMock } } as any;
    return gateway;
  }

  const callOpts = { model: 'claude-sonnet-5', maxTokens: 8192, temperature: 0.8 };

  it('accumulates usage across calls with a per-model breakdown', async () => {
    const create = jest.fn<any>().mockResolvedValue(TEXT_RESPONSE); // 500 in / 100 out
    const gateway = budgetGateway(create);

    await gateway.call('one', callOpts);
    await gateway.call('two', { ...callOpts, model: 'claude-haiku-4-5-20251001' });

    const usage = gateway.getUsageStats();
    expect(usage.calls).toBe(2);
    expect(usage.inputTokens).toBe(1000);
    expect(usage.outputTokens).toBe(200);
    expect(usage.totalTokens).toBe(1200);
    expect(usage.byModel['claude-sonnet-5'].calls).toBe(1);
    expect(usage.byModel['claude-haiku-4-5-20251001'].calls).toBe(1);
  });

  it('counts retried (thinking-only) attempts against the budget', async () => {
    const create = jest.fn<any>()
      .mockResolvedValueOnce(THINKING_ONLY) // 500 in / 8192 out — discarded but paid for
      .mockResolvedValueOnce(TEXT_RESPONSE); // 500 in / 100 out
    const gateway = budgetGateway(create);

    await gateway.call('write dialogue', callOpts);

    const usage = gateway.getUsageStats();
    expect(usage.calls).toBe(2);
    expect(usage.totalTokens).toBe(500 + 8192 + 500 + 100);
  });

  it('throws TokenBudgetExceededError before the next call once the budget is spent', async () => {
    const create = jest.fn<any>().mockResolvedValue(TEXT_RESPONSE); // 600 tokens/call
    const gateway = budgetGateway(create, 1000);

    await gateway.call('one', callOpts); // 600 used — still under budget
    await gateway.call('two', callOpts); // 1200 used — budget now exhausted
    await expect(gateway.call('three', callOpts)).rejects.toThrow(TokenBudgetExceededError);
    expect(create).toHaveBeenCalledTimes(2); // third call never hit the API

    const err = await gateway.call('three', callOpts).catch(e => e);
    expect(err.usage.totalTokens).toBe(1200);
    expect(err.budget).toBe(1000);
  });

  it('does not limit anything when no budget is configured', async () => {
    const create = jest.fn<any>().mockResolvedValue(TEXT_RESPONSE);
    const gateway = budgetGateway(create);

    for (let i = 0; i < 5; i++) {
      await gateway.call(`call ${i}`, callOpts);
    }
    expect(create).toHaveBeenCalledTimes(5);
  });
});
