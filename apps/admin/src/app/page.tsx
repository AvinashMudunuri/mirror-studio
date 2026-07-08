import Link from 'next/link';
import { listRuns } from '@/lib/runs';
import { StatusBadge, VerdictBadges } from '@/components/badges';

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
  // Older runs: parse the folder timestamp run-YYYY-MM-DD_HH-MM-SS
  const match = fallbackRunFolder.match(/^run-(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})/);
  return match ? `${match[1]} ${match[2]}:${match[3]} UTC` : '—';
}

export default function DashboardPage() {
  const runs = listRuns();
  
  return (
    <main className="container">
      <h1 className="page-title">Episode Runs</h1>
      <p className="page-sub">
        {runs.length} run{runs.length === 1 ? '' : 's'} under <code>output/episodes/</code> — newest first.
        The run folder is the source of truth for content; publishing (making an approved episode available to a frontend) is the one write action this dashboard supports.
      </p>
      
      {runs.length === 0 && (
        <div className="empty">
          No runs found. Generate one with <code>npm run real:episode</code>.
        </div>
      )}
      
      {runs.map(run => (
        <Link
          key={`${run.episodeFolder}/${run.runFolder}`}
          href={`/runs/${encodeURIComponent(run.episodeFolder)}/${encodeURIComponent(run.runFolder)}`}
          className="run-card"
        >
          <div className="top-row">
            <span className="title">
              {run.episodeTitle || run.episodeFolder} <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>· {run.runFolder.replace('run-', '')}</span>
            </span>
            <StatusBadge status={run.finalStatus} />
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
