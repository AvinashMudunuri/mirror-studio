import { notFound } from 'next/navigation';
import { getPool } from '@/lib/db';
import { getPublishedEpisode } from '@/lib/publish';

export const dynamic = 'force-dynamic';

function formatTimestamp(iso: string): string {
  return new Date(iso).toUTCString().replace(' GMT', ' UTC');
}

/**
 * Minimal "does this actually render for a player" preview — deliberately
 * NOT a real player experience (no choices, no branching playthrough).
 * Cheapest way to validate the published-content schema before building a
 * real frontend (docs/decisions/003-publish-scope-proposal.md, open
 * question 2). Reads only the published_* snapshot via the API route's
 * same data function — never the mutable pipeline content.
 */
export default async function PublishedPreviewPage({
  params
}: {
  params: Promise<{ world: string; episodeNumber: string }>;
}) {
  const { world, episodeNumber } = await params;
  const num = parseInt(episodeNumber, 10);
  const pool = getPool();
  if (!pool || !Number.isFinite(num)) notFound();

  const published = await getPublishedEpisode(pool, world, num);
  if (!published) notFound();

  const content = published.content as any;
  const outline = content?.outline;
  const cast = content?.cast || [];
  const dialogueByScene = new Map((content?.dialogue || []).map((d: any) => [d.sceneId, d.lines]));

  return (
    <main className="container">
      <div className="crumbs">
        published preview / {world} / episode {num}
      </div>

      <div className="top-row" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <h1 className="page-title" style={{ margin: 0 }}>{published.title}</h1>
        <span className="badge good">PUBLISHED</span>
      </div>
      <p className="page-sub">
        Published {formatTimestamp(published.publishedAt)} · fetched from{' '}
        <code>GET /api/published/{world}/{num}</code> — the same read path a real frontend would use.
        {' '}Player projection: <code>?format=player</code>.
        {' '}Interactive preview: <a href={`http://localhost:3400/play/${world}/${num}`}>open in MIRROR Player</a>.
      </p>
      <p className="page-sub">{published.synopsis}</p>

      {cast.length > 0 && (
        <div className="section">
          <h2>Cast</h2>
          <div className="verdict-row">
            {cast.map((c: any) => (
              <span key={c.id} className="badge dim">{c.name} ({c.id})</span>
            ))}
          </div>
        </div>
      )}

      {(outline?.scenes || []).length > 0 && (
        <div className="section">
          <h2>Scenes</h2>
          {outline.scenes.map((scene: any, i: number) => (
            <div key={scene.id} className="run-card" style={{ cursor: 'default' }}>
              <div className="top-row">
                <span className="title">Scene {i + 1}: {scene.title}</span>
                <span className="badge dim">{scene.location}</span>
              </div>
              <div className="meta">
                <span>{scene.description}</span>
              </div>
              {((dialogueByScene.get(scene.id) as any[]) || []).map((line: any) => (
                <div key={line.id} className="meta" style={{ marginTop: 6 }}>
                  <b>{line.character === 'player' ? 'YOU' : line.character.toUpperCase()}:</b> {line.text}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
