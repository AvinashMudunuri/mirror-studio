/**
 * Unit tests for the admin "generate episode" job registry
 * (apps/admin/src/lib/generation-jobs.ts) — the pipeline-spawning half of
 * the admin phase 2 "generate from UI" feature (docs/ROADMAP.md).
 *
 * `child_process.spawn` is mocked with a fake EventEmitter-based child —
 * no real process is spawned and no LLM calls are made.
 */

import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { EventEmitter } from 'events';

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  kill(signal?: string) {
    this.killed = true;
    // A real child emits 'exit' asynchronously after receiving the signal.
    process.nextTick(() => this.emit('exit', null, signal));
    return true;
  }
}

let lastFakeChild: FakeChildProcess;
const spawnMock = jest.fn<(...args: unknown[]) => FakeChildProcess>(() => {
  lastFakeChild = new FakeChildProcess();
  return lastFakeChild;
});

jest.mock('child_process', () => ({ spawn: (...args: unknown[]) => spawnMock(...args) }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  startGenerationJob,
  getJob,
  getRunningJob,
  listJobs,
  cancelJob,
  buildJobEnv,
  JobAlreadyRunningError
} = require('../../apps/admin/src/lib/generation-jobs');

function finishCurrentJob(exitCode = 0) {
  lastFakeChild?.emit('exit', exitCode);
}

afterEach(() => {
  // Jobs left "running" from a test would block the next test's
  // startGenerationJob() call (the one-at-a-time guardrail is real code
  // under test, not a test artifact to work around silently).
  finishCurrentJob(0);
  spawnMock.mockClear();
});

describe('buildJobEnv', () => {
  it('always sets EPISODE_NUMBER', () => {
    expect(buildJobEnv({ episodeNumber: 3 })).toEqual({ EPISODE_NUMBER: '3' });
  });

  it('serializes a custom brief into EPISODE_BRIEF_JSON', () => {
    const brief = { world: 'New School', worldId: 'NEW_SCHOOL', season: 'S1', title: 'X', themes: ['A'], targetTraits: ['CONFIDENCE'], synopsis: '...' };
    const env = buildJobEnv({ episodeNumber: 5, brief });
    expect(JSON.parse(env.EPISODE_BRIEF_JSON)).toEqual(brief);
  });

  it('omits EPISODE_BRIEF_JSON when no custom brief is given', () => {
    expect(buildJobEnv({ episodeNumber: 1 }).EPISODE_BRIEF_JSON).toBeUndefined();
  });

  it('maps budget/iteration/skip-reviewer knobs to their env var names', () => {
    const env = buildJobEnv({
      episodeNumber: 1,
      maxRunTokens: 500000,
      maxRevisionIterations: 5,
      skipReviewers: ['gameDesigner', 'ethicsReviewer']
    });
    expect(env.MAX_RUN_TOKENS).toBe('500000');
    expect(env.MAX_REVISION_ITERATIONS).toBe('5');
    expect(env.SKIP_REVIEWERS).toBe('gameDesigner,ethicsReviewer');
  });

  it('allows maxRunTokens: 0 (unlimited) to actually come through, not be dropped as falsy', () => {
    expect(buildJobEnv({ episodeNumber: 1, maxRunTokens: 0 }).MAX_RUN_TOKENS).toBe('0');
  });

  it('omits SKIP_REVIEWERS entirely when the list is empty (full board)', () => {
    expect(buildJobEnv({ episodeNumber: 1, skipReviewers: [] }).SKIP_REVIEWERS).toBeUndefined();
  });

  it('maps reviewer model overrides to their <AGENT>_MODEL env var names', () => {
    const env = buildJobEnv({
      episodeNumber: 1,
      reviewerModelOverrides: { QA_REVIEWER: 'claude-sonnet-5', GAME_DESIGNER: 'claude-sonnet-5' }
    });
    expect(env.QA_REVIEWER_MODEL).toBe('claude-sonnet-5');
    expect(env.GAME_DESIGNER_MODEL).toBe('claude-sonnet-5');
    expect(env.ETHICS_REVIEWER_MODEL).toBeUndefined();
  });

  it('ignores an unknown agent id in reviewerModelOverrides rather than fabricating an env var', () => {
    const env = buildJobEnv({ episodeNumber: 1, reviewerModelOverrides: { NOT_A_REAL_AGENT: 'claude-sonnet-5' } });
    expect(Object.keys(env)).toEqual(['EPISODE_NUMBER']);
  });
});

describe('startGenerationJob', () => {
  it('spawns the pipeline script with cwd two levels above process.cwd() (repo root, given next dev/start run from apps/admin) and the built env overlaid on process.env', () => {
    // NOT __dirname-based: once Next.js bundles this module, __dirname
    // points somewhere under .next/ with no fixed relationship to the
    // source file's depth — a relative "../../../.." from there resolved
    // to the wrong path at runtime (live-verified: spawned
    // ".next/scripts/create-real-episode.js", which doesn't exist, and
    // every real run failed immediately). process.cwd() is what next
    // dev/start actually sets to the app directory (apps/admin) — same
    // assumption episodesRoot() in lib/runs.ts already relies on.
    const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue('/fake-repo/apps/admin');

    const job = startGenerationJob({ episodeNumber: 2 });
    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [cmd, args, options] = spawnMock.mock.calls[0] as any[];
    expect(cmd).toBe('node');
    expect(args).toEqual(['scripts/create-real-episode.js']);
    expect(options.cwd).toBe('/fake-repo');
    expect(options.env.EPISODE_NUMBER).toBe('2');
    expect(options.env.PATH).toBe(process.env.PATH); // process.env is still the base layer
    expect(job.status).toBe('running');

    cwdSpy.mockRestore();
  });

  it('throws JobAlreadyRunningError when a job is already running', () => {
    startGenerationJob({ episodeNumber: 1 });
    expect(() => startGenerationJob({ episodeNumber: 2 })).toThrow(JobAlreadyRunningError);
  });

  it('buffers stdout/stderr into complete lines and emits them, holding back a partial trailing line', () => {
    const job = startGenerationJob({ episodeNumber: 1 });
    const seen: string[] = [];
    job.emitter.on('log', (line: string) => seen.push(line));

    lastFakeChild.stdout.emit('data', Buffer.from('first line\nsecond line\npartial-'));
    expect(seen).toEqual(['first line', 'second line']);
    expect(job.log).toEqual(['first line', 'second line']);

    lastFakeChild.stdout.emit('data', Buffer.from('tail\nthird line\n'));
    expect(seen).toEqual(['first line', 'second line', 'partial-tail', 'third line']);
  });

  it('extracts the run folder hint once the marker line and its path line both arrive', () => {
    const job = startGenerationJob({ episodeNumber: 1 });
    lastFakeChild.stdout.emit('data', Buffer.from('some preamble\n📁 Output folder for this run:\n   output/episodes/episode-01-first-day/run-2026-07-08_10-00-00\n\n'));
    expect(job.runFolderHint).toBe('output/episodes/episode-01-first-day/run-2026-07-08_10-00-00');
  });

  it('marks the job completed on a zero exit code and failed on a nonzero one', () => {
    const job = startGenerationJob({ episodeNumber: 1 });
    finishCurrentJob(0);
    expect(job.status).toBe('completed');
    expect(job.exitCode).toBe(0);
    expect(job.finishedAt).not.toBeNull();

    const job2 = startGenerationJob({ episodeNumber: 1 });
    finishCurrentJob(1);
    expect(job2.status).toBe('failed');
    expect(job2.exitCode).toBe(1);
  });

  it('flushes a trailing partial line on exit instead of dropping it', () => {
    const job = startGenerationJob({ episodeNumber: 1 });
    lastFakeChild.stdout.emit('data', Buffer.from('no trailing newline'));
    expect(job.log).toEqual([]); // still buffered, not yet a complete line
    finishCurrentJob(0);
    expect(job.log).toEqual(['no trailing newline']);
  });

  it('marks the job failed if the process fails to even start', () => {
    const job = startGenerationJob({ episodeNumber: 1 });
    lastFakeChild.emit('error', new Error('spawn ENOENT'));
    expect(job.status).toBe('failed');
    expect(job.log.some((l: string) => l.includes('spawn ENOENT'))).toBe(true);
  });
});

describe('cancelJob', () => {
  it('kills the running job and marks it cancelled, not failed, once the process exits', () => {
    const job = startGenerationJob({ episodeNumber: 1 });
    expect(cancelJob(job.id)).toBe(true);
    expect(job.status).toBe('cancelled');
    expect(lastFakeChild.killed).toBe(true);
  });

  it('returns false for a job that is not running', () => {
    const job = startGenerationJob({ episodeNumber: 1 });
    finishCurrentJob(0);
    expect(cancelJob(job.id)).toBe(false);
  });

  it('returns false for an unknown job id', () => {
    expect(cancelJob('nonexistent')).toBe(false);
  });
});

describe('getJob / getRunningJob / listJobs', () => {
  it('getRunningJob returns undefined when nothing is running', () => {
    expect(getRunningJob()).toBeUndefined();
  });

  it('getRunningJob finds the active job among finished ones', () => {
    const finished = startGenerationJob({ episodeNumber: 1 });
    finishCurrentJob(0);
    const running = startGenerationJob({ episodeNumber: 2 });
    expect(getRunningJob()?.id).toBe(running.id);
    expect(getJob(finished.id)?.status).toBe('completed');
  });

  it('listJobs returns newest first', () => {
    const first = startGenerationJob({ episodeNumber: 1 });
    finishCurrentJob(0);
    const second = startGenerationJob({ episodeNumber: 2 });
    const ids = listJobs().map((j: any) => j.id);
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
  });
});
