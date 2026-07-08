/**
 * LLM Gateway tests — AWS Bedrock backend (ADR 004).
 *
 * Verifies that selecting `claudeBackend: 'bedrock'`:
 * - constructs an AnthropicBedrock client instead of an Anthropic client,
 *   and never requires an Anthropic API key;
 * - routes calls through that client while reusing the exact same request
 *   building / adaptive-thinking / retry / usage-accounting logic already
 *   covered for the direct-API backend in llm-gateway.test.ts and
 *   prompt-caching.test.ts;
 * - surfaces a clear error when the Bedrock client isn't configured.
 *
 * The AnthropicBedrock client is mocked; no AWS calls are made (this repo
 * has no AWS credentials to make one — see ADR 004 "Verification").
 */

import { describe, it, expect, jest } from '@jest/globals';
import { LLMGateway, TokenBudgetExceededError } from '@mirror/agents';

function mockMessage(text: string, opts: { stopReason?: string; outputTokens?: number; cacheCreation?: number; cacheRead?: number } = {}) {
  return {
    content: [{ type: 'text', text }],
    stop_reason: opts.stopReason || 'end_turn',
    usage: {
      input_tokens: 500,
      output_tokens: opts.outputTokens ?? 100,
      cache_creation_input_tokens: opts.cacheCreation ?? 0,
      cache_read_input_tokens: opts.cacheRead ?? 0
    }
  };
}

function createBedrockGateway(createMock: jest.Mock, extraConfig: Record<string, unknown> = {}) {
  const gateway = new LLMGateway({ claudeBackend: 'bedrock', ...extraConfig });
  gateway['bedrockClient'] = { messages: { create: createMock } } as any;
  return gateway;
}

