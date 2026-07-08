'use server';

import { revalidatePath } from 'next/cache';
import { getPool } from '@/lib/db';
import { publishEpisode } from '@/lib/publish';

export interface PublishActionResult {
  ok: boolean;
  message: string;
}

/**
 * Publish an episode's CURRENT Postgres content as the durable published
 * snapshot. Re-validates publishability server-side (the button that
 * triggers this should already be hidden otherwise, but never trust the
 * client alone for a write).
 */
export async function publishEpisodeAction(episodeId: string, episodeFolder: string, runFolder: string): Promise<PublishActionResult> {
  const pool = getPool();
  if (!pool) {
    return { ok: false, message: 'DATABASE_URL is not configured for this admin instance — publishing is unavailable.' };
  }

  try {
    const { publishedAt } = await publishEpisode(pool, episodeId);
    revalidatePath(`/runs/${episodeFolder}/${runFolder}`);
    return { ok: true, message: `Published at ${new Date(publishedAt).toUTCString().replace(' GMT', ' UTC')}.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
