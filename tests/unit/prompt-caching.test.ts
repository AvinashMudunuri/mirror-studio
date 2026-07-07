/**
 * Prompt caching tests.
 *
 * Two things need to hold for the review-board caching to actually pay
 * off (see docs/OPEN-QUESTIONS.md item 4 / the token-cost investigation):
 * 1. LLMGateway must build a `cache_control` breakpoint from a structured
 *    system prompt and surface cache_creation/cache_read usage.
 * 2. `buildSharedReviewContext` must produce byte-identical output
 *    regardless of which reviewer calls it — Anthropic's cache key is an
 *    exact prefix match, so any drift (key order, formatting, extra
 *    whitespace) between reviewers silently kills the cache hit.
 *
 * The Anthropic client is mocked; no API calls are made.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { LLMGateway, buildSharedReviewContext } from '@mirror/agents';

function mockMessage(text: string, cacheCreation = 0, cacheRead = 0) {
  return {
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 500,
      output_tokens: 100,
      cache_creation_input_tokens: cacheCreation,
      cache_read_input_tokens: cacheRead
    }
  };
}

function createGateway(createMock: jest.Mock) {
  const gateway = new LLMGateway({ anthropicApiKey: 'test-key' });
  gateway['anthropic'] = { messages: { create: createMock } } as any;
  return gateway;
}

describe('LLMGateway structured system prompt / cache_control', () => {
  it('passes a plain string system prompt through unchanged (back-compat)', async () => {
    const create = jest.fn<any>().mockResolvedValue(mockMessage('{}'));
    const gateway = createGateway(create);

    await gateway.call('review this', { model: 'claude-haiku-4-5-20251001', maxTokens: 1024, systemPrompt: 'You are a reviewer.' });

    const params = create.mock.calls[0][0] as any;
    expect(params.system).toBe('You are a reviewer.');
  });

  it('builds cache_control on the marked block, in order, for an array system prompt', async () => {
    const create = jest.fn<any>().mockResolvedValue(mockMessage('{}'));
    const gateway = createGateway(create);

    await gateway.call('review this', {
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 1024,
      systemPrompt: [
        { text: 'SHARED STABLE CONTEXT', cache: true },
        { text: 'REVIEWER-SPECIFIC PERSONA' }
      ]
    });

    const params = create.mock.calls[0][0] as any;
    expect(params.system).toEqual([
      { type: 'text', text: 'SHARED STABLE CONTEXT', cache_control: { type: 'ephemeral' } },
      { type: 'text', text: 'REVIEWER-SPECIFIC PERSONA' }
    ]);
  });

  it('tracks cache_creation_input_tokens and cache_read_input_tokens in usage stats', async () => {
    const create = jest.fn<any>()
      .mockResolvedValueOnce(mockMessage('{}', 5000, 0)) // first call writes the cache
      .mockResolvedValueOnce(mockMessage('{}', 0, 5000)); // second call reads it
    const gateway = createGateway(create);

    await gateway.call('one', { model: 'claude-haiku-4-5-20251001', maxTokens: 1024, systemPrompt: [{ text: 'x', cache: true }] });
    await gateway.call('two', { model: 'claude-haiku-4-5-20251001', maxTokens: 1024, systemPrompt: [{ text: 'x', cache: true }] });

    const usage = gateway.getUsageStats();
    expect(usage.cacheCreationInputTokens).toBe(5000);
    expect(usage.cacheReadInputTokens).toBe(5000);
    // Anthropic's `input_tokens` is ONLY the tokens after the last cache
    // breakpoint (500 + 500 = 1000 raw here); cache_creation/cache_read are
    // accounted separately and must be added back in for the true total:
    // total_input_tokens = cache_read + cache_creation + input_tokens.
    expect(usage.inputTokens).toBe(1000 + 5000 + 5000);
    expect(usage.byModel['claude-haiku-4-5-20251001'].cacheReadInputTokens).toBe(5000);
  });

  it('includes cache tokens in the per-call LLMResponse.usage, not just the cumulative gateway stats', async () => {
    const create = jest.fn<any>().mockResolvedValue(mockMessage('{}', 0, 8402));
    const gateway = createGateway(create);

    const response = await gateway.call('one', { model: 'claude-haiku-4-5-20251001', maxTokens: 1024, systemPrompt: [{ text: 'x', cache: true }] });

    // input_tokens alone (500) undercounts; cache_read_input_tokens (8402) must be added back in.
    expect(response.usage.inputTokens).toBe(500 + 8402);
    expect(response.usage.totalTokens).toBe(500 + 8402 + 100);
  });

  it('defaults cache token fields to 0 when the response has none (older/non-caching calls)', async () => {
    const create = jest.fn<any>().mockResolvedValue(mockMessage('{}'));
    const gateway = createGateway(create);

    await gateway.call('one', { model: 'claude-haiku-4-5-20251001', maxTokens: 1024, systemPrompt: 'plain' });

    const usage = gateway.getUsageStats();
    expect(usage.cacheCreationInputTokens).toBe(0);
    expect(usage.cacheReadInputTokens).toBe(0);
  });
});

describe('buildSharedReviewContext', () => {
  const episode = { id: 'ep-2', title: 'Group Work', scenes: [{ id: 's1' }] };
  const characters = [{ id: 'player', name: 'Nico' }, { id: 'jordan', name: 'Jordan' }];
  const world = { id: 'NEW_SCHOOL', name: 'New School' };

  it('produces byte-identical output regardless of call order/site (the cache-key guarantee)', () => {
    const fromCreativeDirector = buildSharedReviewContext({ episode, characters, world });
    const fromQaReviewer = buildSharedReviewContext({ episode, characters, world });
    const fromEthicsReviewer = buildSharedReviewContext({ world, episode, characters }); // different call-site arg order

    expect(fromCreativeDirector).toBe(fromQaReviewer);
    expect(fromCreativeDirector).toBe(fromEthicsReviewer);
  });

  it('defaults characters to an empty array when omitted (Creative Director historically had none)', () => {
    const withoutCharacters = buildSharedReviewContext({ episode, world });
    expect(withoutCharacters).toContain('CHARACTERS:\n[]');
  });

  it('changes byte-for-byte when the episode content changes (a revision must NOT share the old cache entry)', () => {
    const before = buildSharedReviewContext({ episode, characters, world });
    const after = buildSharedReviewContext({ episode: { ...episode, title: 'Revised Title' }, characters, world });
    expect(before).not.toBe(after);
  });
});
