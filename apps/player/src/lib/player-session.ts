import { cookies } from 'next/headers';
import type { Pool } from 'pg';

export const PLAYER_COOKIE = 'mirror_player_id';

export async function getPlayerIdFromCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(PLAYER_COOKIE)?.value ?? null;
}

/** Ensure a players row exists for this anonymous cookie id. */
export async function ensurePlayer(pool: Pool, playerId: string): Promise<void> {
  await pool.query(
    `INSERT INTO players (id, metadata, last_active)
     VALUES ($1, '{"anonymous": true}'::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET last_active = CURRENT_TIMESTAMP`,
    [playerId]
  );
}
