'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const REVIEWER_OPTIONS = [
  { key: 'creativeDirector', label: 'Creative Director' },
  { key: 'qaReviewer', label: 'QA Reviewer' },
  { key: 'childPsychologist', label: 'Child Psychologist' },
  { key: 'gameDesigner', label: 'Game Designer' },
  { key: 'ethicsReviewer', label: 'Ethics Reviewer' }
];

const TRAIT_OPTIONS = [
  'EMPATHY', 'LEADERSHIP', 'RESILIENCE', 'CURIOSITY', 'INTEGRITY',
  'COMMUNICATION', 'ADAPTABILITY', 'CONFIDENCE', 'JUDGMENT', 'EMOTIONAL_AWARENESS'
];

/** Reviewers whose model can be escalated past the haiku default — see docs/OPEN-QUESTIONS.md item 4. */
const ESCALATABLE_REVIEWERS = [
  { key: 'QA_REVIEWER', label: 'QA Reviewer' },
  { key: 'GAME_DESIGNER', label: 'Game Designer' },
  { key: 'ETHICS_REVIEWER', label: 'Ethics Reviewer' }
];

type JobStatus = 'running' | 'completed' | 'failed' | 'cancelled';

interface JobSummary {
  id: string;
  status: JobStatus;
  runFolderHint: string | null;
  exitCode: number | null;
}

/** "output/episodes/episode-01-first-day/run-2026-07-08_06-52-52" -> { episodeFolder, runFolder } */
function parseRunFolderHint(hint: string): { episodeFolder: string; runFolder: string } | null {
  const match = hint.match(/output[\\/]episodes[\\/]([^\\/]+)[\\/]([^\\/]+)\/?$/);
  if (!match) return null;
  return { episodeFolder: match[1], runFolder: match[2] };
}

