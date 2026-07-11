'use client';

import Link from 'next/link';
import { reflectionPromptForThemes } from '@/lib/reflection-prompts';

interface EpisodeOutcomeProps {
  title: string;
  themes: string[];
  endingSceneTitle?: string;
  endingBranchName?: string;
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
  episodeNumber,
  themes,
  endingSceneTitle,
  endingBranchName,
  choiceCount,
  reflectionText,
  onReflectionChange,
  onSaveReflection,
  onPlayAgain,
  saving
}: EpisodeOutcomeProps) {
  const headline = endingSceneTitle || endingBranchName || 'Your path through this story';
  const prompt = reflectionPromptForThemes(themes);

  return (
    <div className="outcome-screen">
      <p className="outcome-eyebrow">Episode complete</p>
      <h2 className="outcome-title">{headline}</h2>
      <p className="outcome-sub">
        You made <strong>{choiceCount}</strong> choice{choiceCount === 1 ? '' : 's'} in{' '}
        <em>{title}</em>. Every path is different — this one is yours.
      </p>

      {themes.length > 0 && (
        <div className="outcome-themes">
          <span className="outcome-themes-label">This episode explored</span>
          <div className="theme-chips">
            {themes.map(theme => (
              <span key={theme} className="theme-chip">{theme}</span>
            ))}
          </div>
        </div>
      )}

      <div className="reflection-block">
        <label className="reflection-label" htmlFor="reflection-input">
          {prompt}
        </label>
        <textarea
          id="reflection-input"
          className="reflection-input"
          rows={4}
          placeholder="Optional — just for you. Nothing here is graded or shared."
          value={reflectionText}
          onChange={e => onReflectionChange(e.target.value)}
          onBlur={onSaveReflection}
        />
        {saving && <p className="reflection-hint">Saving…</p>}
      </div>

      <div className="outcome-actions">
        <button type="button" className="secondary" onClick={onPlayAgain}>
          Play this episode again
        </button>
        <Link href="/" className="primary-link">
          Back to episodes
        </Link>
      </div>
    </div>
  );
}
