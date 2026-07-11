import type { PlayerProgressPayload } from '@mirror/schemas';
import type { Pool } from 'pg';

export interface EpisodeProgressRow {
  episodeId: string;
  payload: PlayerProgressPayload;
  completedAt: string | null;
}

export async function getEpisodeDbId(
  pool: Pool,
  worldId: string,
  episodeNumber: number
): Promise<string | null> {
  const result = await pool.query(
    `SELECT e.id FROM episodes e
     JOIN seasons s ON s.id = e.season_id
     WHERE s.world_id = $1 AND e.episode_number = $2 AND e.published_at IS NOT NULL`,
    [worldId, episodeNumber]
  );
  return result.rows[0]?.id ?? null;
}

export async function loadEpisodeProgress(
  pool: Pool,
  playerId: string,
  episodeId: string
): Promise<EpisodeProgressRow | null> {
  const result = await pool.query(
    `SELECT episode_id, choices, completed_at FROM player_progress
     WHERE player_id = $1 AND episode_id = $2`,
    [playerId, episodeId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    episodeId: row.episode_id,
    payload: row.choices as PlayerProgressPayload,
    completedAt: row.completed_at
  };
}

export async function saveEpisodeProgress(
  pool: Pool,
  playerId: string,
  episodeId: string,
  payload: PlayerProgressPayload
): Promise<void> {
  const completedAt =
    payload.status === 'completed' ? payload.completedAt ?? new Date().toISOString() : null;
  await pool.query(
    `INSERT INTO player_progress (player_id, episode_id, choices, completed_at, play_time_seconds)
     VALUES ($1, $2, $3::jsonb, $4, $5)
     ON CONFLICT (player_id, episode_id) DO UPDATE SET
       choices = EXCLUDED.choices,
       completed_at = EXCLUDED.completed_at,
       play_time_seconds = EXCLUDED.play_time_seconds`,
    [playerId, episodeId, JSON.stringify(payload), completedAt, payload.playTimeSeconds ?? null]
  );
}

export interface PlayerEpisodeStatus {
  worldId: string;
  episodeNumber: number;
  status: 'not_started' | 'in_progress' | 'completed';
}

/** Progress for all published episodes for one anonymous player. */
export async function listPlayerEpisodeStatuses(
  pool: Pool,
  playerId: string
): Promise<PlayerEpisodeStatus[]> {
  const result = await pool.query(
    `SELECT s.world_id, e.episode_number, pp.choices, pp.completed_at
     FROM episodes e
     JOIN seasons s ON s.id = e.season_id
     LEFT JOIN player_progress pp ON pp.episode_id = e.id AND pp.player_id = $1
     WHERE e.published_at IS NOT NULL
     ORDER BY s.world_id, e.episode_number`,
    [playerId]
  );
  return result.rows.map(row => {
    let status: PlayerEpisodeStatus['status'] = 'not_started';
    if (row.completed_at) {
      status = 'completed';
    } else if (row.choices) {
      const payload = row.choices as PlayerProgressPayload;
      status = payload.status === 'completed' ? 'completed' : 'in_progress';
    }
    return {
      worldId: row.world_id,
      episodeNumber: row.episode_number,
      status
    };
  });
}
