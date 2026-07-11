import { getPool } from '@/lib/db';
import { listPublishedPlayerEpisodes } from '@/lib/episodes';
import { listPlayerEpisodeStatuses } from '@/lib/player-progress';
import { ensurePlayer, getPlayerIdFromCookie } from '@/lib/player-session';

export const dynamic = 'force-dynamic';

function statusLabel(status: string): string {
  if (status === 'completed') return 'Finished';
  if (status === 'in_progress') return 'In progress';
  return '';
}

export default async function HomePage() {
  const pool = getPool();
  const episodes = pool ? await listPublishedPlayerEpisodes(pool) : [];

  let statuses = new Map<string, string>();
  if (pool) {
    const playerId = await getPlayerIdFromCookie();
    if (playerId) {
      await ensurePlayer(pool, playerId);
      const rows = await listPlayerEpisodeStatuses(pool, playerId);
      for (const row of rows) {
        statuses.set(`${row.worldId}-${row.episodeNumber}`, row.status);
      }
    }
  }

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

      <div className="episode-list">
        {episodes.map(ep => {
          const status = statuses.get(`${ep.worldId}-${ep.episodeNumber}`) ?? 'not_started';
          const badge = statusLabel(status);
          return (
            <a
              key={`${ep.worldId}-${ep.episodeNumber}`}
              className="episode-card"
              href={`/play/${ep.worldId}/${ep.episodeNumber}`}
            >
              <div className="episode-card-top">
                <h3>
                  Episode {ep.episodeNumber} — {ep.title}
                </h3>
                {badge && <span className={`status-pill status-pill--${status}`}>{badge}</span>}
              </div>
              <p>{ep.synopsis}</p>
            </a>
          );
        })}
      </div>
    </div>
  );
}
