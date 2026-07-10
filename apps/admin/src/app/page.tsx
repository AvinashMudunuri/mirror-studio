import Link from 'next/link';
import { listRuns, runFolderPath } from '@/lib/runs';
import { getPool } from '@/lib/db';
import { listPublishedRunIndex, publishLabelForRun } from '@/lib/publish';
import { StatusBadge, VerdictBadges, PublishBadge } from '@/components/badges';

export const dynamic = 'force-dynamic';

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  return `${(seconds / 60).toFixed(1)} min`;
}

function formatTokens(tokens: number | null): string {
  if (tokens == null) return '—';
  return tokens.toLocaleString();
}

function formatDate(iso: string | null, fallbackRunFolder: string): string {
  if (iso) return new Date(iso).toUTCString().replace(' GMT', ' UTC');
  const match = fallbackRunFolder.match(/^run-(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})/);
  return match ? `${match[1]} ${match[2]}:${match[3]} UTC` : '—';
}

export default async function DashboardPage() {
  const runs = listRuns();
  const pool = getPool();
  const publishIndex = pool ? await listPublishedRunIndex(pool) : [];
  const liveCount = publishIndex.filter(e => e.publishedRunFolder).length;

  return (
    <main className="container">
      <h1 className="page-title">Episode Runs</h1>
      <p className="page-sub">
        {runs.length} run{runs.length === 1 ? '' : 's'} under <code>output/episodes/</code> — newest first.
        This list is every filesystem run (source of truth for content).
        {pool ? (
          <> <strong>LIVE</strong> = what the player serves ({liveCount} episode{liveCount === 1 ? '' : 's'} published).</>
        ) : (
          <> Set <code>DATABASE_URL</code> to show publish status.</>
        )}
      </p>

      {runs.length === 0 && (
        <div className="empty">
          No runs found. Generate one with <code>npm run real:episode</code>.
        </div>
      )}

      {runs.map(run => {
        const runPath = runFolderPath(run.episodeFolder, run.runFolder);
        const publishLabel = pool ? publishLabelForRun(runPath, publishIndex) : null;

        return (
          <Link
            key={`${run.episodeFolder}/${run.runFolder}`}
            href={`/runs/${encodeURIComponent(run.episodeFolder)}/${encodeURIComponent(run.runFolder)}`}
            className="run-card"
          >
            <div className="top-row">
              <span className="title">
                {run.episodeTitle || run.episodeFolder}{' '}
                {run.episodeNumber != null && (
                  <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>ep {run.episodeNumber}</span>
                )}{' '}
                <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>· {run.runFolder.replace('run-', '')}</span>
              </span>
              <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <PublishBadge label={publishLabel} />
                <StatusBadge status={run.finalStatus} />
              </span>
            </div>
            <div className="verdict-row">
              <VerdictBadges verdicts={run.verdicts} />
            </div>
            <div className="meta">
              <span>started <b>{formatDate(run.startedAt, run.runFolder)}</b></span>
              <span>duration <b>{formatDuration(run.totalSeconds)}</b></span>
              <span>tokens <b>{formatTokens(run.totalTokens)}</b></span>
              <span>revisions <b>{run.revisionCount}</b></span>
              <span>{run.hasBoundScript ? '📜 bound script' : 'no bound script'}</span>
            </div>
          </Link>
        );
      })}
    </main>
  );
}
