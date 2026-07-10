import { projectPlayerEpisode, type PlayerEpisode } from '@mirror/schemas';
import type { Pool } from 'pg';

export interface PublishedPlayerEpisode {
  worldId: string;
  episodeNumber: number;
  title: string;
  synopsis: string;
  publishedAt: string;
  player: PlayerEpisode;
}

export interface PublishedPlayerEpisodeSummary {
  worldId: string;
  episodeNumber: number;
  title: string;
  synopsis: string;
  publishedAt: string;
}

/** All episodes with a durable published snapshot, ordered by world then episode number. */
export async function listPublishedPlayerEpisodes(pool: Pool): Promise<PublishedPlayerEpisodeSummary[]> {
  const result = await pool.query(
    `SELECT s.world_id, e.episode_number, e.title, e.synopsis, e.published_at
     FROM episodes e
     JOIN seasons s ON s.id = e.season_id
     WHERE e.published_at IS NOT NULL
     ORDER BY s.world_id ASC, e.episode_number ASC`
  );
  return result.rows.map(row => ({
    worldId: row.world_id,
    episodeNumber: row.episode_number,
    title: row.title,
    synopsis: row.synopsis,
    publishedAt: row.published_at
  }));
}

/** Fetch the durable published snapshot and project it for the player app. */
export async function getPublishedPlayerEpisode(
  pool: Pool,
  worldId: string,
  episodeNumber: number
): Promise<PublishedPlayerEpisode | null> {
  const result = await pool.query(
    `SELECT e.title, e.synopsis, e.published_content, e.published_at
     FROM episodes e
     JOIN seasons s ON s.id = e.season_id
     WHERE s.world_id = $1 AND e.episode_number = $2 AND e.published_at IS NOT NULL`,
    [worldId, episodeNumber]
  );
  const row = result.rows[0];
  if (!row) return null;

  const player = projectPlayerEpisode(row.published_content);
  return {
    worldId,
    episodeNumber,
    title: row.title,
    synopsis: row.synopsis,
    publishedAt: row.published_at,
    player
  };
}
