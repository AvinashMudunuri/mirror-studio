import {
  SEASON_CONFIGS,
  episodeAccessForSeason,
  upNextEpisode,
  type SeasonConfig
} from '../../apps/player/src/lib/season-config';

const season = SEASON_CONFIGS[0];

function statuses(
  entries: Array<[number, 'not_started' | 'in_progress' | 'completed']>
): Map<number, 'not_started' | 'in_progress' | 'completed'> {
  return new Map(entries);
}

describe('episodeAccessForSeason', () => {
  it('marks episode 1 as up next when nothing is completed', () => {
    expect(episodeAccessForSeason(1, season, statuses([]))).toBe('up_next');
  });

  it('locks later episodes until the previous one is completed', () => {
    const st = statuses([[1, 'in_progress']]);
    expect(episodeAccessForSeason(2, season, st)).toBe('locked');
  });

  it('marks the next episode up next after the previous is completed', () => {
    const st = statuses([[1, 'completed']]);
    expect(episodeAccessForSeason(2, season, st)).toBe('up_next');
  });

  it('returns completed for finished episodes', () => {
    const st = statuses([[1, 'completed']]);
    expect(episodeAccessForSeason(1, season, st)).toBe('completed');
  });
});

describe('upNextEpisode', () => {
  it('returns episode 1 for a fresh player', () => {
    expect(upNextEpisode(season, statuses([]))).toBe(1);
  });

  it('returns the first unlocked incomplete episode', () => {
    const st = statuses([
      [1, 'completed'],
      [2, 'in_progress']
    ]);
    expect(upNextEpisode(season, st)).toBe(2);
  });

  it('returns null when every episode is completed', () => {
    const st = statuses(
      season.episodeNumbers.map(n => [n, 'completed'] as const)
    );
    expect(upNextEpisode(season, st)).toBeNull();
  });
});

describe('SEASON_CONFIGS', () => {
  it('includes New School season 1 episodes 1–5', () => {
    const ns = SEASON_CONFIGS.find(s => s.worldId === 'NEW_SCHOOL') as SeasonConfig;
    expect(ns.title).toBe('New School');
    expect(ns.episodeNumbers).toEqual([1, 2, 3, 4, 5]);
    expect(ns.episodeTitles[2]).toBe('Show Your Work');
  });
});
