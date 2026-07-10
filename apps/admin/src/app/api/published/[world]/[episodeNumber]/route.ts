import { NextResponse } from 'next/server';
import { projectPlayerEpisode } from '@mirror/schemas';
import { getPool } from '@/lib/db';
import { getPublishedEpisode } from '@/lib/publish';

/**
 * The read path a frontend actually consumes
 * (docs/decisions/003-publish-scope-proposal.md): only ever returns the
 * durable `published_*` snapshot, never the latest (possibly unapproved,
 * possibly mid-revision) pipeline content. 404 until a human has
 * explicitly published this episode at least once.
 *
 * `?format=player` returns the trimmed player graph instead of the raw
 * authoring shape — the contract Phase 5 should build against.
 */
export async function GET(
  request: Request,
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

  const format = new URL(request.url).searchParams.get('format');
  if (format === 'player') {
    try {
      const player = projectPlayerEpisode(published.content as any);
      return NextResponse.json({
        worldId: published.worldId,
        episodeNumber: published.episodeNumber,
        title: published.title,
        synopsis: published.synopsis,
        publishedAt: published.publishedAt,
        player
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to project player episode';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json(published);
}
