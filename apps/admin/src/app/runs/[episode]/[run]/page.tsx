import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getRun } from '@/lib/runs';
import { StatusBadge, VerdictBadges } from '@/components/badges';

export const dynamic = 'force-dynamic';

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
