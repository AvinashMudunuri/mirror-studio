import { getJob } from '@/lib/generation-jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Server-Sent Events feed for one generation job's live console output.
 *
 * Replays everything buffered so far on connect (so refreshing the page,
 * or opening it late, doesn't lose earlier output), then streams new
 * lines as they arrive. Closes itself once the job finishes — the client
 * doesn't need to poll to find out.
 */
export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) {
    return new Response('Unknown job id.', { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | undefined;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const finish = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        job.emitter.off('log', onLog);
        job.emitter.off('status', onStatus);
        try {
          controller.close();
        } catch {
          // Already closed by the client aborting — nothing to do.
        }
      };

      function onLog(line: string) {
        send('log', line);
      }
      function onStatus(status: string) {
        send('status', { status, runFolderHint: job!.runFolderHint, exitCode: job!.exitCode });
        if (status !== 'running') {
          send('done', { status });
          finish();
        }
      }

      // Replay the buffer accumulated before this connection opened.
      for (const line of job.log) send('log', line);
      send('status', { status: job.status, runFolderHint: job.runFolderHint, exitCode: job.exitCode });

      if (job.status !== 'running') {
        send('done', { status: job.status });
        finish();
        return;
      }

      job.emitter.on('log', onLog);
      job.emitter.on('status', onStatus);

      // Keep intermediary proxies from timing out an idle-but-still-running connection.
      heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      }, 15000);

      request.signal.addEventListener('abort', finish);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  });
}
