import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getPublishedEpisode } from '@/lib/publish';

/**
 * The read path a frontend actually consumes
 * (docs/decisions/003-publish-scope-proposal.md): only ever returns the
 * durable `published_*` snapshot, never the latest (possibly unapproved,
 * possibly mid-revision) pipeline content. 404 until a human has
 * explicitly published this episode at least once.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ world: string; episodeNumber: string }> }
) {
  const { world, episodeNumber } = await params;
  const pool = getPool();
  if (!pool) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured for this admin instance' }, { status: 503 });
  }

  const num = parseInt(episodeNumber, 10);
  if (!Number.isFinite(num)) {
    return NextResponse.json({ error: 'Invalid episode number' }, { status: 400 });
  }

  const published = await getPublishedEpisode(pool, world, num);
  if (!published) {
    return NextResponse.json({ error: 'This episode has not been published' }, { status: 404 });
  }

  return NextResponse.json(published);
}
