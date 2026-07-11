'use client';

import Link from 'next/link';
import { useState } from 'react';

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
  // Default hidden: optional reflection without looking like homework (#52 Skip + kid-pacing collapse).
  const [showReflection, setShowReflection] = useState(false);
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
        <em>{title}</em>. This was one path through the story — not a test, and not the only
        way to play it.
      </p>

      {endingBranchOutcome && (
        <div className="outcome-story">
          <p className="outcome-story-text">{endingBranchOutcome}</p>
        </div>
      )}

      {storyBeats.length > 0 && (
        <div className="outcome-leans">
          <span className="outcome-leans-label">On this path, the story touched on</span>
          <ul className="outcome-leans-list">
            {storyBeats.map(lean => (
              <li key={lean}>{lean}</li>
            ))}
          </ul>
          <p className="outcome-leans-note">
            That describes this playthrough, not you. Replay anytime to try a different path.
          </p>
        </div>
      )}

      {showReflection ? (
        <div className="reflection-block">
          <div className="reflection-block-header">
            <label className="reflection-label" htmlFor="reflection-input">
              Anything stick with you from this path?
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
            rows={3}
            placeholder="Only if you want to — your notes stay on this device."
            value={reflectionText}
            onChange={e => onReflectionChange(e.target.value)}
            onBlur={onSaveReflection}
          />
          {saving && <p className="reflection-hint">Saving…</p>}
        </div>
      ) : (
        <p className="reflection-skipped-note">
          <button
            type="button"
            className="reflection-skip"
            onClick={() => setShowReflection(true)}
          >
            Optional — jot a thought
          </button>
        </p>
      )}

      <div className="outcome-actions">
        {nextEpisodeNumber != null && nextLabel && (
          <Link href={`/play/${worldId}/${nextEpisodeNumber}`} className="primary-link">
            {nextLabel}
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
