/**
 * Cross-run continuity: load the APPROVED episodes that precede a given
 * episode number in a world, for feeding into a new episode's brief
 * (Story Architect's `brief.previousEpisodes`) and review context
 * (Creative Director's `EpisodeReference[]`).
 *
 * Postgres (when `databaseUrl` is set) is authoritative — the `episodes`
 * table holds only the latest content per (season, episode_number), which
 * is exactly "what actually happened" in continuity terms. Falls back to
 * scanning committed run folders under `episodesRoot`, and degrades to
 * that fallback on any DB error: this is narrative context, not something
 * that should ever block a paid run (same philosophy as agent memory).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { resolveFinalArtifacts } = require('./compile-screenplay');

/** The {id, episodeNumber, title, synopsis, themes} shape both consumers need. */
function episodeReference(episodeNumber, outline) {
  return {
    id: `ep-${episodeNumber}`,
    episodeNumber,
    title: outline.title,
    synopsis: outline.synopsis || '',
    themes: outline.themes || []
  };
}

async function loadFromDatabase(databaseUrl, { worldId, beforeEpisodeNumber }) {
  // Required lazily so environments without `pg`/Postgres never pay for it
  // unless DATABASE_URL is actually set.
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query(
      `SELECT e.episode_number, e.title, e.synopsis, e.content
       FROM episodes e
       JOIN seasons s ON s.id = e.season_id
       WHERE s.world_id = $1 AND e.episode_number < $2 AND e.status = 'APPROVED'
       ORDER BY e.episode_number ASC`,
      [worldId, beforeEpisodeNumber]
    );
    return result.rows.map(row => ({
      id: `ep-${row.episode_number}`,
      episodeNumber: row.episode_number,
      title: row.title,
      synopsis: row.synopsis || '',
      themes: row.content?.outline?.themes || []
    }));
  } finally {
    await pool.end();
  }
}

/** Every run-* folder under episodesRoot, oldest first (run stamps are ISO-derived and sort lexically). */
function listRunFolders(episodesRoot) {
  if (!fs.existsSync(episodesRoot)) return [];
  const runs = [];
  for (const episodeDir of fs.readdirSync(episodesRoot)) {
    const episodePath = path.join(episodesRoot, episodeDir);
    if (!fs.statSync(episodePath).isDirectory()) continue;
    for (const runDir of fs.readdirSync(episodePath)) {
      if (runDir.startsWith('run-')) runs.push(path.join(episodePath, runDir));
    }
  }
  return runs.sort();
}

function listRevisions(runDir) {
  return fs.readdirSync(runDir)
    .filter(name => /^revision-\d+$/.test(name) && fs.statSync(path.join(runDir, name)).isDirectory())
    .sort((a, b) => parseInt(a.split('-')[1], 10) - parseInt(b.split('-')[1], 10));
}

function loadFromFilesystem(episodesRoot, { worldId, beforeEpisodeNumber }) {
  const byEpisodeNumber = new Map();
  // Newest run first, so the most recent APPROVED run for a given episode
  // number wins and older/superseded runs of the same episode are ignored.
  const runs = listRunFolders(episodesRoot).reverse();

  for (const runDir of runs) {
    const manifestPath = path.join(runDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue; // INCOMPLETE/crashed run folder — no manifest

    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch {
      continue; // corrupt manifest — never let continuity loading crash a run
    }

    const number = manifest?.episode?.number;
    if (
      manifest?.finalStatus !== 'APPROVED' ||
      manifest?.episode?.world !== worldId ||
      typeof number !== 'number' ||
      number >= beforeEpisodeNumber ||
      byEpisodeNumber.has(number)
    ) {
      continue;
    }

    const loadJson = relPath => {
      const filePath = path.join(runDir, relPath);
      if (!fs.existsSync(filePath)) return undefined;
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    };

    const { outline } = resolveFinalArtifacts(loadJson, () => listRevisions(runDir));
    byEpisodeNumber.set(number, episodeReference(number, outline));
  }

  return [...byEpisodeNumber.values()].sort((a, b) => a.episodeNumber - b.episodeNumber);
}

/**
 * @param {object} args
 * @param {string} [args.databaseUrl] - when set, tries Postgres first
 * @param {string} args.worldId
 * @param {number} args.beforeEpisodeNumber - only episodes strictly before this number are returned
 * @param {string} args.episodesRoot - path to output/episodes (filesystem fallback)
 * @returns {Promise<{episodes: Array<{id: string, episodeNumber: number, title: string, synopsis: string, themes: string[]}>, source: 'postgres' | 'filesystem'}>}
 */
async function loadPreviousEpisodes({ databaseUrl, worldId, beforeEpisodeNumber, episodesRoot }) {
  if (databaseUrl) {
    try {
      const episodes = await loadFromDatabase(databaseUrl, { worldId, beforeEpisodeNumber });
      return { episodes, source: 'postgres' };
    } catch (error) {
      console.warn(`   ⚠️ Loading previous episodes from Postgres failed (falling back to run folders): ${error.message}`);
    }
  }
  return { episodes: loadFromFilesystem(episodesRoot, { worldId, beforeEpisodeNumber }), source: 'filesystem' };
}

module.exports = { loadPreviousEpisodes, episodeReference };
