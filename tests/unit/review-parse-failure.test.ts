/**
 * Review parsing safety tests
 *
 * Validation/review agents must fail loudly (throw ReviewParseError) when an
 * LLM response cannot be parsed into a review, instead of fabricating a
 * default review with made-up scores. A fabricated review is indistinguishable
 * from a real one downstream, which is unacceptable for safety-critical
 * reviewers (Child Psychologist, Ethics Reviewer, QA).
 *
 * These tests exercise the parsing layer directly; no LLM calls are made.
 */

import { describe, it, expect } from '@jest/globals';
import {
  ChildPsychologistAgent,
  GameDesignerAgent,
  EthicsReviewerAgent,
  QAReviewerAgent,
  CreativeDirectorAgent,
  ReviewParseError
} from '@mirror/agents';

const NO_JSON_RESPONSE = 'I could not complete the review, sorry!';
const BROKEN_JSON_RESPONSE = '{ "status": "APPROVED", "scores": { unterminated';

describe('Child Psychologist parsing', () => {
  const agent = new ChildPsychologistAgent();
  const parse = (content: string) => agent['parseReview'](content);

  it('throws ReviewParseError when response contains no JSON', () => {
    expect(() => parse(NO_JSON_RESPONSE)).toThrow(ReviewParseError);
  });

  it('throws ReviewParseError when status is missing', () => {
    const response = JSON.stringify({
      scores: { ageAppropriateness: 8, emotionalSafety: 8, educationalValue: 8, mentalHealthRep: 8, overall: 8 }
    });
    expect(() => parse(response)).toThrow(ReviewParseError);
    expect(() => parse(response)).toThrow(/status/);
  });

  it('throws ReviewParseError when a score is missing instead of defaulting it', () => {
    const response = JSON.stringify({
      status: 'APPROVED',
      scores: { ageAppropriateness: 8, emotionalSafety: 8, educationalValue: 8, overall: 8 }
    });
    expect(() => parse(response)).toThrow(ReviewParseError);
    expect(() => parse(response)).toThrow(/mentalHealthRep/);
  });

  it('preserves a legitimate score of 0 (old `|| 5` fallback coerced it)', () => {
    const response = JSON.stringify({
      status: 'REJECTED',
      scores: { ageAppropriateness: 0, emotionalSafety: 0, educationalValue: 2, mentalHealthRep: 1, overall: 0 }
    });
    const result = parse(response);
    expect(result.scores.emotionalSafety).toBe(0);
    expect(result.scores.overall).toBe(0);
    expect(result.status).toBe('REJECTED');
  });

  it('parses a complete review and attaches the raw response to errors', () => {
    const response = JSON.stringify({
      status: 'APPROVED',
      concerns: [],
      scores: { ageAppropriateness: 9, emotionalSafety: 9, educationalValue: 8, mentalHealthRep: 9, overall: 9 },
      summary: { strengths: ['Positive role models'], improvements: [], readyForAudience: true }
    });
    const result = parse(response);
    expect(result.status).toBe('APPROVED');
    expect(result.summary.readyForAudience).toBe(true);

    try {
      parse(NO_JSON_RESPONSE);
      throw new Error('expected ReviewParseError');
    } catch (error) {
      expect(error).toBeInstanceOf(ReviewParseError);
      expect((error as ReviewParseError).rawResponse).toBe(NO_JSON_RESPONSE);
      expect((error as ReviewParseError).agentId).toBe('CHILD_PSYCHOLOGIST');
    }
  });
});

describe('Game Designer parsing', () => {
  const agent = new GameDesignerAgent();
  const parse = (content: string) => agent['parseReview'](content);

  it('throws ReviewParseError when response contains no JSON', () => {
    expect(() => parse(NO_JSON_RESPONSE)).toThrow(ReviewParseError);
  });

  it('throws ReviewParseError when scores are missing', () => {
    expect(() => parse(JSON.stringify({ status: 'GOOD' }))).toThrow(ReviewParseError);
  });

  it('parses a complete review', () => {
    const result = parse(JSON.stringify({
      status: 'GOOD',
      scores: { engagement: 7, choiceQuality: 8, pacing: 7, playerAgency: 8, replayability: 6, overall: 7 }
    }));
    expect(result.status).toBe('GOOD');
    expect(result.scores.overall).toBe(7);
  });
});

describe('Ethics Reviewer parsing', () => {
  const agent = new EthicsReviewerAgent();
  const parse = (content: string) => agent['parseReview'](content);

  it('throws ReviewParseError when response contains no JSON', () => {
    expect(() => parse(NO_JSON_RESPONSE)).toThrow(ReviewParseError);
  });

  it('throws ReviewParseError on invalid status enum instead of defaulting', () => {
    const response = JSON.stringify({
      status: 'FINE_I_GUESS',
      scores: { biasAvoidance: 8, representation: 8, tropes: 8, ethicalModeling: 8, culturalSensitivity: 8, overall: 8 }
    });
    expect(() => parse(response)).toThrow(ReviewParseError);
  });

  it('parses a complete review', () => {
    const result = parse(JSON.stringify({
      status: 'EXCELLENT',
      scores: { biasAvoidance: 9, representation: 9, tropes: 9, ethicalModeling: 9, culturalSensitivity: 9, overall: 9 }
    }));
    expect(result.status).toBe('EXCELLENT');
  });
});

