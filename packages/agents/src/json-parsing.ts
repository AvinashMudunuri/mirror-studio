/**
 * Shared LLM JSON-response parsing.
 *
 * Every agent used to carry its own copy of the same extract → clean →
 * repair → parse pipeline (8 near-identical implementations). Fixing the
 * same bug repeatedly in different copies (e.g. tolerating a bare array
 * where an envelope was expected) is how envelope bugs shipped twice —
 * this module is the single implementation.
 */

import { jsonrepair } from 'jsonrepair';
import { ReviewParseError } from './errors';

export interface ParseLlmJsonOptions {
  /** Label used in log lines, e.g. 'Story Architect'. */
  context: string;
  /** Also match a top-level JSON array (models sometimes drop the envelope). */
  allowArray?: boolean;
}

/**
 * Extract the JSON payload from an LLM response: prefers a fenced
 * ```json code block, falls back to the first brace/bracket span.
 * Returns undefined when no candidate is found.
 */
export function extractJsonBlock(content: string, allowArray = false): string | undefined {
  const open = allowArray ? '[\\{\\[]' : '\\{';
  const close = allowArray ? '[\\}\\]]' : '\\}';
  const fenced = content.match(new RegExp('```(?:json)?\\s*(' + open + '[\\s\\S]*' + close + ')\\s*```'));
  if (fenced) return fenced[1];
  const bare = content.match(new RegExp('(' + open + '[\\s\\S]*' + close + ')'));
  return bare?.[1];
}

/** Strip trailing commas, // and block comments, and surrounding whitespace. */
export function cleanJsonString(json: string): string {
  return json
    .replace(/,(\s*[}\]])/g, '$1')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
}

/** Human-readable context around a JSON.parse error position, for logs. */
export function getJsonErrorContext(json: string, error: unknown): string {
  const message = (error as Error)?.message || '';
  const posMatch = message.match(/position (\d+)/);
  if (!posMatch) return 'Could not extract error position';
  
  const pos = parseInt(posMatch[1], 10);
  const start = Math.max(0, pos - 100);
  const end = Math.min(json.length, pos + 100);
  const context = json.substring(start, end);
  const marker = ' '.repeat(Math.min(100, pos - start)) + '^';
  return `\n${context}\n${marker}`;
}

/**
 * Full pipeline: extract → clean → repair → parse.
 *
 * Throws a plain Error when no JSON block is found or the payload cannot
 * be parsed even after repair. Callers that need agent-attributed errors
 * (reviewers) should use parseReviewJson instead.
 */
export function parseLlmJson<T = any>(content: string, options: ParseLlmJsonOptions): T {
  const { context, allowArray = false } = options;
  
  if (!content || content.trim().length === 0) {
    throw new Error(`[${context}] Empty response from LLM`);
  }
  
  const extracted = extractJsonBlock(content, allowArray);
  if (!extracted) {
    console.error(`[${context}] No JSON found in response`);
    console.error('Response preview:', content.substring(0, 500));
    throw new Error('Failed to parse JSON from LLM response - no JSON block found');
  }
  
  let jsonString = cleanJsonString(extracted);
  
  try {
    jsonString = jsonrepair(jsonString);
  } catch (repairError) {
    console.warn(`[${context}] JSON repair failed:`, repairError);
    // Keep the cleaned string; native parse may still succeed.
  }
  
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error(`[${context}] Failed to parse JSON:`, error);
    console.error('JSON string length:', jsonString.length);
    console.error('JSON preview (first 500 chars):', jsonString.substring(0, 500));
    console.error('JSON preview (around error position):', getJsonErrorContext(jsonString, error));
    throw new Error(`Failed to parse LLM JSON response: ${error}`);
  }
}

/**
 * Reviewer variant: same pipeline, but failures throw ReviewParseError
 * carrying the agent id and the raw response, so a malformed review can
 * never be mistaken for (or fabricated into) a real verdict.
 */
export function parseReviewJson<T = any>(agentId: string, content: string): T {
  try {
    return parseLlmJson<T>(content, { context: agentId });
  } catch (error) {
    throw new ReviewParseError(
      agentId,
      error instanceof Error ? error.message : String(error),
      content
    );
  }
}
