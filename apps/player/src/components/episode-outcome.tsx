'use client';

import Link from 'next/link';

interface EpisodeOutcomeProps {
  title: string;
  worldId: string;
  nextEpisodeNumber: number | null;
  nextEpisodeTitle?: string | null;
  endingSceneTitle?: string;
  endingBranchName?: string;
  endingBranchOutcome?: string;
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
  nextEpisodeTitle,
  endingSceneTitle,
  endingBranchName,
  endingBranchOutcome,
  choiceOutcomes,
  choiceCount,
  reflectionText,
  onReflectionChange,
  onSaveReflection,
  onPlayAgain,
  saving
}: EpisodeOutcomeProps) {
  const headline = endingSceneTitle || endingBranchName || 'Your path through this story';
  const storyBeats = choiceOutcomes?.filter(Boolean) ?? [];
  const nextLabel =
    nextEpisodeNumber != null
      ? nextEpisodeTitle
        ? `Next: ${nextEpisodeTitle} →`
        : 'Next episode →'
      : null;

  return (
    <div className="outcome-screen">
      <p className="outcome-eyebrow">Episode complete</p>
      <h2 className="outcome-title">{headline}</h2>
      <p className="outcome-sub">
        You made <strong>{choiceCount}</strong> choice{choiceCount === 1 ? '' : 's'} in{' '}
        <em>{title}</em>.
      </p>

      {endingBranchOutcome && (
        <div className="outcome-story">
          <p className="outcome-story-text">{endingBranchOutcome}</p>
        </div>
      )}

      {storyBeats.length > 0 && (
        <div className="outcome-leans">
          <span className="outcome-leans-label">Along the way</span>
          <ul className="outcome-leans-list">
            {storyBeats.map(lean => (
              <li key={lean}>{lean}</li>
            ))}
          </ul>
        </div>
      )}

      <details className="reflection-details">
        <summary className="reflection-summary">Optional — jot a thought</summary>
        <div className="reflection-block">
          <label className="reflection-label" htmlFor="reflection-input">
            Anything stick with you from this path?
          </label>
          <textarea
            id="reflection-input"
            className="reflection-input"
            rows={3}
            placeholder="Just for you. Not graded or shared."
            value={reflectionText}
            onChange={e => onReflectionChange(e.target.value)}
            onBlur={onSaveReflection}
          />
          {saving && <p className="reflection-hint">Saving…</p>}
        </div>
      </details>

      <div className="outcome-actions">
        {nextEpisodeNumber != null && nextLabel && (
          <Link href={`/play/${worldId}/${nextEpisodeNumber}`} className="primary-link">
            {nextLabel}
          </Link>
        )}
        <button type="button" className="secondary" onClick={onPlayAgain}>
          Play this episode again
        </button>
        <Link href="/" className="secondary-link">
          Back to episodes
        </Link>
      </div>
    </div>
  );
}
