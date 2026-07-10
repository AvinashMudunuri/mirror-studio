/**
 * Publish workflow: agents approve (full review board, `finalStatus:
 * APPROVED`), then a human explicitly confirms here before the content is
 * exposed to any frontend. See docs/decisions/003-publish-scope-proposal.md.
 *
 * `episodes.content`/`metadata` are mutated by every pipeline run
 * (persist-episode.js) — publishing snapshots them into separate
 * `published_content`/`published_metadata`/`published_run_folder`/
 * `published_at` columns that ordinary runs never touch (persist-episode.js's
 * UPSERT doesn't list them), so a later re-run can never silently change
 * what's already live. A frontend should only ever read the `published_*`
 * columns, never `content` directly.
 */

import type { Pool } from 'pg';

export interface PublishabilityInput {
  status: string;
  metadata: { runFolder?: string | null; run?: { skippedReviewers?: string[] } } | null;
}

export interface EpisodeRow extends PublishabilityInput {
  id: string;
  episodeNumber: number;
  publishedAt: string | null;
  publishedRunFolder: string | null;
}

/**
 * Why an episode can't be published right now, or null if it can.
 *
 * `status === 'PUBLISHED'` also counts as "approved" — that's the status
 * this same action sets, so re-checking an already-published episode
 * (with no new run since) must not reject it as "not approved".
 *
 * A dev-mode run (`SKIP_REVIEWERS`) is never publishable even if
 * APPROVED — it skips exactly the reviewers most likely to catch real
 * issues (see docs/OPEN-QUESTIONS.md item 4), so it isn't full-board
 * evidence.
 */
export function reasonNotPublishable(row: PublishabilityInput | null): string | null {
  if (!row) return 'This episode has not been persisted to Postgres yet — run `npm run persist:run` first.';
  if (row.status !== 'APPROVED' && row.status !== 'PUBLISHED') {
    return `Latest run's status is ${row.status}, not APPROVED.`;
  }
  const skippedReviewers = row.metadata?.run?.skippedReviewers ?? [];
  if (skippedReviewers.length > 0) {
    return `Full review board required — reviewers skipped: ${skippedReviewers.join(', ')}.`;
  }
  return null;
}

export function isPublishable(row: PublishabilityInput | null): boolean {
  return reasonNotPublishable(row) === null;
}

/** The episode row (if persisted) for a world + episode number. */
export async function findEpisodeRow(pool: Pool, worldId: string, episodeNumber: number): Promise<EpisodeRow | null> {
  const result = await pool.query(
    `SELECT e.id, e.episode_number, e.status, e.metadata, e.published_at, e.published_run_folder
     FROM episodes e
     JOIN seasons s ON s.id = e.season_id
     WHERE s.world_id = $1 AND e.episode_number = $2`,
    [worldId, episodeNumber]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    episodeNumber: row.episode_number,
    status: row.status,
    metadata: row.metadata,
    publishedAt: row.published_at,
    publishedRunFolder: row.published_run_folder
  };
}

export interface PublishedEpisode {
  worldId: string;
  episodeNumber: number;
  title: string;
  synopsis: string;
  publishedAt: string;
  content: unknown;
}

/**
 * The durable published snapshot for a world + episode number — what a
 * frontend should actually fetch. Returns null if never published (or if
 * the episode doesn't exist at all), regardless of what the LATEST
 * pipeline run's status is.
 */
export async function getPublishedEpisode(pool: Pool, worldId: string, episodeNumber: number): Promise<PublishedEpisode | null> {
  const result = await pool.query(
    `SELECT e.title, e.synopsis, e.published_content, e.published_at
     FROM episodes e
     JOIN seasons s ON s.id = e.season_id
     WHERE s.world_id = $1 AND e.episode_number = $2 AND e.published_at IS NOT NULL`,
    [worldId, episodeNumber]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    worldId,
    episodeNumber,
    title: row.title,
    synopsis: row.synopsis,
    publishedAt: row.published_at,
    content: row.published_content
  };
}

/**
 * Snapshot the episode's CURRENT content/metadata as the durable published
 * version. Throws (never silently no-ops) if the episode isn't publishable
 * right now — re-checks server-side even though the UI should already have
 * hidden the button in that case.
 */
export async function publishEpisode(pool: Pool, episodeId: string): Promise<{ publishedAt: string }> {
  const result = await pool.query(
    `SELECT status, metadata FROM episodes WHERE id = $1`,
    [episodeId]
  );
  const row = result.rows[0];
  const reason = reasonNotPublishable(row ? { status: row.status, metadata: row.metadata } : null);
  if (reason) throw new Error(`Cannot publish: ${reason}`);

  const updated = await pool.query(
    `UPDATE episodes
     SET published_content = content,
         published_metadata = metadata,
         published_run_folder = metadata->>'runFolder',
         published_at = CURRENT_TIMESTAMP,
         status = 'PUBLISHED'
     WHERE id = $1
     RETURNING published_at`,
    [episodeId]
  );
  return { publishedAt: updated.rows[0].published_at };
}

/** One row per persisted episode — used to label run folders on the dashboard. */
export interface PublishedRunIndexEntry {
  worldId: string;
  episodeNumber: number;
  title: string;
  publishedRunFolder: string | null;
  publishedAt: string | null;
  /** Latest persisted content (`episodes.metadata.runFolder`), may differ from published. */
  contentRunFolder: string | null;
}

/**
 * Map of repo-relative run folder path → publish state for dashboard badges.
 * Only includes episodes that have been persisted to Postgres at least once.
 */
export async function listPublishedRunIndex(pool: Pool): Promise<PublishedRunIndexEntry[]> {
  const result = await pool.query(
    `SELECT s.world_id, e.episode_number, e.title, e.published_run_folder, e.published_at,
            e.metadata->>'runFolder' AS content_run_folder
     FROM episodes e
     JOIN seasons s ON s.id = e.season_id
     ORDER BY e.episode_number ASC`
  );
  return result.rows.map(row => ({
    worldId: row.world_id,
    episodeNumber: row.episode_number,
    title: row.title,
    publishedRunFolder: row.published_run_folder,
    publishedAt: row.published_at,
    contentRunFolder: row.content_run_folder
  }));
}

export type RunPublishLabel = 'live' | 'latest' | 'not_published';

export type RunListFilter = 'published' | 'current' | 'all';

const RUN_LIST_FILTERS: RunListFilter[] = ['published', 'current', 'all'];

/** Default dashboard filter — show only LIVE runs on the player. */
export function parseRunListFilter(value: string | undefined): RunListFilter {
  if (value && RUN_LIST_FILTERS.includes(value as RunListFilter)) return value as RunListFilter;
  return 'published';
}

/** How this run folder relates to what the player serves (if Postgres is configured). */
export function publishLabelForRun(
  runPath: string,
  index: PublishedRunIndexEntry[]
): RunPublishLabel {
  if (index.some(e => e.publishedRunFolder === runPath)) return 'live';
  if (index.some(e => e.contentRunFolder === runPath)) return 'latest';
  return 'not_published';
}

export function matchesRunListFilter(
  label: RunPublishLabel | null,
  filter: RunListFilter,
  hasDatabase: boolean
): boolean {
  if (filter === 'all' || !hasDatabase) return true;
  if (!label) return false;
  if (filter === 'published') return label === 'live';
  return label === 'live' || label === 'latest';
}
