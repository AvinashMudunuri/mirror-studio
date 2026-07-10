import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getRun } from '@/lib/runs';
import { getPool } from '@/lib/db';
import { findEpisodeRow, reasonNotPublishable } from '@/lib/publish';
import { StatusBadge, VerdictBadges } from '@/components/badges';
import { PublishButton } from './publish-button';

export const dynamic = 'force-dynamic';

function formatTimestamp(iso: string): string {
  return new Date(iso).toUTCString().replace(' GMT', ' UTC');
}

async function PublishSection({ episodeFolder, runFolder, worldId, episodeNumber }: {
  episodeFolder: string;
  runFolder: string;
  worldId: string | undefined;
  episodeNumber: number | undefined;
}) {
  const pool = getPool();
  if (!pool) {
    return (
      <div className="publish-box">
        <p className="publish-reason">
          <code>DATABASE_URL</code> is not configured for this admin instance — publishing is unavailable.
        </p>
      </div>
    );
  }
  if (!worldId || episodeNumber == null) {
    return (
      <div className="publish-box">
        <p className="publish-reason">This run&apos;s manifest is missing episode/world info — can&apos;t look up its Postgres row.</p>
      </div>
    );
  }

  const row = await findEpisodeRow(pool, worldId, episodeNumber);
  const reason = reasonNotPublishable(row);
  const runFolderRelative = `output/episodes/${episodeFolder}/${runFolder}`;

  if (reason) {
    return (
      <div className="publish-box">
        <p className="publish-reason" style={{ margin: 0 }}>Not publishable: {reason}</p>
      </div>
    );
  }

  // row is guaranteed non-null here — reasonNotPublishable(null) always returns a reason.
  const currentContentRunFolder = row!.metadata?.runFolder ?? undefined;
  const matchesThisRun = currentContentRunFolder ? currentContentRunFolder === runFolderRelative : true;
  const alreadyPublishedThisContent = row!.publishedRunFolder === (currentContentRunFolder ?? runFolderRelative);

  return (
    <div className="publish-box">
      {row!.publishedAt && (
        <p className="publish-reason" style={{ marginTop: 0 }}>
          Currently published from <code>{row!.publishedRunFolder}</code>, at {formatTimestamp(row!.publishedAt)} —{' '}
          <Link href={`/published/${worldId}/${episodeNumber}`}>view preview</Link>.
        </p>
      )}
      {!matchesThisRun && (
        <p className="publish-reason">
          Postgres&apos; current content for this episode comes from a different run
          (<code>{currentContentRunFolder}</code>) — publishing now publishes THAT run&apos;s
          content, not this page&apos;s.
        </p>
      )}
      <PublishButton
        episodeId={row!.id}
        episodeFolder={episodeFolder}
        runFolder={runFolder}
        episodeNumber={episodeNumber}
        worldId={worldId}
        label={alreadyPublishedThisContent ? 'Re-publish (no changes)' : row!.publishedAt ? 'Publish latest content (replaces live)' : 'Publish'}
      />
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default async function RunPage({
  params
}: {
  params: Promise<{ episode: string; run: string }>;
}) {
  const { episode, run } = await params;
  const detail = getRun(decodeURIComponent(episode), decodeURIComponent(run));
  if (!detail) notFound();
  
  const manifest = detail.manifest as any;
  
  return (
    <main className="container">
      <div className="crumbs">
        <Link href="/">runs</Link> / {detail.episodeFolder} / {detail.runFolder}
      </div>
      
      <div className="top-row" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <h1 className="page-title" style={{ margin: 0 }}>{detail.episodeTitle || detail.episodeFolder}</h1>
        <StatusBadge status={detail.finalStatus} />
      </div>
      <div className="verdict-row">
        <VerdictBadges verdicts={detail.verdicts} />
      </div>
      
      <div className="grid">
        <div className="stat">
          <div className="label">Duration</div>
          <div className="value">{detail.totalSeconds != null ? `${(detail.totalSeconds / 60).toFixed(1)} min` : '—'}</div>
        </div>
        <div className="stat">
          <div className="label">Tokens</div>
          <div className="value">{detail.totalTokens != null ? detail.totalTokens.toLocaleString() : '—'}</div>
        </div>
        <div className="stat">
          <div className="label">Revision iterations</div>
          <div className="value">{detail.revisionCount}</div>
        </div>
        <div className="stat">
          <div className="label">Model</div>
          <div className="value small">{detail.model || '—'}</div>
        </div>
      </div>
      
      <div className="section">
        <h2>Publish</h2>
        <PublishSection
          episodeFolder={detail.episodeFolder}
          runFolder={detail.runFolder}
          worldId={manifest?.episode?.world}
          episodeNumber={manifest?.episode?.number}
        />
      </div>
      
      {manifest?.roster && (
        <div className="section">
          <h2>Roster</h2>
          <div className="verdict-row">
            {manifest.roster.map((c: any) => (
              <span key={c.id} className={`badge ${c.active === false ? 'dim' : 'good'}`}>
                {c.name} ({c.id}){c.active === false ? ' — inactive' : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {manifest?.revisions?.length > 0 && (
        <div className="section">
          <h2>Revision history</h2>
          {manifest.revisions.map((rev: any) => (
            <div key={rev.iteration} className="run-card" style={{ cursor: 'default' }}>
              <div className="top-row">
                <span className="title">Iteration {rev.iteration}</span>
                <span className="badge dim">{(rev.actions || []).join(' + ') || 'no action'}</span>
              </div>
              <div className="meta">
                <span>failing before: <b>{(rev.failingBefore || []).join(', ') || '—'}</b></span>
              </div>
              {rev.verdictsAfter && (
                <div className="verdict-row">
                  <VerdictBadges verdicts={rev.verdictsAfter} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {detail.boundScript ? (
        <div className="section">
          <h2>📜 Bound script</h2>
          <div className="script">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{detail.boundScript}</ReactMarkdown>
          </div>
        </div>
      ) : (
        <div className="section">
          <h2>📜 Bound script</h2>
          <p className="page-sub">
            None in this run folder. Bind it retroactively with <code>npm run bind:script {`output/episodes/${detail.episodeFolder}/${detail.runFolder}`}</code>.
          </p>
        </div>
      )}
      
      <div className="section">
        <h2>Artifacts</h2>
        <table className="files">
          <tbody>
            {detail.files.map(file => (
              <tr key={file.name}>
                <td>
                  <Link href={`/runs/${encodeURIComponent(detail.episodeFolder)}/${encodeURIComponent(detail.runFolder)}/artifact/${encodeURIComponent(file.name)}`}>
                    {file.name}
                  </Link>
                </td>
                <td className="size">{formatBytes(file.bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
