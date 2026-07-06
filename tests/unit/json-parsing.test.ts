/**
 * Shared LLM JSON-parsing tests (packages/agents/src/json-parsing.ts).
 *
 * This module replaced 8 near-identical per-agent copies of the
 * extract → clean → repair → parse pipeline. The envelope-tolerance bugs
 * that shipped twice (Story Architect, Dialogue Writer) were both in
 * duplicated copies of this logic.
 */

import { describe, it, expect } from '@jest/globals';
import {
  extractJsonBlock,
  cleanJsonString,
  parseLlmJson,
  parseReviewJson,
  ReviewParseError
} from '@mirror/agents';

describe('extractJsonBlock', () => {
  it('prefers a fenced json code block', () => {
    const content = 'Sure! Here is the result:\n```json\n{"a": 1}\n```\nDone.';
    expect(extractJsonBlock(content)).toBe('{"a": 1}');
  });

  it('falls back to a bare object', () => {
    expect(extractJsonBlock('prefix {"a": 1} suffix')).toBe('{"a": 1}');
  });

  it('matches top-level arrays only when allowed', () => {
    const content = '```json\n[{"sceneId": "s1"}]\n```';
    expect(extractJsonBlock(content, true)).toBe('[{"sceneId": "s1"}]');
    // Without allowArray, the object fallback finds the inner object
    // (historical behavior of the per-agent regexes).
    expect(extractJsonBlock(content, false)).toBe('{"sceneId": "s1"}');
  });

  it('returns undefined when there is no JSON', () => {
    expect(extractJsonBlock('no json here')).toBeUndefined();
  });
});

describe('cleanJsonString', () => {
  it('strips trailing commas and comments', () => {
    const dirty = '{\n  "a": 1, // comment\n  /* block */ "b": [1, 2,],\n}';
    expect(JSON.parse(cleanJsonString(dirty))).toEqual({ a: 1, b: [1, 2] });
  });
});

describe('parseLlmJson', () => {
  it('parses a fenced response end to end', () => {
    const result = parseLlmJson('```json\n{"status": "PASS"}\n```', { context: 'Test' });
    expect(result).toEqual({ status: 'PASS' });
  });

  it('repairs malformed JSON (unquoted keys, trailing commas)', () => {
    const result = parseLlmJson("{status: 'PASS', errors: [],}", { context: 'Test' });
    expect(result).toEqual({ status: 'PASS', errors: [] });
  });

  it('parses bare arrays when allowArray is set', () => {
    const result = parseLlmJson('[{"sceneId": "s1", "lines": []}]', { context: 'Test', allowArray: true });
    expect(result).toEqual([{ sceneId: 's1', lines: [] }]);
  });

  it('throws on empty responses', () => {
    expect(() => parseLlmJson('', { context: 'Test' })).toThrow(/Empty response/);
  });

  it('throws when no JSON block is present', () => {
    expect(() => parseLlmJson('sorry, I cannot do that', { context: 'Test' })).toThrow(/no JSON block found/);
  });
});

describe('parseReviewJson', () => {
  it('returns the parsed review on success', () => {
    expect(parseReviewJson('QA_REVIEWER', '{"status": "PASS"}')).toEqual({ status: 'PASS' });
  });

  it('wraps failures in ReviewParseError with agent id and raw response', () => {
    let caught: unknown;
    try {
      parseReviewJson('QA_REVIEWER', 'not json at all');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ReviewParseError);
    expect((caught as ReviewParseError).agentId).toBe('QA_REVIEWER');
    expect((caught as ReviewParseError).rawResponse).toBe('not json at all');
  });
});
