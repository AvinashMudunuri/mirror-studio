#!/usr/bin/env node

/**
 * Persist a run folder's final episode into Postgres.
 *
 * The filesystem run folder remains the source of truth; Postgres holds the
 * latest content per (season, episode_number) for querying/serving. Zero
 * LLM calls, so committed runs can be backfilled for free.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/persist-run.js <run-folder>
 *   DATABASE_URL=postgres://... node scripts/persist-run.js   (latest run)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { resolveFinalArtifacts } = require('./lib/compile-screenplay');
const { buildEpisodeRow, persistEpisode } = require('./lib/persist-episode');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set.');
  console.error('   Local dev (docker-compose): postgres://mirror:mirror_dev_password@localhost:5432/mirror_studio');
  process.exit(1);
}

function latestRunFolder() {
  const episodesRoot = path.join(__dirname, '..', 'output', 'episodes');
  const runs = [];
  for (const episode of fs.existsSync(episodesRoot) ? fs.readdirSync(episodesRoot) : []) {
    const episodeDir = path.join(episodesRoot, episode);
    if (!fs.statSync(episodeDir).isDirectory()) continue;
    for (const run of fs.readdirSync(episodeDir)) {
      if (run.startsWith('run-')) runs.push(path.join(episodeDir, run));
    }
  }
  runs.sort();
  return runs[runs.length - 1];
}

async function main() {
  const runDir = process.argv[2] ? path.resolve(process.argv[2]) : latestRunFolder();
  if (!runDir || !fs.existsSync(runDir)) {
    console.error('❌ Run folder not found.' + (runDir ? ` Tried: ${runDir}` : ''));
    process.exit(1);
  }

  const loadJson = relPath => {
    const filePath = path.join(runDir, relPath);
    if (!fs.existsSync(filePath)) return undefined;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  };
  const listRevisions = () =>
    fs.readdirSync(runDir)
      .filter(name => /^revision-\d+$/.test(name) && fs.statSync(path.join(runDir, name)).isDirectory())
      .sort((a, b) => parseInt(a.split('-')[1], 10) - parseInt(b.split('-')[1], 10));

  const artifacts = resolveFinalArtifacts(loadJson, listRevisions);
  const row = buildEpisodeRow({ ...artifacts, runFolder: path.relative(process.cwd(), runDir) });

  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const result = await persistEpisode(pool, row);
    console.log('💾 Episode persisted to Postgres');
    console.log(`   Episode id: ${result.episodeId}`);
    console.log(`   Season id:  ${result.seasonId}`);
    console.log(`   Status:     ${result.status} (from run finalStatus: ${artifacts.manifest?.finalStatus})`);
    console.log(`   Source run: ${path.relative(process.cwd(), runDir)}`);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error('❌ Persist failed:', error.message || error);
  if (error.code) console.error(`   code: ${error.code}`);
  if (error.detail) console.error(`   detail: ${error.detail}`);
  process.exit(1);
});
