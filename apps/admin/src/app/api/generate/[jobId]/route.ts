import { NextResponse } from 'next/server';
import { getJob, cancelJob } from '@/lib/generation-jobs';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: 'Unknown job id.' }, { status: 404 });

  return NextResponse.json({
    id: job.id,
    status: job.status,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    exitCode: job.exitCode,
    runFolderHint: job.runFolderHint,
    input: job.input,
    log: job.log
  });
}

/** Cancel a running job (kills the child process). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const cancelled = cancelJob(jobId);
  if (!cancelled) {
    return NextResponse.json({ error: 'Job is not running (already finished, or unknown id).' }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
