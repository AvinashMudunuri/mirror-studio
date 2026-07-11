/** Season arc metadata for player homepage ordering and soft locks. */
export interface SeasonConfig {
  worldId: string;
  title: string;
  subtitle: string;
  episodeNumbers: number[];
}

export const SEASON_CONFIGS: SeasonConfig[] = [
  {
    worldId: 'NEW_SCHOOL',
    title: 'New School',
    subtitle: 'Season 1: First Year',
    episodeNumbers: [1, 2, 3, 4, 5]
  }
];

export function seasonForWorld(worldId: string): SeasonConfig | undefined {
  return SEASON_CONFIGS.find(s => s.worldId === worldId);
}

export type EpisodeAccess = 'available' | 'up_next' | 'locked' | 'completed';

export function episodeAccessForSeason(
  episodeNumber: number,
  season: SeasonConfig,
  statuses: Map<number, 'not_started' | 'in_progress' | 'completed'>
): EpisodeAccess {
  if (statuses.get(episodeNumber) === 'completed') return 'completed';

  const ordered = season.episodeNumbers;
  const idx = ordered.indexOf(episodeNumber);
  if (idx <= 0) return 'up_next';

  const prev = ordered[idx - 1];
  const prevStatus = statuses.get(prev);
  if (prevStatus !== 'completed') return 'locked';

  const st = statuses.get(episodeNumber);
  if (st === 'in_progress' || st === 'not_started' || !st) {
    const anyEarlierInProgress = ordered
      .slice(0, idx)
      .some(n => statuses.get(n) === 'in_progress');
    if (!anyEarlierInProgress) return 'up_next';
    return 'available';
  }
  return 'available';
}

/** First playable episode that is not completed — for "Up next" banner. */
export function upNextEpisode(
  season: SeasonConfig,
  statuses: Map<number, 'not_started' | 'in_progress' | 'completed'>
): number | null {
  for (const n of season.episodeNumbers) {
    const access = episodeAccessForSeason(n, season, statuses);
    if (access === 'up_next' || access === 'available') {
      if (statuses.get(n) !== 'completed') return n;
    }
    if (access === 'locked') return null;
  }
  return null;
}