describe('QA Reviewer parsing', () => {
  const agent = new QAReviewerAgent();
  const parse = (content: string) => agent['parseQAResponse'](content);

  it('throws ReviewParseError when response contains no JSON', () => {
    expect(() => parse(NO_JSON_RESPONSE)).toThrow(ReviewParseError);
  });

  it('throws ReviewParseError when status is missing instead of inferring PASS', () => {
    // Old behavior: missing status + empty errors array => silent PASS.
    expect(() => parse(JSON.stringify({ errors: [], warnings: [] }))).toThrow(ReviewParseError);
  });

  it('parses a complete review', () => {
    const result = parse(JSON.stringify({ status: 'PASS', errors: [], warnings: [] }));
    expect(result.status).toBe('PASS');
    expect(result.summary.failedChecks).toBe(0);
  });
});

describe('Creative Director parsing', () => {
  const agent = new CreativeDirectorAgent();
  const parse = (content: string) => agent['parseCreativeResponse'](content);

  it('throws ReviewParseError when response contains no JSON', () => {
    expect(() => parse(NO_JSON_RESPONSE)).toThrow(ReviewParseError);
  });

  it('throws ReviewParseError when decision is missing instead of defaulting', () => {
    expect(() => parse(JSON.stringify({ creativeNotes: 'Looks good' }))).toThrow(ReviewParseError);
  });

  it('parses a complete review', () => {
    const result = parse(JSON.stringify({ decision: 'APPROVED', creativeNotes: 'Strong episode' }));
    expect(result.decision).toBe('APPROVED');
  });
});

describe('jsonrepair still recovers malformed-but-salvageable JSON', () => {
  it('Child Psychologist repairs truncated JSON or throws, never fabricates', () => {
    const agent = new ChildPsychologistAgent();
    // jsonrepair may be able to close this object; either it produces a valid
    // review (which then fails score validation and throws) or parsing throws.
    expect(() => agent['parseReview'](BROKEN_JSON_RESPONSE)).toThrow(ReviewParseError);
  });
});

describe('orchestrator escalation end-to-end (create-real-episode.js runReviewers)', () => {
  // scripts/create-real-episode.js can't be required directly (it runs
  // main() as a module-load side effect), so this reproduces its exact
  // catch block against a REAL agent + REAL thrown ReviewParseError,
  // rather than only exercising the pure pipeline-helpers functions in
  // isolation. See tests/unit/pipeline-helpers.test.ts for the pure-logic
  // coverage of unreadableResult/failingReviewers this depends on.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { unreadableResult, failingReviewers } = require('../../scripts/lib/pipeline-helpers');

  async function runReviewerLikeThePipelineDoes(agent: any, input: any, verdictField: string) {
    try {
      return await agent.process(input);
    } catch (error) {
      if (!(error instanceof ReviewParseError)) throw error;
      return unreadableResult(verdictField, error);
    }
  }

  it('an unparseable QA response becomes an UNREADABLE verdict instead of crashing the run', async () => {
    const agent = new QAReviewerAgent();
    await agent.initialize({
      workflowId: 'wf', threadId: 'th',
      messageBus: { publish: async () => {}, subscribe: async () => {}, unsubscribe: async () => {} },
      memory: { store: async () => {}, retrieve: async () => null, search: async () => [] },
      llm: { call: async () => ({ content: NO_JSON_RESPONSE, model: 'claude-haiku-4-5-20251001', provider: 'claude', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, stopReason: 'end_turn' }) }
    } as any);

    const result = await runReviewerLikeThePipelineDoes(
      agent,
      { type: 'REVIEW_EPISODE', episodeReview: { episode: {} as any, characters: [], world: {} as any } },
      'status'
    );

    expect(result.status).toBe('UNREADABLE');
    expect(result.rawResponse).toBe(NO_JSON_RESPONSE);
    expect(failingReviewers({ qaReviewer: result })).toEqual(['qaReviewer']);
  });

  it('a normal, parseable response is unaffected by the escalation wrapper', async () => {
    const agent = new QAReviewerAgent();
    await agent.initialize({
      workflowId: 'wf', threadId: 'th',
      messageBus: { publish: async () => {}, subscribe: async () => {}, unsubscribe: async () => {} },
      memory: { store: async () => {}, retrieve: async () => null, search: async () => [] },
      llm: { call: async () => ({ content: JSON.stringify({ status: 'PASS', errors: [], warnings: [] }), model: 'claude-haiku-4-5-20251001', provider: 'claude', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, stopReason: 'end_turn' }) }
    } as any);

    const result = await runReviewerLikeThePipelineDoes(
      agent,
      { type: 'REVIEW_EPISODE', episodeReview: { episode: {} as any, characters: [], world: {} as any } },
      'status'
    );

    expect(result.status).toBe('PASS');
    expect(failingReviewers({ qaReviewer: result })).toEqual([]);
  });

  it('a non-parse error (e.g. a real bug or network failure) still propagates instead of being swallowed', async () => {
    const agent = new QAReviewerAgent();
    await agent.initialize({
      workflowId: 'wf', threadId: 'th',
      messageBus: { publish: async () => {}, subscribe: async () => {}, unsubscribe: async () => {} },
      memory: { store: async () => {}, retrieve: async () => null, search: async () => [] },
      llm: { call: async () => { throw new Error('connection reset'); } }
    } as any);

    await expect(
      runReviewerLikeThePipelineDoes(
        agent,
        { type: 'REVIEW_EPISODE', episodeReview: { episode: {} as any, characters: [], world: {} as any } },
        'status'
      )
    ).rejects.toThrow('connection reset');
  });
});
