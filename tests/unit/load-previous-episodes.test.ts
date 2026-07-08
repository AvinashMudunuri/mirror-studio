/**
 * Unit tests for cross-run continuity loading
 * (scripts/lib/load-previous-episodes.js).
 *
 * Covers both sources:
 * - filesystem: scanning committed run folders, honoring APPROVED-only,
 *   world matching, "before this episode number", INCOMPLETE/crashed runs,
 *   and "latest run wins" dedup per episode number
 * - Postgres: query shape and row -> reference mapping, with graceful
 *   fallback to the filesystem on any DB error
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { loadPreviousEpisodes, loadPreviousCast, loadPreviousProtagonist } = require('../../scripts/lib/load-previous-episodes');

function outlineFixture(overrides: Record<string, unknown> = {}) {
  return {
    episodeOutline: {
      title: 'First Bell',
      synopsis: 'Alex survives day one.',
      themes: ['Belonging'],
      scenes: [{ id: 's1', title: 'Arrival', location: 'Gate', characters: ['player'], duration: 1, description: 'd', emotionalBeat: 'nervous', defaultNextScene: 'END' }],
      choicePoints: [],
      branches: [],
      ...overrides
    }
  };
}

function writeRun(episodesRoot: string, { episodeFolder, runStamp, manifest, storyOutline, protagonist, supportingCharacters }: {
  episodeFolder: string;
  runStamp: string;
  manifest: unknown;
  storyOutline?: unknown;
  protagonist?: unknown;
  supportingCharacters?: unknown;
}) {
  const runDir = path.join(episodesRoot, episodeFolder, `run-${runStamp}`);
  fs.mkdirSync(runDir, { recursive: true });
  if (manifest !== undefined) {
    fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify(manifest));
  }
  if (storyOutline !== undefined) {
    fs.writeFileSync(path.join(runDir, '01-story-outline.json'), JSON.stringify(storyOutline));
  }
  if (protagonist !== undefined) {
    fs.writeFileSync(path.join(runDir, '02-protagonist.json'), JSON.stringify(protagonist));
  }
  if (supportingCharacters !== undefined) {
    fs.writeFileSync(path.join(runDir, '02-supporting-characters.json'), JSON.stringify(supportingCharacters));
  }
  return runDir;
}

function protagonistFixture(overrides: Record<string, unknown> = {}) {
  return { character: { id: 'player', name: 'Wren Castillo', age: 13, pronouns: 'they/them', ...overrides } };
}

describe('loadPreviousEpisodes — filesystem source', () => {
  let episodesRoot: string;

  afterEach(() => {
    if (episodesRoot) fs.rmSync(episodesRoot, { recursive: true, force: true });
  });

  it('returns nothing when there are no earlier episodes', async () => {
    episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-episodes-'));
    writeRun(episodesRoot, {
      episodeFolder: 'episode-01-first-day',
      runStamp: '2026-07-06_11-33-54',
      manifest: { episode: { number: 1, world: 'NEW_SCHOOL' }, finalStatus: 'APPROVED' },
      storyOutline: outlineFixture()
    });

    const { episodes, source } = await loadPreviousEpisodes({
      worldId: 'NEW_SCHOOL',
      beforeEpisodeNumber: 1,
      episodesRoot
    });

    expect(source).toBe('filesystem');
    expect(episodes).toEqual([]);
  });

  it('loads an APPROVED earlier episode as a {id, title, synopsis, themes} reference', async () => {
    episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-episodes-'));
    writeRun(episodesRoot, {
      episodeFolder: 'episode-01-first-day',
      runStamp: '2026-07-06_11-33-54',
      manifest: { episode: { number: 1, world: 'NEW_SCHOOL' }, finalStatus: 'APPROVED' },
      storyOutline: outlineFixture()
    });

    const { episodes, source } = await loadPreviousEpisodes({
      worldId: 'NEW_SCHOOL',
      beforeEpisodeNumber: 2,
      episodesRoot
    });

    expect(source).toBe('filesystem');
    expect(episodes).toEqual([
      { id: 'ep-1', episodeNumber: 1, title: 'First Bell', synopsis: 'Alex survives day one.', themes: ['Belonging'] }
    ]);
  });

  it('ignores runs that are not APPROVED', async () => {
    episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-episodes-'));
    writeRun(episodesRoot, {
      episodeFolder: 'episode-01-first-day',
      runStamp: '2026-07-06_08-42-42',
      manifest: { episode: { number: 1, world: 'NEW_SCHOOL' }, finalStatus: 'NEEDS_HUMAN_REVIEW' },
      storyOutline: outlineFixture()
    });

    const { episodes } = await loadPreviousEpisodes({
      worldId: 'NEW_SCHOOL',
      beforeEpisodeNumber: 2,
      episodesRoot
    });

    expect(episodes).toEqual([]);
  });

  it('ignores runs from a different world', async () => {
    episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-episodes-'));
    writeRun(episodesRoot, {
      episodeFolder: 'episode-01-first-day',
      runStamp: '2026-07-06_11-33-54',
      manifest: { episode: { number: 1, world: 'SPORTS_ACADEMY' }, finalStatus: 'APPROVED' },
      storyOutline: outlineFixture()
    });

    const { episodes } = await loadPreviousEpisodes({
      worldId: 'NEW_SCHOOL',
      beforeEpisodeNumber: 2,
      episodesRoot
    });

    expect(episodes).toEqual([]);
  });

  it('skips run folders with no manifest (crashed/INCOMPLETE runs)', async () => {
    episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-episodes-'));
    writeRun(episodesRoot, {
      episodeFolder: 'episode-01-first-day',
      runStamp: '2026-07-06_06-32-56',
      manifest: undefined
    });

    const { episodes } = await loadPreviousEpisodes({
      worldId: 'NEW_SCHOOL',
      beforeEpisodeNumber: 2,
      episodesRoot
    });

    expect(episodes).toEqual([]);
  });

  it('excludes episodes at or after beforeEpisodeNumber', async () => {
    episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-episodes-'));
    writeRun(episodesRoot, {
      episodeFolder: 'episode-02-group-project',
      runStamp: '2026-07-07_09-00-00',
      manifest: { episode: { number: 2, world: 'NEW_SCHOOL' }, finalStatus: 'APPROVED' },
      storyOutline: outlineFixture({ title: 'The Group Project' })
    });

    const { episodes } = await loadPreviousEpisodes({
      worldId: 'NEW_SCHOOL',
      beforeEpisodeNumber: 2,
      episodesRoot
    });

    expect(episodes).toEqual([]);
  });

  it('picks the most recent APPROVED run per episode number and returns sorted ascending', async () => {
    episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-episodes-'));
    // Two APPROVED runs of episode 1 (a re-run) — the later one must win.
    writeRun(episodesRoot, {
      episodeFolder: 'episode-01-first-day',
      runStamp: '2026-07-06_11-33-54',
      manifest: { episode: { number: 1, world: 'NEW_SCHOOL' }, finalStatus: 'APPROVED' },
      storyOutline: outlineFixture({ title: 'Old Title' })
    });
    writeRun(episodesRoot, {
      episodeFolder: 'episode-01-first-day',
      runStamp: '2026-07-06_12-59-25',
      manifest: { episode: { number: 1, world: 'NEW_SCHOOL' }, finalStatus: 'APPROVED' },
      storyOutline: outlineFixture({ title: 'Latest Title' })
    });
    writeRun(episodesRoot, {
      episodeFolder: 'episode-02-group-project',
      runStamp: '2026-07-07_09-00-00',
      manifest: { episode: { number: 2, world: 'NEW_SCHOOL' }, finalStatus: 'APPROVED' },
      storyOutline: outlineFixture({ title: 'The Group Project' })
    });

    const { episodes } = await loadPreviousEpisodes({
      worldId: 'NEW_SCHOOL',
      beforeEpisodeNumber: 3,
      episodesRoot
    });

    expect(episodes.map((e: any) => e.episodeNumber)).toEqual([1, 2]);
    expect(episodes[0].title).toBe('Latest Title');
  });

  it('prefers a revision-overridden outline over the base one', async () => {
    episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-episodes-'));
    const runDir = writeRun(episodesRoot, {
      episodeFolder: 'episode-01-first-day',
      runStamp: '2026-07-06_11-33-54',
      manifest: { episode: { number: 1, world: 'NEW_SCHOOL' }, finalStatus: 'APPROVED' },
      storyOutline: outlineFixture({ title: 'Base Title' })
    });
    fs.mkdirSync(path.join(runDir, 'revision-1'), { recursive: true });
    fs.writeFileSync(path.join(runDir, 'revision-1', 'story-outline.json'), JSON.stringify(outlineFixture({ title: 'Revised Title' })));

    const { episodes } = await loadPreviousEpisodes({
      worldId: 'NEW_SCHOOL',
      beforeEpisodeNumber: 2,
      episodesRoot
    });

    expect(episodes[0].title).toBe('Revised Title');
  });

  it('returns nothing when episodesRoot does not exist', async () => {
    const { episodes, source } = await loadPreviousEpisodes({
      worldId: 'NEW_SCHOOL',
      beforeEpisodeNumber: 2,
      episodesRoot: path.join(os.tmpdir(), 'mirror-episodes-does-not-exist')
    });
    expect(source).toBe('filesystem');
    expect(episodes).toEqual([]);
  });
});

describe('loadPreviousEpisodes — Postgres source', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('pg');
  });

  it('queries APPROVED episodes before the target number and maps rows to references', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        { episode_number: 1, title: 'First Bell', synopsis: 'Day one.', content: { outline: { themes: ['Belonging'] } } }
      ]
    });
    const end = jest.fn().mockResolvedValue(undefined);
    jest.doMock('pg', () => ({ Pool: jest.fn().mockImplementation(() => ({ query, end })) }));

    const { loadPreviousEpisodes: load } = require('../../scripts/lib/load-previous-episodes');
    const { episodes, source } = await load({
      databaseUrl: 'postgres://fake',
      worldId: 'NEW_SCHOOL',
      beforeEpisodeNumber: 2,
      episodesRoot: path.join(os.tmpdir(), 'unused')
    });

    expect(source).toBe('postgres');
    expect(episodes).toEqual([
      { id: 'ep-1', episodeNumber: 1, title: 'First Bell', synopsis: 'Day one.', themes: ['Belonging'] }
    ]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("e.status = 'APPROVED'"),
      ['NEW_SCHOOL', 2]
    );
    expect(end).toHaveBeenCalled();
  });

  it('falls back to the filesystem when the database query fails', async () => {
    const query = jest.fn().mockRejectedValue(new Error('connection refused'));
    const end = jest.fn().mockResolvedValue(undefined);
    jest.doMock('pg', () => ({ Pool: jest.fn().mockImplementation(() => ({ query, end })) }));

    const episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-episodes-'));
    try {
      writeRun(episodesRoot, {
        episodeFolder: 'episode-01-first-day',
        runStamp: '2026-07-06_11-33-54',
        manifest: { episode: { number: 1, world: 'NEW_SCHOOL' }, finalStatus: 'APPROVED' },
        storyOutline: outlineFixture()
      });

      const { loadPreviousEpisodes: load } = require('../../scripts/lib/load-previous-episodes');
      const { episodes, source } = await load({
        databaseUrl: 'postgres://fake',
        worldId: 'NEW_SCHOOL',
        beforeEpisodeNumber: 2,
        episodesRoot
      });

      expect(source).toBe('filesystem');
      expect(episodes).toHaveLength(1);
      expect(episodes[0].title).toBe('First Bell');
    } finally {
      fs.rmSync(episodesRoot, { recursive: true, force: true });
    }
  });
});

describe('loadPreviousCast — filesystem source', () => {
  let episodesRoot: string;

  afterEach(() => {
    if (episodesRoot) fs.rmSync(episodesRoot, { recursive: true, force: true });
  });

  it('returns an empty cast when there is no earlier approved episode', async () => {
    episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-episodes-'));
    const { cast, source } = await loadPreviousCast({
      worldId: 'NEW_SCHOOL',
      beforeEpisodeNumber: 1,
      episodesRoot
    });
    expect(cast).toEqual([]);
    expect(source).toBeNull();
  });

  it('returns the protagonist AND every supporting character from the most recent APPROVED episode', async () => {
    episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-episodes-'));
    writeRun(episodesRoot, {
      episodeFolder: 'episode-01-first-day',
      runStamp: '2026-07-06_11-33-54',
      manifest: { episode: { number: 1, world: 'NEW_SCHOOL' }, finalStatus: 'APPROVED' },
      storyOutline: outlineFixture(),
      protagonist: protagonistFixture(),
      supportingCharacters: [{ character: { id: 'jordan', name: 'Jordan Oduya' } }]
    });

    const { cast, source } = await loadPreviousCast({
      worldId: 'NEW_SCHOOL',
      beforeEpisodeNumber: 2,
      episodesRoot
    });

    expect(source).toBe('filesystem');
    expect(cast.map((c: any) => c.id).sort()).toEqual(['jordan', 'player']);
    expect(cast.find((c: any) => c.id === 'jordan').name).toBe('Jordan Oduya');
  });

  it('includes supporting characters added by a revision (revision-aware, unlike the protagonist)', async () => {
    episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-episodes-'));
    const runDir = writeRun(episodesRoot, {
      episodeFolder: 'episode-01-first-day',
      runStamp: '2026-07-06_11-33-54',
      manifest: { episode: { number: 1, world: 'NEW_SCHOOL' }, finalStatus: 'APPROVED' },
      storyOutline: outlineFixture(),
      protagonist: protagonistFixture(),
      supportingCharacters: [{ character: { id: 'jordan', name: 'Jordan Oduya' } }]
    });
    fs.mkdirSync(path.join(runDir, 'revision-1'), { recursive: true });
    fs.writeFileSync(
      path.join(runDir, 'revision-1', 'supporting-characters.json'),
      JSON.stringify([{ character: { id: 'maya', name: 'Maya Reyes' } }])
    );

    const { cast } = await loadPreviousCast({
      worldId: 'NEW_SCHOOL',
      beforeEpisodeNumber: 2,
      episodesRoot
    });

    expect(cast.map((c: any) => c.id).sort()).toEqual(['jordan', 'maya', 'player']);
  });
});

describe('loadPreviousCast — Postgres source', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('pg');
  });

  it('returns the full cast array from the single latest APPROVED episode', async () => {
    const fullCast = [{ id: 'player', name: 'Wren Castillo' }, { id: 'jordan', name: 'Jordan Oduya' }];
    const query = jest.fn().mockResolvedValue({ rows: [{ content: { cast: fullCast } }] });
    const end = jest.fn().mockResolvedValue(undefined);
    jest.doMock('pg', () => ({ Pool: jest.fn().mockImplementation(() => ({ query, end })) }));

    const { loadPreviousCast: load } = require('../../scripts/lib/load-previous-episodes');
    const { cast, source } = await load({
      databaseUrl: 'postgres://fake',
      worldId: 'NEW_SCHOOL',
      beforeEpisodeNumber: 2,
      episodesRoot: path.join(os.tmpdir(), 'unused')
    });

    expect(source).toBe('postgres');
    expect(cast).toEqual(fullCast);
  });
});

describe('loadPreviousProtagonist — filesystem source', () => {
  let episodesRoot: string;

  afterEach(() => {
    if (episodesRoot) fs.rmSync(episodesRoot, { recursive: true, force: true });
  });

  it('returns null when there is no earlier approved episode', async () => {
    episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-episodes-'));
    const { character, source } = await loadPreviousProtagonist({
      worldId: 'NEW_SCHOOL',
      beforeEpisodeNumber: 1,
      episodesRoot
    });
    expect(character).toBeNull();
    expect(source).toBeNull();
  });

  it('returns the protagonist from the most recent APPROVED earlier episode', async () => {
    episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-episodes-'));
    writeRun(episodesRoot, {
      episodeFolder: 'episode-01-first-day',
      runStamp: '2026-07-06_11-33-54',
      manifest: { episode: { number: 1, world: 'NEW_SCHOOL' }, finalStatus: 'APPROVED' },
      storyOutline: outlineFixture(),
      protagonist: protagonistFixture()
    });

    const { character, source } = await loadPreviousProtagonist({
      worldId: 'NEW_SCHOOL',
      beforeEpisodeNumber: 2,
      episodesRoot
    });

    expect(source).toBe('filesystem');
    expect(character).toEqual({ id: 'player', name: 'Wren Castillo', age: 13, pronouns: 'they/them' });
  });

  it('prefers the HIGHER episode number, even if it is an older run timestamp', async () => {
    episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-episodes-'));
    // Episode 2's run happened before a later re-run of episode 1 — episode
    // 2's protagonist must still win, since it's more recent in the story.
    writeRun(episodesRoot, {
      episodeFolder: 'episode-02-group-project',
      runStamp: '2026-07-06_10-00-00',
      manifest: { episode: { number: 2, world: 'NEW_SCHOOL' }, finalStatus: 'APPROVED' },
      storyOutline: outlineFixture(),
      protagonist: protagonistFixture({ name: 'Episode 2 Protagonist' })
    });
    writeRun(episodesRoot, {
      episodeFolder: 'episode-01-first-day',
      runStamp: '2026-07-06_20-00-00',
      manifest: { episode: { number: 1, world: 'NEW_SCHOOL' }, finalStatus: 'APPROVED' },
      storyOutline: outlineFixture(),
      protagonist: protagonistFixture({ name: 'Episode 1 Protagonist' })
    });

    const { character } = await loadPreviousProtagonist({
      worldId: 'NEW_SCHOOL',
      beforeEpisodeNumber: 3,
      episodesRoot
    });

    expect(character.name).toBe('Episode 2 Protagonist');
  });

  it('ignores non-APPROVED runs and runs from a different world', async () => {
    episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-episodes-'));
    writeRun(episodesRoot, {
      episodeFolder: 'episode-01-first-day',
      runStamp: '2026-07-06_08-00-00',
      manifest: { episode: { number: 1, world: 'NEW_SCHOOL' }, finalStatus: 'NEEDS_HUMAN_REVIEW' },
      protagonist: protagonistFixture({ name: 'Rejected Draft' })
    });
    writeRun(episodesRoot, {
      episodeFolder: 'episode-01-other-world',
      runStamp: '2026-07-06_09-00-00',
      manifest: { episode: { number: 1, world: 'SPORTS_ACADEMY' }, finalStatus: 'APPROVED' },
      protagonist: protagonistFixture({ name: 'Wrong World' })
    });

    const { character } = await loadPreviousProtagonist({
      worldId: 'NEW_SCHOOL',
      beforeEpisodeNumber: 2,
      episodesRoot
    });

    expect(character).toBeNull();
  });

  it('excludes episodes at or after beforeEpisodeNumber', async () => {
    episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-episodes-'));
    writeRun(episodesRoot, {
      episodeFolder: 'episode-02-group-project',
      runStamp: '2026-07-07_09-00-00',
      manifest: { episode: { number: 2, world: 'NEW_SCHOOL' }, finalStatus: 'APPROVED' },
      protagonist: protagonistFixture()
    });

    const { character } = await loadPreviousProtagonist({
      worldId: 'NEW_SCHOOL',
      beforeEpisodeNumber: 2,
      episodesRoot
    });

    expect(character).toBeNull();
  });
});

describe('loadPreviousProtagonist — Postgres source', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('pg');
  });

  it('queries the single latest APPROVED episode and finds the player in its cast', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ content: { cast: [{ id: 'player', name: 'Wren Castillo' }, { id: 'jordan', name: 'Jordan' }] } }]
    });
    const end = jest.fn().mockResolvedValue(undefined);
    jest.doMock('pg', () => ({ Pool: jest.fn().mockImplementation(() => ({ query, end })) }));

    const { loadPreviousProtagonist: load } = require('../../scripts/lib/load-previous-episodes');
    const { character, source } = await load({
      databaseUrl: 'postgres://fake',
      worldId: 'NEW_SCHOOL',
      beforeEpisodeNumber: 2,
      episodesRoot: path.join(os.tmpdir(), 'unused')
    });

    expect(source).toBe('postgres');
    expect(character).toEqual({ id: 'player', name: 'Wren Castillo' });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY e.episode_number DESC'),
      ['NEW_SCHOOL', 2]
    );
    expect(end).toHaveBeenCalled();
  });

  it('falls back to the filesystem when the database query fails', async () => {
    const query = jest.fn().mockRejectedValue(new Error('connection refused'));
    const end = jest.fn().mockResolvedValue(undefined);
    jest.doMock('pg', () => ({ Pool: jest.fn().mockImplementation(() => ({ query, end })) }));

    const episodesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-episodes-'));
    try {
      writeRun(episodesRoot, {
        episodeFolder: 'episode-01-first-day',
        runStamp: '2026-07-06_11-33-54',
        manifest: { episode: { number: 1, world: 'NEW_SCHOOL' }, finalStatus: 'APPROVED' },
        storyOutline: outlineFixture(),
        protagonist: protagonistFixture()
      });

      const { loadPreviousProtagonist: load } = require('../../scripts/lib/load-previous-episodes');
      const { character, source } = await load({
        databaseUrl: 'postgres://fake',
        worldId: 'NEW_SCHOOL',
        beforeEpisodeNumber: 2,
        episodesRoot
      });

      expect(source).toBe('filesystem');
      expect(character.name).toBe('Wren Castillo');
    } finally {
      fs.rmSync(episodesRoot, { recursive: true, force: true });
    }
  });

  it('returns null (not an error) when Postgres has no earlier episode and neither does the filesystem', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const end = jest.fn().mockResolvedValue(undefined);
    jest.doMock('pg', () => ({ Pool: jest.fn().mockImplementation(() => ({ query, end })) }));

    const { loadPreviousProtagonist: load } = require('../../scripts/lib/load-previous-episodes');
    const { character, source } = await load({
      databaseUrl: 'postgres://fake',
      worldId: 'NEW_SCHOOL',
      beforeEpisodeNumber: 1,
      episodesRoot: path.join(os.tmpdir(), 'mirror-episodes-does-not-exist')
    });

    expect(character).toBeNull();
    expect(source).toBeNull();
  });
});
