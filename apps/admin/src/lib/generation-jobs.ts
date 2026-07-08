/**
 * In-memory registry for episode-generation jobs spawned from the admin
 * "generate" form (docs/ROADMAP.md "Admin phase 2").
 *
 * Deliberately NOT backed by Postgres or a file: the pipeline's run
 * folder (`output/episodes/.../manifest.json`) is already the durable
 * source of truth for a FINISHED run — this registry only exists to give
 * the browser a live console feed for a run IN PROGRESS. If the admin
 * server restarts mid-run, the console feed is lost, but a real full-board
 * run costs real tokens/time regardless — spawning it detached from the
 * server process's lifetime would just risk an orphaned process no UI can
 * see or cancel, worse than losing the live view.
 *
 * Only one job may run at a time (a deliberate guardrail, not a
 * technical limitation) — this pipeline spends real money per run, and a
 * human accidentally queuing several full-board runs in parallel is a
 * more likely failure mode than needing true concurrency.
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { EventEmitter } from 'events';

export type JobStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface CustomBrief {
  world: string;
  worldId: string;
  season: string;
  title: string;
  themes: string[];
  targetTraits: string[];
  synopsis: string;
}

export interface GenerateJobInput {
  episodeNumber: number;
  brief?: CustomBrief;
  maxRunTokens?: number;
  maxRevisionIterations?: number;
  skipReviewers?: string[];
  /** Per-agent model overrides, e.g. { QA_REVIEWER: 'claude-sonnet-5' } — see docs/OPEN-QUESTIONS.md item 4. */
  reviewerModelOverrides?: Record<string, string>;
}

export interface GenerationJob {
  id: string;
  input: GenerateJobInput;
  status: JobStatus;
  startedAt: number;
  finishedAt: number | null;
  exitCode: number | null;
  /** Buffered stdout/stderr lines so a client connecting late can replay from the start. */
  log: string[];
  /** Parsed from the script's own "📁 Output folder for this run:" line, once seen. */
  runFolderHint: string | null;
  emitter: EventEmitter;
}

interface RunningJob extends GenerationJob {
  child: ChildProcess;
}

const REVIEWER_ENV_KEYS: Record<string, string> = {
  QA_REVIEWER: 'QA_REVIEWER_MODEL',
  GAME_DESIGNER: 'GAME_DESIGNER_MODEL',
  ETHICS_REVIEWER: 'ETHICS_REVIEWER_MODEL',
  CHILD_PSYCHOLOGIST: 'CHILD_PSYCHOLOGIST_MODEL',
  CREATIVE_DIRECTOR: 'CREATIVE_DIRECTOR_MODEL'
};

/**
 * Pure — no process spawning — so it's unit-testable on its own. Builds
 * the env overlay for the spawned pipeline process from form input,
 * layered on top of (not replacing) the admin server's own `process.env`
 * (which is where ANTHROPIC_API_KEY/DATABASE_URL/etc. already live).
 */
export function buildJobEnv(input: GenerateJobInput): Record<string, string> {
  const env: Record<string, string> = {
    EPISODE_NUMBER: String(input.episodeNumber)
  };

  if (input.brief) {
    env.EPISODE_BRIEF_JSON = JSON.stringify(input.brief);
  }
  if (input.maxRunTokens !== undefined) {
    env.MAX_RUN_TOKENS = String(input.maxRunTokens);
  }
  if (input.maxRevisionIterations !== undefined) {
    env.MAX_REVISION_ITERATIONS = String(input.maxRevisionIterations);
  }
  if (input.skipReviewers && input.skipReviewers.length > 0) {
    env.SKIP_REVIEWERS = input.skipReviewers.join(',');
  }
  for (const [agentId, model] of Object.entries(input.reviewerModelOverrides ?? {})) {
    const envKey = REVIEWER_ENV_KEYS[agentId];
    if (envKey && model) env[envKey] = model;
  }

  return env;
}

const OUTPUT_FOLDER_MARKER = '📁 Output folder for this run:';

/** Extract the run folder path once the marker line + its path line have both arrived. */
function extractRunFolderHint(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(OUTPUT_FOLDER_MARKER)) {
      const next = lines[i + 1]?.trim();
      if (next) return next;
    }
  }
  return null;
}

const MAX_BUFFERED_LOG_LINES = 5000;

// Survive Next.js dev-mode HMR module reloads — a real module-level Map
// would otherwise be silently replaced (losing the running job reference)
// every time this file's module graph recompiles.
const globalRegistry = globalThis as unknown as { __mirrorGenerationJobs?: Map<string, GenerationJob> };
const registry: Map<string, GenerationJob> = globalRegistry.__mirrorGenerationJobs ?? new Map();
globalRegistry.__mirrorGenerationJobs = registry;