export function GenerateForm() {
  const [episodeNumber, setEpisodeNumber] = useState('1');
  const [useCustomBrief, setUseCustomBrief] = useState(false);
  const [world, setWorld] = useState('New School');
  const [worldId, setWorldId] = useState('NEW_SCHOOL');
  const [season, setSeason] = useState('Season 1: First Year');
  const [title, setTitle] = useState('');
  const [themes, setThemes] = useState('');
  const [traits, setTraits] = useState<string[]>([]);
  const [synopsis, setSynopsis] = useState('');

  const [maxRunTokens, setMaxRunTokens] = useState('800000');
  const [maxRevisionIterations, setMaxRevisionIterations] = useState('3');
  const [skipReviewers, setSkipReviewers] = useState<string[]>([]);
  const [reviewerModels, setReviewerModels] = useState<Record<string, string>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [job, setJob] = useState<JobSummary | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const consoleRef = useRef<HTMLPreElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  function attachToJob(jobId: string) {
    eventSourceRef.current?.close();
    setLines([]);
    const es = new EventSource(`/api/generate/${jobId}/stream`);
    eventSourceRef.current = es;

    es.addEventListener('log', (event) => {
      const line = JSON.parse((event as MessageEvent).data);
      setLines(prev => [...prev, line]);
    });
    es.addEventListener('status', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      setJob(prev => (prev ? { ...prev, status: data.status, runFolderHint: data.runFolderHint, exitCode: data.exitCode } : prev));
    });
    es.addEventListener('done', () => {
      es.close();
    });
    es.onerror = () => {
      // The stream closes itself normally on completion (see 'done'); a
      // genuine connection error just means no live updates until refresh.
      es.close();
    };
  }

  // On mount, reconnect to an already-running job (e.g. after a page refresh).
  useEffect(() => {
    fetch('/api/generate')
      .then(res => res.json())
      .then((data: { running: JobSummary | null }) => {
        if (data.running) {
          setJob(data.running);
          attachToJob(data.running.id);
        }
      })
      .catch(() => {});
    return () => {
      eventSourceRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    consoleRef.current?.scrollTo({ top: consoleRef.current.scrollHeight });
  }, [lines]);

  const isRunning = job?.status === 'running';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setStarting(true);

    const body: Record<string, unknown> = {
      episodeNumber: Number(episodeNumber)
    };
    if (useCustomBrief) {
      body.brief = {
        world, worldId, season, title,
        themes: themes.split(',').map(t => t.trim()).filter(Boolean),
        targetTraits: traits,
        synopsis
      };
    }
    if (maxRunTokens !== '') body.maxRunTokens = Number(maxRunTokens);
    if (maxRevisionIterations !== '') body.maxRevisionIterations = Number(maxRevisionIterations);
    if (skipReviewers.length > 0) body.skipReviewers = skipReviewers;
    const overrides = Object.fromEntries(Object.entries(reviewerModels).filter(([, v]) => v.trim()));
    if (Object.keys(overrides).length > 0) body.reviewerModelOverrides = overrides;

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || 'Failed to start generation.');
        return;
      }
      setJob({ id: data.id, status: data.status, runFolderHint: data.runFolderHint, exitCode: data.exitCode });
      attachToJob(data.id);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
    } finally {
      setStarting(false);
    }
  }

  async function handleCancel() {
    if (!job) return;
    await fetch(`/api/generate/${job.id}`, { method: 'DELETE' });
  }

  const parsedRun = job?.runFolderHint ? parseRunFolderHint(job.runFolderHint) : null;
  // The run folder path is known (printed) before the directory actually
  // has any files in it — a "Saved:" line is the first real proof
  // something is on disk there, so the link doesn't 404 if clicked in
  // that narrow window right after the run starts.
  const runFolderLikelyExists = !isRunning || lines.some(l => l.includes('💾 Saved:'));

  return (
    <div>
      <form onSubmit={handleSubmit} className="generate-form">
        <div className="field">
          <label htmlFor="episodeNumber">Episode number</label>
          <input
            id="episodeNumber" type="number" min={1} required
            value={episodeNumber} onChange={e => setEpisodeNumber(e.target.value)}
            disabled={isRunning}
          />
          <span className="hint">Selects which episode brief to generate, and which earlier APPROVED episode(s) feed continuity.</span>
        </div>

        <div className="field checkbox-field">
          <label>
            <input type="checkbox" checked={useCustomBrief} onChange={e => setUseCustomBrief(e.target.checked)} disabled={isRunning} />
            {' '}Write a custom brief (otherwise uses the built-in brief for this episode number, if one exists)
          </label>
        </div>

        {useCustomBrief && (
          <fieldset className="brief-fields">
            <div className="field-row">
              <div className="field">
                <label htmlFor="world">World</label>
                <input id="world" value={world} onChange={e => setWorld(e.target.value)} disabled={isRunning} required />
              </div>
              <div className="field">
                <label htmlFor="worldId">World id</label>
                <input id="worldId" value={worldId} onChange={e => setWorldId(e.target.value)} disabled={isRunning} required />
              </div>
              <div className="field">
                <label htmlFor="season">Season</label>
                <input id="season" value={season} onChange={e => setSeason(e.target.value)} disabled={isRunning} required />
              </div>
            </div>
            <div className="field">
              <label htmlFor="title">Title</label>
              <input id="title" value={title} onChange={e => setTitle(e.target.value)} disabled={isRunning} required placeholder="e.g. The Group Project" />
            </div>
            <div className="field">
              <label htmlFor="themes">Themes (comma-separated)</label>
              <input id="themes" value={themes} onChange={e => setThemes(e.target.value)} disabled={isRunning} required placeholder="e.g. Peer Pressure, Honesty, Teamwork" />
            </div>
            <div className="field">
              <label>Target traits</label>
              <div className="trait-grid">
                {TRAIT_OPTIONS.map(t => (
                  <label key={t} className="trait-checkbox">
                    <input
                      type="checkbox" disabled={isRunning}
                      checked={traits.includes(t)}
                      onChange={e => setTraits(prev => e.target.checked ? [...prev, t] : prev.filter(x => x !== t))}
                    />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="synopsis">Synopsis</label>
              <textarea id="synopsis" value={synopsis} onChange={e => setSynopsis(e.target.value)} disabled={isRunning} required rows={4} />
            </div>
          </fieldset>
        )}

        <div className="field-row">
          <div className="field">
            <label htmlFor="maxRunTokens">Max run tokens</label>
            <input id="maxRunTokens" type="number" min={0} value={maxRunTokens} onChange={e => setMaxRunTokens(e.target.value)} disabled={isRunning} />
            <span className="hint">0 = unlimited. The run stops with BUDGET_EXCEEDED if this is hit.</span>
          </div>
          <div className="field">
            <label htmlFor="maxRevisionIterations">Max revision iterations</label>
            <input id="maxRevisionIterations" type="number" min={0} value={maxRevisionIterations} onChange={e => setMaxRevisionIterations(e.target.value)} disabled={isRunning} />
          </div>
        </div>

        <div className="field">
          <label>Skip reviewers (dev-mode — a run that skips any reviewer can never be published, see ADR 003)</label>
          <div className="trait-grid">
            {REVIEWER_OPTIONS.map(r => (
              <label key={r.key} className="trait-checkbox">
                <input
                  type="checkbox" disabled={isRunning}
                  checked={skipReviewers.includes(r.key)}
                  onChange={e => setSkipReviewers(prev => e.target.checked ? [...prev, r.key] : prev.filter(x => x !== r.key))}
                />
                {r.label}
              </label>
            ))}
          </div>
        </div>

        <details className="advanced" open={advancedOpen} onToggle={e => setAdvancedOpen((e.target as HTMLDetailsElement).open)}>
          <summary>Advanced: reviewer model overrides</summary>
          <p className="hint">
            QA Reviewer (and to a lesser extent Game Designer) has been observed fabricating findings on
            the default haiku model against complex episodes — see docs/OPEN-QUESTIONS.md item 4. Leave
            blank to use the configured default for each.
          </p>
          <div className="field-row">
            {ESCALATABLE_REVIEWERS.map(r => (
              <div className="field" key={r.key}>
                <label htmlFor={`model-${r.key}`}>{r.label} model</label>
                <input
                  id={`model-${r.key}`} disabled={isRunning}
                  placeholder="default (haiku)"
                  value={reviewerModels[r.key] ?? ''}
                  onChange={e => setReviewerModels(prev => ({ ...prev, [r.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </details>

        <div className="field-row submit-row">
          <button type="submit" className="btn btn-primary" disabled={isRunning || starting}>
            {starting ? 'Starting…' : isRunning ? 'Generation in progress…' : 'Start generation'}
          </button>
          {isRunning && (
            <button type="button" className="btn btn-danger" onClick={handleCancel}>
              Cancel run
            </button>
          )}
          {submitError && <span className="publish-error">{submitError}</span>}
        </div>
      </form>

      {job && (
        <div className="section">
          <h2>Console</h2>
          <div className="job-status-row">
            <span className={`badge ${job.status === 'completed' ? 'good' : job.status === 'running' ? 'warn' : 'bad'}`}>
              {job.status}
            </span>
            {job.exitCode !== null && <span className="hint">exit code {job.exitCode}</span>}
            {parsedRun && runFolderLikelyExists && (
              <Link href={`/runs/${encodeURIComponent(parsedRun.episodeFolder)}/${encodeURIComponent(parsedRun.runFolder)}`} className="btn">
                View run →
              </Link>
            )}
            {parsedRun && !runFolderLikelyExists && (
              <span className="hint">Run folder created — waiting for first artifact before linking…</span>
            )}
          </div>
          <pre ref={consoleRef} className="console">
            {lines.join('\n') || (isRunning ? 'Waiting for output…' : '')}
          </pre>
        </div>
      )}
    </div>
  );
}
