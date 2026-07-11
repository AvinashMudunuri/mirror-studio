import { NextResponse } from 'next/server';
import type { PlayerProgressPayload } from '@mirror/schemas';
import { getPool } from '@/lib/db';
import { getEpisodeDbId, loadEpisodeProgress, saveEpisodeProgress } from '@/lib/player-progress';
import { ensurePlayer, getPlayerIdFromCookie } from '@/lib/player-session';

export async function GET(request: Request) {
  const pool = getPool();
  if (!pool) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  }

  const playerId = await getPlayerIdFromCookie();
  if (!playerId) {
    return NextResponse.json({ error: 'No player session' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const world = searchParams.get('world');
  const episodeNumber = parseInt(searchParams.get('episodeNumber') || '', 10);
  if (!world || !Number.isFinite(episodeNumber)) {
    return NextResponse.json({ error: 'Missing world or episodeNumber' }, { status: 400 });
  }

  await ensurePlayer(pool, playerId);
  const episodeId = await getEpisodeDbId(pool, world, episodeNumber);
  if (!episodeId) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }

  const progress = await loadEpisodeProgress(pool, playerId, episodeId);
  return NextResponse.json({ progress: progress?.payload ?? null });
}

export async function POST(request: Request) {
  const pool = getPool();
  if (!pool) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  }

  const playerId = await getPlayerIdFromCookie();
  if (!playerId) {
    return NextResponse.json({ error: 'No player session' }, { status: 401 });
  }

  let body: { world: string; episodeNumber: number; progress: PlayerProgressPayload };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { world, episodeNumber, progress } = body;
  if (!world || !Number.isFinite(episodeNumber) || !progress?.status) {
    return NextResponse.json({ error: 'Missing world, episodeNumber, or progress' }, { status: 400 });
  }

  await ensurePlayer(pool, playerId);
  const episodeId = await getEpisodeDbId(pool, world, episodeNumber);
  if (!episodeId) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }

  await saveEpisodeProgress(pool, playerId, episodeId, progress);
  return NextResponse.json({ ok: true });
}
