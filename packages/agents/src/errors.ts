/**
 * Structured errors for agent output parsing.
 *
 * Validation/review agents must NEVER fabricate a review when the LLM
 * response cannot be parsed. A fabricated "default" review (e.g. all
 * scores = 5) is indistinguishable from a real one downstream, which is
 * unacceptable for safety-critical reviewers (Child Psychologist, Ethics
 * Reviewer, QA). Instead, parsing failures throw ReviewParseError so the
 * caller can retry, escalate, or halt the workflow.
 */

export class ReviewParseError extends Error {
  readonly agentId: string;
  /** The raw LLM response that could not be parsed, for debugging/retry. */
  readonly rawResponse: string;

  constructor(agentId: string, message: string, rawResponse: string) {
    super(`[${agentId}] ${message}`);
    this.name = 'ReviewParseError';
    this.agentId = agentId;
    this.rawResponse = rawResponse;
  }
}

/**
 * Assert that a parsed review field is one of the allowed enum values.
 * Throws ReviewParseError instead of silently substituting a default.
 */
export function requireEnum<T extends string>(
  agentId: string,
  rawResponse: string,
  field: string,
  value: unknown,
  allowed: readonly T[]
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ReviewParseError(
      agentId,
      `LLM review has missing or invalid "${field}": got ${JSON.stringify(value)}, expected one of [${allowed.join(', ')}]`,
      rawResponse
    );
  }
  return value as T;
}

/**
 * Assert that a parsed review score is a finite number.
 * Throws ReviewParseError instead of silently substituting a default score.
 */
export function requireScore(
  agentId: string,
  rawResponse: string,
  field: string,
  value: unknown
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ReviewParseError(
      agentId,
      `LLM review has missing or invalid numeric score "${field}": got ${JSON.stringify(value)}`,
      rawResponse
    );
  }
  return value;
}
