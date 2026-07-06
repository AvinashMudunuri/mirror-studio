/**
 * Postgres persistence integration tests — REAL database required.
 *
 * Run with: TEST_DATABASE_URL=postgres://mirror:mirror_dev_password@localhost:5432/mirror_studio_test npm run test:integration
 * (database must have infrastructure/db/init/01-schema.sql applied)
 *
 * Skipped when TEST_DATABASE_URL is not set, so environments without
 * Postgres still pass the suite.
 *
 * Covers the two production defects fixed in the schema:
 * - agent_memory upsert crashed without a UNIQUE (agent_id, key) constraint
 * - the 3072-dim ivfflat index aborted schema init (pgvector caps at 2000)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool } from 'pg';
import { MemorySystem } from '@mirror/memory';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildEpisodeRow, persistEpisode, episodeStatus } = require('../../scripts/lib/persist-episode');

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeWithDb = TEST_DATABASE_URL ? describe : describe.skip;

// ---------- pure helpers (always run) ----------

describe('episodeStatus mapping', () => {
  it('maps run finalStatus to the episodes status enum', () => {
    expect(episodeStatus('APPROVED')).toBe('APPROVED');
    expect(episodeStatus('NEEDS_HUMAN_REVIEW')).toBe('IN_REVIEW');
    expect(episodeStatus('BUDGET_EXCEEDED')).toBe('DRAFT');
    expect(episodeStatus(undefined)).toBe('DRAFT');
  });
});

describe('buildEpisodeRow', () => {
  const artifacts = {
    outline: { title: 'First Bell', synopsis: 'A new school.', scenes: [] },
    cast: [{ id: 'player', name: 'Sam' }],
    dialogueResult: { dialogue: [], choiceDialogue: [], branchDialogue: [] },
    manifest: {
      episode: { number: 1, world: 'NEW_SCHOOL' },
      finalStatus: 'APPROVED',
      verdicts: { qaReviewer: 'PASS' },
      run: { workflowId: 'wf' },
      roster: [{ id: 'player', name: 'Sam', active: true }]
    },
    runFolder: 'output/episodes/e1/run-x'
  };

  it('builds a complete row with content and run metadata', () => {
    const row = buildEpisodeRow(artifacts);
    expect(row.worldId).toBe('NEW_SCHOOL');
    expect(row.episodeNumber).toBe(1);
    expect(row.status).toBe('APPROVED');
    expect(row.content.cast).toHaveLength(1);
    expect(row.metadata.runFolder).toBe('output/episodes/e1/run-x');
    expect(row.metadata.verdicts.qaReviewer).toBe('PASS');
  });

  it('refuses runs without a manifest (unfinished runs)', () => {
    expect(() => buildEpisodeRow({ ...artifacts, manifest: undefined })).toThrow(/unfinished run/);
  });
});

// ---------- real database (gated) ----------

describeWithDb('agent memory against real Postgres', () => {
  let memory: MemorySystem;

  beforeAll(() => {
    memory = new MemorySystem({ databaseUrl: TEST_DATABASE_URL! });
  });

  afterAll(async () => {
    await memory.close();
  });

  it('stores and retrieves a memory entry', async () => {
    const key = `test:roundtrip:${Date.now()}`;
    await memory.store({
      agentId: 'STORY_ARCHITECT',
      scope: 'AGENT_WORKING',
      key,
      value: { outline: 'v1' }
    });

    const value = await memory.retrieve('STORY_ARCHITECT', key);
    expect(value).toEqual({ outline: 'v1' });
  });

  it('upserts on (agent_id, key) — the constraint the original schema lacked', async () => {
    const key = 'test:upsert';
    await memory.store({ agentId: 'CEO', scope: 'AGENT_WORKING', key, value: { v: 1 } });
    await memory.store({ agentId: 'CEO', scope: 'AGENT_WORKING', key, value: { v: 2 } });

    const value = await memory.retrieve<{ v: number }>('CEO', key);
    expect(value).toEqual({ v: 2 });
  });

  it('scopes retrieval by agent', async () => {
    const key = 'test:scoping';
    await memory.store({ agentId: 'QA_REVIEWER', scope: 'AGENT_WORKING', key, value: { mine: true } });
    expect(await memory.retrieve('ETHICS_REVIEWER', key)).toBeNull();
  });

  it('honors expiration', async () => {
    const key = 'test:expired';
    await memory.store({
      agentId: 'CEO',
      scope: 'AGENT_WORKING',
      key,
      value: { stale: true },
      expiresAt: new Date(Date.now() - 1000)
    });
    expect(await memory.retrieve('CEO', key)).toBeNull();
  });
});

describeWithDb('episode persistence against real Postgres', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({ connectionString: TEST_DATABASE_URL! });
  });

  afterAll(async () => {
    await pool.end();
  });

  function row(overrides: Record<string, unknown> = {}) {
    return {
      worldId: 'NEW_SCHOOL',
      episodeNumber: 99, // avoid clashing with seeded data
      title: 'Integration Test Episode',
      synopsis: 'Persisted by tests.',
      status: 'APPROVED',
      content: { outline: { title: 'Integration Test Episode' }, cast: [], dialogue: [] },
      metadata: { runFolder: 'test-run', verdicts: { qaReviewer: 'PASS' } },
      ...overrides
    };
  }

  it('inserts an episode and returns its id', async () => {
    const result = await persistEpisode(pool, row());
    expect(result.episodeId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.status).toBe('APPROVED');

    const saved = await pool.query('SELECT title, status, metadata FROM episodes WHERE id = $1', [result.episodeId]);
    expect(saved.rows[0].title).toBe('Integration Test Episode');
    expect(saved.rows[0].status).toBe('APPROVED');
    expect(saved.rows[0].metadata.runFolder).toBe('test-run');
  });

  it('upserts on (season, episode_number): a re-run replaces the content', async () => {
    const first = await persistEpisode(pool, row({ title: 'V1' }));
    const second = await persistEpisode(pool, row({ title: 'V2', status: 'IN_REVIEW' }));

    expect(second.episodeId).toBe(first.episodeId);

    const saved = await pool.query('SELECT title, status FROM episodes WHERE id = $1', [first.episodeId]);
    expect(saved.rows[0].title).toBe('V2');
    expect(saved.rows[0].status).toBe('IN_REVIEW');
  });
});
