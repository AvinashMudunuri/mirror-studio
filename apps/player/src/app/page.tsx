import { BrowseHero, type BrowseHeroEpisode } from '@/components/browse-hero';
import { EpisodeRow } from '@/components/episode-row';
import type { EpisodeTileData } from '@/components/episode-tile';
import { getPool } from '@/lib/db';
import { episodePosterUrl } from '@/lib/episode-posters';
import { listPublishedPlayerEpisodes } from '@/lib/episodes';
import { listPlayerEpisodeStatuses } from '@/lib/player-progress';
import { ensurePlayer, getPlayerIdFromCookie } from '@/lib/player-session';
import {
  SEASON_CONFIGS,
  episodeAccessForSeason,
  upNextEpisode
} from '@/lib/season-config';

export const dynamic = 'force-dynamic';

function ctaForStatus(status: string, access: string): string {
  if (status === 'in_progress') return 'Resume';
  if (status === 'completed') return 'Play again';
  if (access === 'up_next') return 'Play';
  return 'Watch';
}

export default async function HomePage() {
  const pool = getPool();
  const episodes = pool ? await listPublishedPlayerEpisodes(pool) : [];

  const statusByWorldEpisode = new Map<string, 'not_started' | 'in_progress' | 'completed'>();
  if (pool) {
    const playerId = await getPlayerIdFromCookie();
    if (playerId) {
      await ensurePlayer(pool, playerId);
      const rows = await listPlayerEpisodeStatuses(pool, playerId);
      for (const row of rows) {
        statusByWorldEpisode.set(`${row.worldId}-${row.episodeNumber}`, row.status);
      }
    }
  }

  const episodesByWorld = new Map<string, typeof episodes>();
  for (const ep of episodes) {
    const list = episodesByWorld.get(ep.worldId) ?? [];
    list.push(ep);
    episodesByWorld.set(ep.worldId, list);
  }

  const seasonsToShow = SEASON_CONFIGS.filter(s => episodesByWorld.has(s.worldId));

  let featured: BrowseHeroEpisode | null = null;
  const seasonRows: Array<{
    worldId: string;
    title: string;
    subtitle: string;
    continueWatching: EpisodeTileData[];
    allEpisodes: EpisodeTileData[];
  }> = [];

  for (const season of seasonsToShow) {
    const worldEpisodes = episodesByWorld.get(season.worldId) ?? [];
    const byNumber = new Map(worldEpisodes.map(ep => [ep.episodeNumber, ep]));
    const statuses = new Map<number, 'not_started' | 'in_progress' | 'completed'>();
    for (const n of season.episodeNumbers) {
      statuses.set(
        n,
        statusByWorldEpisode.get(`${season.worldId}-${n}`) ?? 'not_started'
      );
    }
    const nextUp = upNextEpisode(season, statuses);

    const tiles: EpisodeTileData[] = season.episodeNumbers
      .map(epNum => {
        const ep = byNumber.get(epNum);
        if (!ep) return null;
        const status = statusByWorldEpisode.get(`${season.worldId}-${epNum}`) ?? 'not_started';
        const access = episodeAccessForSeason(epNum, season, statuses);
        return {
          worldId: season.worldId,
          episodeNumber: ep.episodeNumber,
          title: ep.title,
          synopsis: ep.synopsis,
          posterUrl: episodePosterUrl(season.worldId, ep.episodeNumber),
          access,
          status
        };
      })
      .filter((t): t is EpisodeTileData => t !== null);

    const continueWatching = tiles.filter(
      t => t.status === 'in_progress' || t.access === 'up_next'
    );

    seasonRows.push({
      worldId: season.worldId,
      title: season.title,
      subtitle: season.subtitle,
      continueWatching,
      allEpisodes: tiles
    });

    if (!featured && nextUp != null) {
      const ep = byNumber.get(nextUp);
      if (ep) {
        const status = statusByWorldEpisode.get(`${season.worldId}-${nextUp}`) ?? 'not_started';
        const access = episodeAccessForSeason(nextUp, season, statuses);
        featured = {
          worldId: season.worldId,
          episodeNumber: ep.episodeNumber,
          title: ep.title,
          synopsis: ep.synopsis,
          posterUrl: episodePosterUrl(season.worldId, ep.episodeNumber),
          seasonTitle: season.title,
          seasonSubtitle: season.subtitle,
          status,
          ctaLabel: ctaForStatus(status, access)
        };
      }
    }
  }

  if (!featured && episodes.length > 0) {
    const ep = episodes[0];
    const season = SEASON_CONFIGS.find(s => s.worldId === ep.worldId);
    featured = {
      worldId: ep.worldId,
      episodeNumber: ep.episodeNumber,
      title: ep.title,
      synopsis: ep.synopsis,
      posterUrl: episodePosterUrl(ep.worldId, ep.episodeNumber),
      seasonTitle: season?.title ?? ep.worldId,
      seasonSubtitle: season?.subtitle ?? 'Featured',
      status: 'not_started',
      ctaLabel: 'Play'
    };
  }

  return (
    <div className="browse">
      {!pool && (
        <div className="container-wide browse-notice">
          DATABASE_URL is not configured — set it to the same Postgres instance the admin app uses.
        </div>
      )}

      {pool && episodes.length === 0 && (
        <div className="container-wide browse-notice">
          No published episodes yet. Publish an APPROVED run in the admin app.
        </div>
      )}

      <BrowseHero featured={featured} />

      {seasonRows.map(row => (
        <div key={row.worldId} className="browse-season">
          {row.continueWatching.length > 0 && (
            <EpisodeRow
              title="Continue Watching"
              episodes={row.continueWatching}
            />
          )}
          <EpisodeRow
            title={row.title}
            subtitle={row.subtitle}
            episodes={row.allEpisodes}
          />
        </div>
      ))}
    </div>
  );
}
