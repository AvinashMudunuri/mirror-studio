#!/usr/bin/env node

/**
 * Compile a run folder's artifacts into a bound script (episode-script.md):
 * the single, human-readable, final screenplay for the episode.
 *
 * Zero LLM calls — pure assembly of committed artifacts, so past runs can
 * be bound retroactively for free.
 *
 * Usage:
 *   node scripts/compile-screenplay.js <run-folder>
 *   node scripts/compile-screenplay.js   (uses the latest run)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { compileScreenplay, resolveFinalArtifacts } = require('./lib/compile-screenplay');

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

const runDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : latestRunFolder();

if (!runDir || !fs.existsSync(runDir)) {
  console.error('❌ Run folder not found.' + (runDir ? ` Tried: ${runDir}` : ''));
  console.error('   Usage: node scripts/compile-screenplay.js <output/episodes/.../run-...>');
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

const { outline, dialogueResult, cast, manifest } = resolveFinalArtifacts(loadJson, listRevisions);
const screenplay = compileScreenplay({ outline, cast, dialogueResult, manifest });

const outPath = path.join(runDir, 'episode-script.md');
fs.writeFileSync(outPath, screenplay, 'utf-8');

const status = manifest?.finalStatus === 'APPROVED' ? 'FINAL — LOCKED' : `DRAFT (${manifest?.finalStatus || 'no review record'})`;
console.log(`📜 Bound script written: ${path.relative(process.cwd(), outPath)}`);
console.log(`   Status: ${status}`);
console.log(`   Scenes: ${outline.scenes?.length || 0} | Cast: ${cast.length} | Branch variants: ${dialogueResult.branchDialogue?.length || 0}`);
