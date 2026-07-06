/**
 * Episode persistence — writes a run's final episode into Postgres.
 *
 * Model: the filesystem run folder stays the source of truth and full
 * history; the episodes table holds the LATEST content per
 * (season, episode_number), with run metadata (folder, verdicts, usage)
 * in the metadata column. Zero LLM calls.
 */

'use strict';

const STATUS_BY_FINAL = {
  APPROVED: 'APPROVED',
  NEEDS_HUMAN_REVIEW: 'IN_REVIEW',
  BUDGET_EXCEEDED: 'DRAFT'
};

/** Map a run's finalStatus to the episodes.status enum. */
function episodeStatus(finalStatus) {
  return STATUS_BY_FINAL[finalStatus] || 'DRAFT';
}

/**
 * Build the episode row from run artifacts.
 * Pure — covered by unit tests.
 */
function buildEpisodeRow({ outline, cast, dialogueResult, manifest, runFolder }) {
  if (!manifest?.episode) {
    throw new Error('Run has no manifest.episode — refusing to persist an unfinished run');
  }
  return {
    worldId: manifest.episode.world,
    episodeNumber: manifest.episode.number,
    title: outline.title,
    synopsis: outline.synopsis || '',
    status: episodeStatus(manifest.finalStatus),
    content: {
      outline,
      cast,
      dialogue: dialogueResult.dialogue || [],
      choiceDialogue: dialogueResult.choiceDialogue || [],
      branchDialogue: dialogueResult.branchDialogue || []
    },
    metadata: {
      runFolder: runFolder || null,
      finalStatus: manifest.finalStatus || null,
      verdicts: manifest.verdicts || {},
      run: manifest.run || {},
      roster: manifest.roster || []
    }
  };
}

/**
 * Upsert the episode into Postgres. Creates the season on first use
 * (season_number 1 of the run's world). Returns the episode UUID.
 *
 * @param {import('pg').Pool | import('pg').Client} client - connected pg client/pool
 */
async function persistEpisode(client, row) {
  // Resolve (or create) season 1 of the world. Runs carry a world id but
  // no season id; the schema seeds season 1 for NEW_SCHOOL.
  const season = await client.query(
    `INSERT INTO seasons (world_id, season_number, title)
     VALUES ($1, 1, 'Season 1')
     ON CONFLICT (world_id, season_number) DO UPDATE SET world_id = EXCLUDED.world_id
     RETURNING id`,
    [row.worldId]
  );
  const seasonId = season.rows[0].id;

  const episode = await client.query(
    `INSERT INTO episodes (season_id, episode_number, title, synopsis, content, status, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (season_id, episode_number)
     DO UPDATE SET
       title = EXCLUDED.title,
       synopsis = EXCLUDED.synopsis,
       content = EXCLUDED.content,
       status = EXCLUDED.status,
       metadata = EXCLUDED.metadata
     RETURNING id`,
    [
      seasonId,
      row.episodeNumber,
      row.title,
      row.synopsis,
      JSON.stringify(row.content),
      row.status,
      JSON.stringify(row.metadata)
    ]
  );

  return { episodeId: episode.rows[0].id, seasonId, status: row.status };
}

module.exports = { episodeStatus, buildEpisodeRow, persistEpisode };
