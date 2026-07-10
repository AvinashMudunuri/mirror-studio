/**
 * Season protagonist continuity guard.
 *
 * When generating episode 2+, the carried-over protagonist must match the
 * canonical episode-1 protagonist from the newest APPROVED run folder in
 * git (filesystem). Postgres is checked separately — stale ep-1 rows are
 * a common cause of wrong carry-over (see ADR 006).
 *
 * Override: SKIP_CONTINUITY_GUARD=1 (intentional anthology reset only).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { resolveFinalArtifacts } = require('./compile-screenplay');

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

function loadCastFromRunFolder(runDir) {
  const loadJson = relPath => {
    const filePath = path.join(runDir, relPath);
    if (!fs.existsSync(filePath)) return undefined;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  };
  const { cast } = resolveFinalArtifacts(loadJson, () => listRevisions(runDir));
  return cast;
}

/** Newest APPROVED run folder for an exact episode number, or null. */
function findApprovedRunForEpisode(episodesRoot, { worldId, episodeNumber }) {
  for (const runDir of listRunFolders(episodesRoot).reverse()) {
    const manifestPath = path.join(runDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch {
      continue;
    }
    if (
      manifest?.finalStatus === 'APPROVED' &&
      manifest?.episode?.world === worldId &&
      manifest?.episode?.number === episodeNumber
    ) {
      return runDir;
    }
  }
  return null;
}

function normalizeProtagonistName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

/**
 * Canonical season protagonist: player entry from newest APPROVED ep-1 run.
 */
function loadCanonicalEpisode1Protagonist({ episodesRoot, worldId }) {
  const runDir = findApprovedRunForEpisode(episodesRoot, { worldId, episodeNumber: 1 });
  if (!runDir) return null;
  const cast = loadCastFromRunFolder(runDir);
  const character = cast.find(c => c.id === 'player') || null;
  if (!character) return null;
  return {
    character,
    runFolder: path.join('output', 'episodes', path.relative(episodesRoot, runDir))
  };
}

async function loadPostgresProtagonistForEpisode(databaseUrl, { worldId, episodeNumber }) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query(
      `SELECT e.content, e.status, e.metadata
       FROM episodes e
       JOIN seasons s ON s.id = e.season_id
       WHERE s.world_id = $1 AND e.episode_number = $2
         AND e.status IN ('APPROVED', 'PUBLISHED')`,
      [worldId, episodeNumber]
    );
    const row = result.rows[0];
    if (!row) return null;
    const character = row.content?.cast?.find(c => c.id === 'player') || null;
    if (!character) return null;
    return {
      character,
      status: row.status,
      runFolder: row.metadata?.runFolder || null
    };
  } finally {
    await pool.end();
  }
}

/**
 * Verify carried-over protagonist matches canonical ep 1 before spending tokens.
 *
 * @returns {{ ok: boolean, warnings: string[], errors: string[] }}
 */
async function checkSeasonProtagonistContinuity({
  episodeNumber,
  worldId,
  episodesRoot,
  databaseUrl,
  carryOverProtagonist,
  carryOverSource
}) {
  const result = { ok: true, warnings: [], errors: [] };

  if (episodeNumber < 2) return result;
  if (process.env.SKIP_CONTINUITY_GUARD === '1') {
    result.warnings.push('SKIP_CONTINUITY_GUARD=1 — protagonist continuity guard disabled.');
    return result;
  }

  const canonical = loadCanonicalEpisode1Protagonist({ episodesRoot, worldId });
  if (!canonical?.character) {
    result.warnings.push(
      'No APPROVED episode-1 run folder found — cannot verify season protagonist continuity.'
    );
    return result;
  }

  const canonicalName = normalizeProtagonistName(canonical.character.name);

  if (databaseUrl) {
    try {
      const pgEp1 = await loadPostgresProtagonistForEpisode(databaseUrl, { worldId, episodeNumber: 1 });
      if (pgEp1?.character) {
        const pgName = normalizeProtagonistName(pgEp1.character.name);
        if (pgName !== canonicalName) {
          result.warnings.push(
            `Postgres episode 1 protagonist is "${pgEp1.character.name}" (${pgEp1.status}) ` +
            `but canonical run folder has "${canonical.character.name}" ` +
            `(${canonical.runFolder}). Run: npm run persist:run -- ${canonical.runFolder}`
          );
        }
      } else {
        result.warnings.push(
          `Episode 1 not persisted to Postgres — continuity will use ${carryOverSource || 'filesystem'} only. ` +
          `Run: npm run persist:run -- ${canonical.runFolder}`
        );
      }
    } catch (error) {
      result.warnings.push(`Could not read episode 1 from Postgres: ${error.message}`);
    }
  }

  if (!carryOverProtagonist) {
    result.warnings.push(
      `No protagonist to carry over for episode ${episodeNumber} — a new protagonist will be generated.`
    );
    return result;
  }

  const carryName = normalizeProtagonistName(carryOverProtagonist.name);
  if (carryName !== canonicalName) {
    result.ok = false;
    result.errors.push(
      `Protagonist continuity mismatch for episode ${episodeNumber}.`
    );
    result.errors.push(
      `  Carry-over (${carryOverSource || 'unknown'}): "${carryOverProtagonist.name}"`
    );
    result.errors.push(
      `  Canonical episode 1 (${canonical.runFolder}): "${canonical.character.name}"`
    );
    result.errors.push(
      '  Fix: npm run persist:run -- <canonical-ep-1-run-folder> then re-publish episode 1, or unset DATABASE_URL to use filesystem continuity.'
    );
    result.errors.push(
      '  Override (not recommended): SKIP_CONTINUITY_GUARD=1'
    );
  }

  return result;
}

function printContinuityGuardResult(guardResult) {
  for (const warning of guardResult.warnings) {
    console.warn(`   ⚠️  Continuity: ${warning}`);
  }
  if (!guardResult.ok) {
    console.error('\n❌ Protagonist continuity guard failed\n');
    for (const error of guardResult.errors) {
      console.error(`   ${error}`);
    }
    console.error('');
  }
}

module.exports = {
  normalizeProtagonistName,
  findApprovedRunForEpisode,
  loadCanonicalEpisode1Protagonist,
  loadPostgresProtagonistForEpisode,
  checkSeasonProtagonistContinuity,
  printContinuityGuardResult
};