describe('LLMGateway AWS Bedrock backend', () => {
  it('routes claude calls through the bedrock client, not the anthropic client', async () => {
    const bedrockCreate = jest.fn<any>().mockResolvedValue(mockMessage('{"ok":true}'));
    const anthropicCreate = jest.fn<any>();
    const gateway = createBedrockGateway(bedrockCreate);
    gateway['anthropic'] = { messages: { create: anthropicCreate } } as any;

    const response = await gateway.call('write dialogue', {
      model: 'us.anthropic.claude-sonnet-5',
      maxTokens: 4096
    });

    expect(response.content).toBe('{"ok":true}');
    expect(bedrockCreate).toHaveBeenCalledTimes(1);
    expect(anthropicCreate).not.toHaveBeenCalled();
  });

  it('does not require an anthropicApiKey when the bedrock backend is selected', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    new LLMGateway({ claudeBackend: 'bedrock' });
    // The "no API keys provided" warning is Anthropic/GPT-specific and
    // must not fire just because anthropicApiKey is absent on this backend.
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('No API keys provided'));
    warn.mockRestore();
  });

  it('applies the same adaptive-thinking headroom/effort logic as the direct API backend', async () => {
    const create = jest.fn<any>().mockResolvedValue(mockMessage('{"dialogue": []}'));
    const gateway = createBedrockGateway(create);

    await gateway.call('write dialogue', {
      model: 'us.anthropic.claude-sonnet-5', // Bedrock-style ID, still matches isClaudeFiveOrNewer()
      maxTokens: 8192,
      temperature: 0.8 // -> high effort -> 8192 headroom
    });

    const params = create.mock.calls[0][0] as any;
    expect(params.max_tokens).toBe(16384); // 8192 requested + 8192 headroom
    expect(params.thinking).toEqual({ type: 'adaptive' });
    expect(params.temperature).toBeUndefined(); // Claude 5+ rejects sampling params
  });

  it('retries a thinking-only response with a doubled budget, same as the direct API backend', async () => {
    const thinkingOnly = mockMessage('', { stopReason: 'max_tokens', outputTokens: 8192 });
    thinkingOnly.content = [{ type: 'thinking', thinking: '...' } as any];
    const textResponse = mockMessage('{"dialogue": []}');
    const create = jest.fn<any>()
      .mockResolvedValueOnce(thinkingOnly)
      .mockResolvedValueOnce(textResponse);
    const gateway = createBedrockGateway(create);

    const response = await gateway.call('write dialogue', {
      model: 'us.anthropic.claude-sonnet-5',
      maxTokens: 8192,
      temperature: 0.8
    });

    expect(response.content).toBe('{"dialogue": []}');
    expect(create).toHaveBeenCalledTimes(2);
    expect((create.mock.calls[1][0] as any).max_tokens).toBe(32768);
  });

  it('accounts prompt-cache tokens the same way as the direct API backend', async () => {
    const create = jest.fn<any>()
      .mockResolvedValueOnce(mockMessage('{}', { cacheCreation: 5000 }))
      .mockResolvedValueOnce(mockMessage('{}', { cacheRead: 5000 }));
    const gateway = createBedrockGateway(create);

    await gateway.call('one', { model: 'us.anthropic.claude-haiku-4-5', maxTokens: 1024, systemPrompt: [{ text: 'x', cache: true }] });
    await gateway.call('two', { model: 'us.anthropic.claude-haiku-4-5', maxTokens: 1024, systemPrompt: [{ text: 'x', cache: true }] });

    const params = create.mock.calls[0][0] as any;
    expect(params.system).toEqual([{ type: 'text', text: 'x', cache_control: { type: 'ephemeral' } }]);

    const usage = gateway.getUsageStats();
    expect(usage.cacheCreationInputTokens).toBe(5000);
    expect(usage.cacheReadInputTokens).toBe(5000);
  });

  it('counts retried attempts against the token budget, same as the direct API backend', async () => {
    const thinkingOnly = mockMessage('', { stopReason: 'max_tokens', outputTokens: 8192 });
    thinkingOnly.content = [{ type: 'thinking', thinking: '...' } as any];
    const create = jest.fn<any>()
      .mockResolvedValueOnce(thinkingOnly)
      .mockResolvedValueOnce(mockMessage('{"ok":true}'));
    const gateway = createBedrockGateway(create, { maxTotalTokens: 100000 });

    await gateway.call('write dialogue', { model: 'us.anthropic.claude-sonnet-5', maxTokens: 8192, temperature: 0.8 });

    const usage = gateway.getUsageStats();
    expect(usage.calls).toBe(2);
    expect(usage.totalTokens).toBe(500 + 8192 + 500 + 100);
  });

  it('throws TokenBudgetExceededError before hitting the bedrock API once the budget is spent', async () => {
    const create = jest.fn<any>().mockResolvedValue(mockMessage('{"ok":true}'));
    const gateway = createBedrockGateway(create, { maxTotalTokens: 500 });

    await gateway.call('one', { model: 'us.anthropic.claude-sonnet-5', maxTokens: 1024 }); // 600 used, over budget now
    await expect(
      gateway.call('two', { model: 'us.anthropic.claude-sonnet-5', maxTokens: 1024 })
    ).rejects.toThrow(TokenBudgetExceededError);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('throws a clear error if the bedrock backend is selected but the client failed to initialize', async () => {
    const gateway = new LLMGateway({ claudeBackend: 'bedrock' });
    gateway['bedrockClient'] = undefined;

    await expect(
      gateway.call('write dialogue', { model: 'us.anthropic.claude-sonnet-5', maxTokens: 1024 })
    ).rejects.toThrow(/Bedrock client failed to initialize/);
  });

  it('constructs an AnthropicBedrock client (not an Anthropic client) when no explicit AWS creds are given', () => {
    const gateway = new LLMGateway({ claudeBackend: 'bedrock' });
    expect(gateway['bedrockClient']).toBeDefined();
    expect(gateway['anthropic']).toBeUndefined();
  });

  it('defaults to the anthropic backend when claudeBackend is omitted (back-compat)', () => {
    const gateway = new LLMGateway({ anthropicApiKey: 'test-key' });
    expect(gateway['anthropic']).toBeDefined();
    expect(gateway['bedrockClient']).toBeUndefined();
  });
});
