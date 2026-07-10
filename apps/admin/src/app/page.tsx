import Link from 'next/link';
import { listRuns, runFolderPath } from '@/lib/runs';
import { getPool } from '@/lib/db';
import {
  listPublishedRunIndex,
  publishLabelForRun,
  parseRunListFilter,
  matchesRunListFilter
} from '@/lib/publish';
import { StatusBadge, VerdictBadges, PublishBadge } from '@/components/badges';
import { RunListFilters } from './run-list-filters';

export const dynamic = 'force-dynamic';

type DashboardPageProps = {
  searchParams?: Promise<{ filter?: string }>;
};

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

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = (await searchParams) ?? {};
  const filter = parseRunListFilter(params.filter);
  const allRuns = listRuns();
  const pool = getPool();
  const hasDatabase = pool != null;
  const publishIndex = pool ? await listPublishedRunIndex(pool) : [];
  const liveCount = publishIndex.filter(e => e.publishedRunFolder).length;

  const runsWithLabels = allRuns.map(run => {
    const runPath = runFolderPath(run.episodeFolder, run.runFolder);
    const publishLabel = pool ? publishLabelForRun(runPath, publishIndex) : null;
    return { run, runPath, publishLabel };
  });

  const visibleRuns = runsWithLabels.filter(({ publishLabel }) =>
    matchesRunListFilter(publishLabel, filter, hasDatabase)
  );

  const filterDescription =
    filter === 'published'
      ? 'Showing LIVE runs only — what the player serves.'
      : filter === 'current'
        ? 'Showing LIVE and latest unpublished (ready to publish).'
        : 'Showing every run folder under output/episodes/.';

  return (
    <main className="container">
      <h1 className="page-title">Episode Runs</h1>
      <p className="page-sub">
        {filterDescription}
        {hasDatabase ? (
          <> {liveCount} episode{liveCount === 1 ? '' : 's'} published.</>
        ) : (
          <> Set <code>DATABASE_URL</code> to filter by publish status — showing all runs.</>
        )}
      </p>

      <RunListFilters active={hasDatabase ? filter : 'all'} hasDatabase={hasDatabase} />

      {visibleRuns.length === 0 && (
        <div className="empty">
          {filter === 'published' && hasDatabase
            ? 'No published runs yet. Open an APPROVED run and click Publish.'
            : filter === 'current' && hasDatabase
              ? 'No current runs. Publish an episode or persist a new run.'
              : 'No runs found. Generate one with npm run real:episode.'}
        </div>
      )}

      {visibleRuns.map(({ run, publishLabel }) => (
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
      ))}
    </main>
  );
}
