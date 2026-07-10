/**
 * Unit tests for scripts/lib/continuity-guard.js
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  normalizeProtagonistName,
  loadCanonicalEpisode1Protagonist,
  checkSeasonProtagonistContinuity
} = require('../../scripts/lib/continuity-guard');

function writeRun(episodesRoot: string, { episodeFolder, runStamp, manifest, protagonist }: {
  episodeFolder: string;
  runStamp: string;
  manifest: unknown;
  protagonist?: unknown;
}) {
  const runDir = path.join(episodesRoot, episodeFolder, `run-${runStamp}`);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify(manifest));
  if (protagonist !== undefined) {
    fs.writeFileSync(path.join(runDir, '01-story-outline.json'), JSON.stringify({
      episodeOutline: { title: 'T', synopsis: 'S', themes: [], scenes: [], choicePoints: [], branches: [] }
    }));
    fs.writeFileSync(path.join(runDir, '02-protagonist.json'), JSON.stringify(protagonist));
    fs.writeFileSync(path.join(runDir, '02-supporting-characters.json'), JSON.stringify([]));
  }
  return runDir;
}

describe('continuity-guard', () => {
  let episodesRoot: string;
  const prevSkip = process.env.SKIP_CONTINUITY_GUARD;

  afterEach(() => {
    if (episodesRoot) fs.rmSync(episodesRoot, { recursive: true, force: true });
    if (prevSkip === undefined) delete process.env.SKIP_CONTINUITY_GUARD;
    else process.env.SKIP_CONTINUITY_GUARD = prevSkip;
  });

  it('normalizeProtagonistName trims and collapses whitespace', () => {
    expect(normalizeProtagonistName('  Wren   Okafor-Silva ')).toBe('Wren Okafor-Silva');
  });

  it('loadCanonicalEpisode1Protagonist picks newest APPROVED ep-1 run', () => {
    episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-guard-'));
    writeRun(episodesRoot, {
      episodeFolder: 'episode-01-first-day',
      runStamp: '2026-07-08_06-52-52',
      manifest: { episode: { number: 1, world: 'NEW_SCHOOL' }, finalStatus: 'APPROVED' },
      protagonist: { character: { id: 'player', name: 'Sol Delgado-Reyes' } }
    });
    writeRun(episodesRoot, {
      episodeFolder: 'episode-01-first-day',
      runStamp: '2026-07-10_13-26-56',
      manifest: { episode: { number: 1, world: 'NEW_SCHOOL' }, finalStatus: 'APPROVED' },
      protagonist: { character: { id: 'player', name: 'Wren Okafor-Silva' } }
    });

    const canonical = loadCanonicalEpisode1Protagonist({ episodesRoot, worldId: 'NEW_SCHOOL' });
    expect(canonical?.character.name).toBe('Wren Okafor-Silva');
    expect(canonical?.runFolder).toContain('run-2026-07-10_13-26-56');
  });

  it('checkSeasonProtagonistContinuity passes when carry-over matches canonical ep 1', async () => {
    episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-guard-'));
    writeRun(episodesRoot, {
      episodeFolder: 'episode-01-first-day',
      runStamp: '2026-07-10_13-26-56',
      manifest: { episode: { number: 1, world: 'NEW_SCHOOL' }, finalStatus: 'APPROVED' },
      protagonist: { character: { id: 'player', name: 'Wren Okafor-Silva' } }
    });

    const result = await checkSeasonProtagonistContinuity({
      episodeNumber: 2,
      worldId: 'NEW_SCHOOL',
      episodesRoot,
      databaseUrl: undefined,
      carryOverProtagonist: { id: 'player', name: 'Wren Okafor-Silva' },
      carryOverSource: 'filesystem'
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('checkSeasonProtagonistContinuity fails when carry-over differs from canonical ep 1', async () => {
    episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-guard-'));
    writeRun(episodesRoot, {
      episodeFolder: 'episode-01-first-day',
      runStamp: '2026-07-10_13-26-56',
      manifest: { episode: { number: 1, world: 'NEW_SCHOOL' }, finalStatus: 'APPROVED' },
      protagonist: { character: { id: 'player', name: 'Wren Okafor-Silva' } }
    });

    const result = await checkSeasonProtagonistContinuity({
      episodeNumber: 2,
      worldId: 'NEW_SCHOOL',
      episodesRoot,
      databaseUrl: undefined,
      carryOverProtagonist: { id: 'player', name: 'Marisol "Sol" Delgado-Reyes' },
      carryOverSource: 'postgres'
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('continuity mismatch'))).toBe(true);
  });

  it('checkSeasonProtagonistContinuity is a no-op for episode 1', async () => {
    const result = await checkSeasonProtagonistContinuity({
      episodeNumber: 1,
      worldId: 'NEW_SCHOOL',
      episodesRoot: '/tmp/unused',
      carryOverProtagonist: null,
      carryOverSource: null
    });
    expect(result.ok).toBe(true);
  });

  it('SKIP_CONTINUITY_GUARD=1 allows mismatched carry-over', async () => {
    process.env.SKIP_CONTINUITY_GUARD = '1';
    episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-guard-'));
    writeRun(episodesRoot, {
      episodeFolder: 'episode-01-first-day',
      runStamp: '2026-07-10_13-26-56',
      manifest: { episode: { number: 1, world: 'NEW_SCHOOL' }, finalStatus: 'APPROVED' },
      protagonist: { character: { id: 'player', name: 'Wren Okafor-Silva' } }
    });

    const result = await checkSeasonProtagonistContinuity({
      episodeNumber: 2,
      worldId: 'NEW_SCHOOL',
      episodesRoot,
      carryOverProtagonist: { id: 'player', name: 'Someone Else' },
      carryOverSource: 'postgres'
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.some(w => w.includes('SKIP_CONTINUITY_GUARD'))).toBe(true);
  });
});
