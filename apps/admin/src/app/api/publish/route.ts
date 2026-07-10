import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getPool } from '@/lib/db';
import { publishEpisode } from '@/lib/publish';

/** POST publish — avoids Server Actions (breaks behind Codespaces port forwarding). */
export async function POST(request: Request) {
  const pool = getPool();
  if (!pool) {
    return NextResponse.json(
      { ok: false, message: 'DATABASE_URL is not configured for this admin instance — publishing is unavailable.' },
      { status: 503 }
    );
  }

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const { episodeId, episodeFolder, runFolder, worldId, episodeNumber } = body;
  if (!episodeId || !episodeFolder || !runFolder) {
    return NextResponse.json({ ok: false, message: 'Missing episodeId, episodeFolder, or runFolder.' }, { status: 400 });
  }

  try {
    const { publishedAt } = await publishEpisode(pool, episodeId);
    revalidatePath(`/runs/${episodeFolder}/${runFolder}`);
    if (worldId && episodeNumber) {
      revalidatePath(`/published/${worldId}/${episodeNumber}`);
    }
    return NextResponse.json({
      ok: true,
      message: `Published at ${new Date(publishedAt).toUTCString().replace(' GMT', ' UTC')}.`
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
