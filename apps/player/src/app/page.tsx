import { getPool } from '@/lib/db';
import { listPublishedPlayerEpisodes } from '@/lib/episodes';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const pool = getPool();
  const episodes = pool ? await listPublishedPlayerEpisodes(pool) : [];

  return (
    <div className="container page">
      <h2>Published episodes</h2>
      <p className="lead">
        Interactive preview of the player content contract. Episodes must be published in the admin app before they appear here.
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
        {episodes.map(ep => (
          <a
            key={`${ep.worldId}-${ep.episodeNumber}`}
            className="episode-card"
            href={`/play/${ep.worldId}/${ep.episodeNumber}`}
          >
            <h3>
              Episode {ep.episodeNumber} — {ep.title}
            </h3>
            <p>
              {ep.worldId} · episode {ep.episodeNumber}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
