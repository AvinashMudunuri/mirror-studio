/** Verdict/status badges with consistent traffic-light semantics. */

const STATUS_TONE: Record<string, 'good' | 'warn' | 'bad' | 'dim'> = {
  // run finalStatus
  APPROVED: 'good',
  NEEDS_HUMAN_REVIEW: 'warn',
  BUDGET_EXCEEDED: 'bad',
  LEGACY: 'dim',
  INCOMPLETE: 'dim',
  // reviewer verdicts
  PASS: 'good',
  EXCELLENT: 'good',
  GOOD: 'good',
  NEEDS_REVISION: 'warn',
  NEEDS_WORK: 'warn',
  IN_REVIEW: 'warn',
  FAIL: 'bad',
  REJECTED: 'bad',
  POOR: 'bad',
  UNACCEPTABLE: 'bad',
  SKIPPED: 'dim'
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] || 'dim';
  return <span className={`badge ${tone}`}>{status.replace(/_/g, ' ')}</span>;
}

const REVIEWER_LABEL: Record<string, string> = {
  creativeDirector: 'Creative',
  qaReviewer: 'QA',
  childPsychologist: 'Psych',
  gameDesigner: 'Game',
  ethicsReviewer: 'Ethics'
};

export function VerdictBadges({ verdicts }: { verdicts: Record<string, string> }) {
  const entries = Object.entries(verdicts);
  if (entries.length === 0) return <span className="badge dim">no reviews</span>;
  return (
    <>
      {entries.map(([reviewer, verdict]) => {
        const tone = STATUS_TONE[verdict] || 'dim';
        return (
          <span key={reviewer} className={`badge ${tone}`}>
            {REVIEWER_LABEL[reviewer] || reviewer}: {verdict.replace(/_/g, ' ')}
          </span>
        );
      })}
    </>
  );
}

const PUBLISH_LABEL_TONE: Record<string, 'good' | 'warn' | 'dim'> = {
  live: 'good',
  latest: 'warn',
  not_published: 'dim'
};

const PUBLISH_LABEL_TEXT: Record<string, string> = {
  live: 'LIVE',
  latest: 'latest (unpublished)',
  not_published: 'not published'
};

/** Whether this run folder is live on the player, latest in Postgres, or filesystem-only. */
export function PublishBadge({ label }: { label: 'live' | 'latest' | 'not_published' | null }) {
  if (!label) return null;
  const tone = PUBLISH_LABEL_TONE[label] || 'dim';
  return <span className={`badge ${tone}`}>{PUBLISH_LABEL_TEXT[label]}</span>;
}
