'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  resolveBranchLines,
  type PlayerChoiceOption,
  type PlayerDialogueLine,
  type PlayerEpisode,
  type PlayerScene
} from '@mirror/schemas';

interface TranscriptEntry {
  key: string;
  speaker: string;
  text: string;
  action?: string;
}

interface EpisodePlayerProps {
  episode: PlayerEpisode;
  title: string;
  synopsis: string;
}

function speakerLabel(character: string, episode: PlayerEpisode): string {
  if (character === 'player') return episode.protagonist.name;
  if (character === 'NARRATOR') return 'Narrator';
  if (character === 'INTERNAL') return 'Inner voice';
  const cast = episode.characters.find(c => c.id === character);
  return cast?.name || character;
}

function lineEntries(lines: PlayerDialogueLine[], episode: PlayerEpisode, prefix: string): TranscriptEntry[] {
  return lines.map(line => ({
    key: `${prefix}-${line.id}`,
    speaker: speakerLabel(line.character, episode),
    text: line.text,
    action: line.action
  }));
}

function sceneBundle(scene: PlayerScene, choiceHistory: string[], episode: PlayerEpisode) {
  const branchLines = resolveBranchLines(scene.branchVariants, choiceHistory, episode.branches);
  return [...scene.lines, ...branchLines];
}

export function EpisodePlayer({ episode, title, synopsis }: EpisodePlayerProps) {
  const sceneMap = useMemo(() => new Map(episode.scenes.map(s => [s.id, s])), [episode.scenes]);

  const [sceneId, setSceneId] = useState(episode.startSceneId);
  const [choiceHistory, setChoiceHistory] = useState<string[]>([]);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [awaitingChoice, setAwaitingChoice] = useState(false);
  const [finished, setFinished] = useState(false);
  const [visited, setVisited] = useState<Set<string>>(() => new Set());

  const currentScene = sceneMap.get(sceneId);

  const appendLines = useCallback((lines: PlayerDialogueLine[], prefix: string) => {
    if (!lines.length) return;
    setTranscript(prev => [...prev, ...lineEntries(lines, episode, prefix)]);
  }, [episode]);

  const enterScene = useCallback((nextSceneId: string, history: string[]) => {
    const scene = sceneMap.get(nextSceneId);
    if (!scene) {
      setFinished(true);
      return;
    }

    setSceneId(nextSceneId);
    setVisited(prev => new Set(prev).add(nextSceneId));

    const lines = sceneBundle(scene, history, episode);
    appendLines(lines, nextSceneId);

    if (scene.transition.type === 'choice') {
      setAwaitingChoice(true);
      return;
    }

    if (scene.transition.type === 'end') {
      setFinished(true);
      setAwaitingChoice(false);
      return;
    }

    setAwaitingChoice(false);
  }, [appendLines, episode, sceneMap]);

  const startEpisode = useCallback(() => {
    setSceneId(episode.startSceneId);
    setChoiceHistory([]);
    setTranscript([]);
    setAwaitingChoice(false);
    setFinished(false);
    setVisited(new Set([episode.startSceneId]));
    const first = sceneMap.get(episode.startSceneId);
    if (!first) return;
    appendLines(sceneBundle(first, [], episode), episode.startSceneId);
    setAwaitingChoice(first.transition.type === 'choice');
    if (first.transition.type === 'end') setFinished(true);
  }, [appendLines, episode, sceneMap]);

  const continueLinear = useCallback(() => {
    if (!currentScene || currentScene.transition.type !== 'linear') return;
    enterScene(currentScene.transition.nextSceneId, choiceHistory);
  }, [choiceHistory, currentScene, enterScene]);

  const pickOption = useCallback((option: PlayerChoiceOption, choiceId: string) => {
    if (!currentScene || currentScene.transition.type !== 'choice') return;
    const path = `${choiceId}:${option.id}`;
    const nextHistory = [...choiceHistory, path];
    setChoiceHistory(nextHistory);
    setAwaitingChoice(false);
    appendLines(option.responseLines, `${sceneId}-${path}`);
    if (option.nextSceneId === 'END') {
      setFinished(true);
      return;
    }
    enterScene(option.nextSceneId, nextHistory);
  }, [appendLines, choiceHistory, currentScene, enterScene, sceneId]);

  const hasStarted = transcript.length > 0;

  return (
    <div className="player-shell">
      <header className="player-header">
        <div>
          <h1>{title}</h1>
          <p className="synopsis">{synopsis}</p>
        </div>
        <div className="player-meta">
          <span className="pill">Playing as {episode.protagonist.name}</span>
          {finished && <span className="pill done">Complete</span>}
        </div>
      </header>

      {!hasStarted ? (
        <div className="player-start">
          <p>This is a playable preview of published episode content — choices branch the story, endings reflect your path.</p>
          <button type="button" className="primary" onClick={startEpisode}>Begin episode</button>
        </div>
      ) : (
        <>
          <div className="transcript" aria-live="polite">
            {transcript.map(entry => (
              <div key={entry.key} className="line">
                <div className="speaker">{entry.speaker}</div>
                <div className="text">{entry.text}</div>
                {entry.action && <div className="action">*{entry.action}*</div>}
              </div>
            ))}
          </div>

          <footer className="player-controls">
            {finished && (
              <div className="control-block">
                <p className="control-label">You reached an ending.</p>
                <button type="button" className="secondary" onClick={startEpisode}>Play again</button>
              </div>
            )}

            {!finished && awaitingChoice && currentScene?.transition.type === 'choice' && (
              <div className="control-block">
                <p className="control-label">{currentScene.transition.choice.prompt}</p>
                {currentScene.transition.choice.context && (
                  <p className="control-context">{currentScene.transition.choice.context}</p>
                )}
                <div className="choice-list">
                  {currentScene.transition.choice.options.map(option => (
                    <button
                      key={option.id}
                      type="button"
                      className="choice"
                      onClick={() => pickOption(option, currentScene.transition.type === 'choice' ? currentScene.transition.choice.id : '')}
                    >
                      {option.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!finished && !awaitingChoice && currentScene?.transition.type === 'linear' && (
              <div className="control-block">
                <button type="button" className="primary" onClick={continueLinear}>Continue</button>
              </div>
            )}
          </footer>
        </>
      )}

      {hasStarted && (
        <aside className="debug-strip">
          Scene: {sceneId} · Choices: {choiceHistory.length} · Visited: {visited.size}
        </aside>
      )}
    </div>
  );
}
