import { getPool } from '@/lib/db';
import { listPublishedPlayerEpisodes } from '@/lib/episodes';
import { listPlayerEpisodeStatuses } from '@/lib/player-progress';
import { ensurePlayer, getPlayerIdFromCookie } from '@/lib/player-session';
import {
  SEASON_CONFIGS,
  episodeAccessForSeason,
  upNextEpisode,
  type EpisodeAccess
} from '@/lib/season-config';

export const dynamic = 'force-dynamic';

function accessLabel(access: EpisodeAccess, status: string): string {
  if (access === 'completed') return 'Finished';
  if (access === 'up_next') return 'Up next';
  if (access === 'locked') return 'Locked';
  if (status === 'in_progress') return 'In progress';
  return '';
}

function accessPillClass(access: EpisodeAccess, status: string): string {
  if (access === 'up_next') return 'status-pill status-pill--up_next';
  if (access === 'locked') return 'status-pill status-pill--locked';
  if (status === 'completed') return 'status-pill status-pill--completed';
  if (status === 'in_progress') return 'status-pill status-pill--in_progress';
  return '';
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
  const orphanWorlds = [...episodesByWorld.keys()].filter(
    w => !SEASON_CONFIGS.some(s => s.worldId === w)
  );

  return (
    <div className="container page">
      <h2>Your episodes</h2>
      <p className="lead">
        Pick up where you left off — your choices are saved on this device.
      </p>

      {!pool && (
        <div className="notice" style={{ marginBottom: 20 }}>
          DATABASE_URL is not configured — set it to the same Postgres instance the admin app uses.
        </div>
      )}

      {pool && episodes.length === 0 && (
        <div className="notice" style={{ marginBottom: 20 }}>
          No published episodes yet. Publish an APPROVED run in the admin app.
        </div>
      )}

      {seasonsToShow.map(season => {
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

        return (
          <section key={season.worldId} className="season-block">
            <header className="season-header">
              <div>
                <h3 className="season-title">{season.title}</h3>
                <p className="season-subtitle">{season.subtitle}</p>
              </div>
              {nextUp != null && (
                <a className="season-up-next-link" href={`/play/${season.worldId}/${nextUp}`}>
                  Continue episode {nextUp} →
                </a>
              )}
            </header>

            <div className="episode-list">
              {season.episodeNumbers.map(epNum => {
                const ep = byNumber.get(epNum);
                if (!ep) return null;

                const status =
                  statusByWorldEpisode.get(`${season.worldId}-${epNum}`) ?? 'not_started';
                const access = episodeAccessForSeason(epNum, season, statuses);
                const locked = access === 'locked';
                const badge = accessLabel(access, status);
                const pillClass = accessPillClass(access, status);

                const cardContent = (
                  <>
                    <div className="episode-card-top">
                      <h4>
                        Episode {ep.episodeNumber} — {ep.title}
                      </h4>
                      {badge && <span className={pillClass}>{badge}</span>}
                    </div>
                    <p>{ep.synopsis}</p>
                    {locked && (
                      <p className="episode-lock-hint">Finish the previous episode to unlock.</p>
                    )}
                  </>
                );

                if (locked) {
                  return (
                    <div
                      key={`${season.worldId}-${epNum}`}
                      className="episode-card episode-card--locked"
                      aria-disabled="true"
                    >
                      {cardContent}
                    </div>
                  );
                }

                return (
                  <a
                    key={`${season.worldId}-${epNum}`}
                    className={`episode-card${access === 'up_next' ? ' episode-card--up-next' : ''}`}
                    href={`/play/${season.worldId}/${epNum}`}
                  >
                    {cardContent}
                  </a>
                );
              })}
            </div>
          </section>
        );
      })}

      {orphanWorlds.map(worldId => {
        const worldEpisodes = episodesByWorld.get(worldId) ?? [];
        return (
          <section key={worldId} className="season-block">
            <header className="season-header">
              <h3 className="season-title">{worldId}</h3>
            </header>
            <div className="episode-list">
              {worldEpisodes.map(ep => (
                <a
                  key={`${ep.worldId}-${ep.episodeNumber}`}
                  className="episode-card"
                  href={`/play/${ep.worldId}/${ep.episodeNumber}`}
                >
                  <div className="episode-card-top">
                    <h4>
                      Episode {ep.episodeNumber} — {ep.title}
                    </h4>
                  </div>
                  <p>{ep.synopsis}</p>
                </a>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