/**
 * Repo root. Deliberately based on `process.cwd()`, NOT `__dirname` — once
 * Next.js bundles this module, `__dirname` points somewhere under `.next/`
 * with no fixed relationship to the source file's depth, so a relative
 * `../../../..` from here is wrong at runtime even though it looks right
 * against the source tree (live-verified: this exact mistake pointed the
 * spawned command at a nonexistent `.next/scripts/create-real-episode.js`
 * and failed every run). `process.cwd()` for `next dev`/`next start` is
 * `apps/admin` — same assumption `episodesRoot()` in `lib/runs.ts` already
 * relies on.
 */
function repoRoot(): string {
  return path.resolve(process.cwd(), '..', '..');
}

export function getJob(id: string): GenerationJob | undefined {
  return registry.get(id);
}

/** The currently running job, if any — used to enforce the one-at-a-time guardrail. */
export function getRunningJob(): GenerationJob | undefined {
  return [...registry.values()].find(job => job.status === 'running');
}

export function listJobs(): GenerationJob[] {
  // Reversed insertion order, not sorted by startedAt: two jobs started
  // within the same millisecond (easily happens in tests, and plausible
  // in real usage too) must still come back newest-first deterministically.
  return [...registry.values()].reverse();
}

export class JobAlreadyRunningError extends Error {
  constructor(public readonly jobId: string) {
    super(`A generation run is already in progress (job ${jobId}) — wait for it to finish or cancel it first.`);
    this.name = 'JobAlreadyRunningError';
  }
}

/**
 * Spawn `scripts/create-real-episode.js` with the given input and start
 * tracking it. Throws JobAlreadyRunningError if one is already active
 * (see module doc — deliberate, not a technical limit).
 */
export function startGenerationJob(input: GenerateJobInput): GenerationJob {
  const existing = getRunningJob();
  if (existing) throw new JobAlreadyRunningError(existing.id);

  const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emitter = new EventEmitter();

  const child = spawn('node', ['scripts/create-real-episode.js'], {
    cwd: repoRoot(),
    env: { ...process.env, ...buildJobEnv(input) }
  });

  const job: RunningJob = {
    id,
    input,
    status: 'running',
    startedAt: Date.now(),
    finishedAt: null,
    exitCode: null,
    log: [],
    runFolderHint: null,
    emitter,
    child
  };
  registry.set(id, job);

  // Line-buffer stdout/stderr — chunks don't arrive line-aligned, and the
  // run-folder marker needs to be matched against a complete line.
  let pending = '';
  const onData = (chunk: Buffer) => {
    pending += chunk.toString('utf-8');
    const parts = pending.split('\n');
    pending = parts.pop() ?? '';
    if (parts.length === 0) return;

    job.log.push(...parts);
    if (job.log.length > MAX_BUFFERED_LOG_LINES) {
      job.log.splice(0, job.log.length - MAX_BUFFERED_LOG_LINES);
    }
    if (!job.runFolderHint) {
      job.runFolderHint = extractRunFolderHint(job.log);
    }
    for (const line of parts) emitter.emit('log', line);
  };
  child.stdout?.on('data', onData);
  child.stderr?.on('data', onData);

  child.on('exit', (code) => {
    if (pending) {
      job.log.push(pending);
      emitter.emit('log', pending);
      pending = '';
    }
    job.finishedAt = Date.now();
    job.exitCode = code;
    // A cancelled job is killed with SIGTERM — child.kill() below already
    // set status to 'cancelled' before this handler runs; don't overwrite it.
    if (job.status === 'running') {
      job.status = code === 0 ? 'completed' : 'failed';
    }
    emitter.emit('status', job.status);
  });

  child.on('error', (error) => {
    job.log.push(`[admin] Failed to start generation process: ${error.message}`);
    job.status = 'failed';
    job.finishedAt = Date.now();
    emitter.emit('log', job.log[job.log.length - 1]);
    emitter.emit('status', job.status);
  });

  return job;
}

/** Kill a running job's process. Returns false if the job isn't running (already finished, or unknown id). */
export function cancelJob(id: string): boolean {
  const job = registry.get(id) as RunningJob | undefined;
  if (!job || job.status !== 'running') return false;
  job.status = 'cancelled';
  job.log.push('[admin] Generation cancelled by user.');
  job.emitter.emit('log', job.log[job.log.length - 1]);
  job.child.kill('SIGTERM');
  return true;
}
