import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

const EPISODES = [
  { worldId: 'NEW_SCHOOL', episodeNumber: 1, label: 'Episode 1 — First Bell' },
  { worldId: 'NEW_SCHOOL', episodeNumber: 2, label: 'Episode 2 — Group Work' }
];

export default async function HomePage() {
  const pool = getPool();

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

      <div className="episode-list">
        {EPISODES.map(ep => (
          <a key={`${ep.worldId}-${ep.episodeNumber}`} className="episode-card" href={`/play/${ep.worldId}/${ep.episodeNumber}`}>
            <h3>{ep.label}</h3>
            <p>{ep.worldId} · episode {ep.episodeNumber}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
