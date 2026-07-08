import { NextResponse } from 'next/server';
import {
  startGenerationJob,
  getRunningJob,
  listJobs,
  JobAlreadyRunningError,
  type GenerateJobInput
} from '@/lib/generation-jobs';

export const runtime = 'nodejs';

function serializeJob(job: ReturnType<typeof listJobs>[number]) {
  return {
    id: job.id,
    status: job.status,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    exitCode: job.exitCode,
    runFolderHint: job.runFolderHint,
    input: job.input
  };
}

/** Recent jobs (this admin server instance's lifetime only) — lets the page show "already running" state on load/refresh. */
export async function GET() {
  return NextResponse.json({
    running: getRunningJob() ? serializeJob(getRunningJob()!) : null,
    jobs: listJobs().slice(0, 20).map(serializeJob)
  });
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string' && v.length > 0);
}

/** Validates the untrusted request body into a well-typed GenerateJobInput, or throws a descriptive Error. */
function parseInput(body: any): GenerateJobInput {
  const episodeNumber = Number(body?.episodeNumber);
  if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
    throw new Error('episodeNumber must be a positive integer.');
  }

  const input: GenerateJobInput = { episodeNumber };

  if (body.brief !== undefined && body.brief !== null) {
    const b = body.brief;
    const required = ['world', 'worldId', 'season', 'title', 'synopsis'];
    const missing = required.filter(key => !b?.[key]);
    if (missing.length > 0) {
      throw new Error(`Brief is missing required field(s): ${missing.join(', ')}`);
    }
    if (!isNonEmptyStringArray(b.themes)) throw new Error('Brief themes must be a non-empty list.');
    if (!isNonEmptyStringArray(b.targetTraits)) throw new Error('Brief targetTraits must be a non-empty list.');
    input.brief = {
      world: String(b.world),
      worldId: String(b.worldId),
      season: String(b.season),
      title: String(b.title),
      themes: b.themes,
      targetTraits: b.targetTraits,
      synopsis: String(b.synopsis)
    };
  }

  if (body.maxRunTokens !== undefined && body.maxRunTokens !== '') {
    const n = Number(body.maxRunTokens);
    if (!Number.isInteger(n) || n < 0) throw new Error('maxRunTokens must be a non-negative integer (0 = unlimited).');
    input.maxRunTokens = n;
  }
  if (body.maxRevisionIterations !== undefined && body.maxRevisionIterations !== '') {
    const n = Number(body.maxRevisionIterations);
    if (!Number.isInteger(n) || n < 0) throw new Error('maxRevisionIterations must be a non-negative integer.');
    input.maxRevisionIterations = n;
  }
  if (body.skipReviewers !== undefined) {
    if (!Array.isArray(body.skipReviewers)) throw new Error('skipReviewers must be a list.');
    input.skipReviewers = body.skipReviewers;
  }
  if (body.reviewerModelOverrides !== undefined && body.reviewerModelOverrides !== null) {
    if (typeof body.reviewerModelOverrides !== 'object') throw new Error('reviewerModelOverrides must be an object.');
    const overrides: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.reviewerModelOverrides)) {
      if (typeof v === 'string' && v.trim()) overrides[k] = v.trim();
    }
    input.reviewerModelOverrides = overrides;
  }

  return input;
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  let input: GenerateJobInput;
  try {
    input = parseInput(body);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }

  try {
    const job = startGenerationJob(input);
    return NextResponse.json(serializeJob(job), { status: 201 });
  } catch (error) {
    if (error instanceof JobAlreadyRunningError) {
      return NextResponse.json({ error: error.message, jobId: error.jobId }, { status: 409 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
