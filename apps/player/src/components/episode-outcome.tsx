'use client';

import Link from 'next/link';
import { useState } from 'react';
import { reflectionPromptForThemes } from '@/lib/reflection-prompts';

interface EpisodeOutcomeProps {
  title: string;
  worldId: string;
  nextEpisodeNumber: number | null;
  themes: string[];
  endingSceneTitle?: string;
  endingBranchName?: string;
  choiceOutcomes?: string[];
  choiceCount: number;
  reflectionText: string;
  onReflectionChange: (text: string) => void;
  onSaveReflection: () => void;
  onPlayAgain: () => void;
  saving?: boolean;
}

export function EpisodeOutcome({
  title,
  worldId,
  nextEpisodeNumber,
  themes,
  endingSceneTitle,
  endingBranchName,
  choiceOutcomes,
  choiceCount,
  reflectionText,
  onReflectionChange,
  onSaveReflection,
  onPlayAgain,
  saving
}: EpisodeOutcomeProps) {
  const [showReflection, setShowReflection] = useState(true);
  const headline = endingSceneTitle || endingBranchName || 'Your path through this story';
  const prompt = reflectionPromptForThemes(themes);
  const leans = choiceOutcomes?.filter(Boolean) ?? [];

  return (
    <div className="outcome-screen">
      <p className="outcome-eyebrow">Episode complete</p>
      <h2 className="outcome-title">{headline}</h2>
      <p className="outcome-sub">
        You made <strong>{choiceCount}</strong> choice{choiceCount === 1 ? '' : 's'} in{' '}
        <em>{title}</em>. This was one path through the story — not a test, and not the only
        way to play it.
      </p>

      {leans.length > 0 && (
        <div className="outcome-leans">
          <span className="outcome-leans-label">On this path, the story touched on</span>
          <ul className="outcome-leans-list">
            {leans.map(lean => (
              <li key={lean}>{lean}</li>
            ))}
          </ul>
          <p className="outcome-leans-note">
            That describes this playthrough, not you. Replay anytime to try a different path.
          </p>
        </div>
      )}

      {themes.length > 0 && (
        <div className="outcome-themes">
          <span className="outcome-themes-label">Themes in this episode</span>
          <div className="theme-chips">
            {themes.map(theme => (
              <span key={theme} className="theme-chip">{theme}</span>
            ))}
          </div>
        </div>
      )}

      {showReflection ? (
        <div className="reflection-block">
          <div className="reflection-block-header">
            <label className="reflection-label" htmlFor="reflection-input">
              {prompt}
            </label>
            <button
              type="button"
              className="reflection-skip"
              onClick={() => setShowReflection(false)}
            >
              Skip for now
            </button>
          </div>
          <p className="reflection-optional-note">
            Totally optional. Nothing here is graded, scored, or shared with anyone.
          </p>
          <textarea
            id="reflection-input"
            className="reflection-input"
            rows={4}
            placeholder="Only if you want to — your notes stay on this device."
            value={reflectionText}
            onChange={e => onReflectionChange(e.target.value)}
            onBlur={onSaveReflection}
          />
          {saving && <p className="reflection-hint">Saving…</p>}
        </div>
      ) : (
        <p className="reflection-skipped-note">
          Reflection skipped — you can always replay and jot something down later.
        </p>
      )}

      <div className="outcome-actions">
        {nextEpisodeNumber != null && (
          <Link href={`/play/${worldId}/${nextEpisodeNumber}`} className="primary-link">
            Next episode →
          </Link>
        )}
        <button type="button" className="secondary" onClick={onPlayAgain}>
          Try a different path
        </button>
        <Link href="/" className="secondary-link">
          Back to browse
        </Link>
      </div>
    </div>
  );
}
