'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  resolveBranchLines,
  resolvePrimaryEndingBranch,
  summarizeChoiceOutcomes,
  type PlayerChoiceOption,
  type PlayerDialogueLine,
  type PlayerEpisode,
  type PlayerProgressPayload
} from '@mirror/schemas';
import { moodClassForLocation } from '@/lib/scene-mood';
import { sceneArtUrl } from '@/lib/scene-art';
import { seasonForWorld } from '@/lib/season-config';
import { EpisodeOutcome } from '@/components/episode-outcome';

type Phase = 'intro' | 'playing' | 'outcome';

interface DisplayLine {
  key: string;
  speaker: string;
  text: string;
  action?: string;
  kind: 'dialogue' | 'narration' | 'thought';
}

interface EpisodePlayerProps {
  episode: PlayerEpisode;
  title: string;
  synopsis: string;
  worldId: string;
  episodeNumber: number;
  initialProgress: PlayerProgressPayload | null;
}

function speakerLabel(character: string, episode: PlayerEpisode): string {
  if (character === 'player') return episode.protagonist.name;
  if (character === 'NARRATOR') return 'Narrator';
  if (character === 'INTERNAL') return 'Inner voice';
  const cast = episode.characters.find(c => c.id === character);
  return cast?.name || character;
}

function lineKind(character: string): DisplayLine['kind'] {
  if (character === 'NARRATOR') return 'narration';
  if (character === 'INTERNAL') return 'thought';
  return 'dialogue';
}

function toDisplayLines(lines: PlayerDialogueLine[], episode: PlayerEpisode, prefix: string): DisplayLine[] {
  return lines.map(line => ({
    key: `${prefix}-${line.id}`,
    speaker: speakerLabel(line.character, episode),
    text: line.text,
    action: line.action,
    kind: lineKind(line.character)
  }));
}

function sceneBundle(scene: PlayerEpisode['scenes'][0], choiceHistory: string[], episode: PlayerEpisode) {
  const branchLines = resolveBranchLines(scene.branchVariants, choiceHistory, episode.branches);
  return [...scene.lines, ...branchLines];
}

export function EpisodePlayer({
  episode,
  title,
  synopsis,
  worldId,
  episodeNumber,
  initialProgress
}: EpisodePlayerProps) {
  const sceneMap = useMemo(() => new Map(episode.scenes.map(s => [s.id, s])), [episode.scenes]);
  const startedAtRef = useRef<number>(Date.now());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase] = useState<Phase>(() =>
    initialProgress?.status === 'completed' ? 'intro' : 'intro'
  );
  const [sceneId, setSceneId] = useState(episode.startSceneId);
  const [choiceHistory, setChoiceHistory] = useState<string[]>([]);
  const [beat, setBeat] = useState<'scene' | 'response'>('scene');
  const [displayLines, setDisplayLines] = useState<DisplayLine[]>([]);
  const [awaitingChoice, setAwaitingChoice] = useState(false);
  const [reflectionText, setReflectionText] = useState(initialProgress?.reflectionText ?? '');
  const [outcomeMeta, setOutcomeMeta] = useState({
    endingSceneTitle: initialProgress?.endingSceneTitle,
    endingBranchName: initialProgress?.endingBranchName,
    choiceOutcomes: initialProgress?.choiceOutcomes ?? [] as string[]
  });
  const [saving, setSaving] = useState(false);
  const [resumeOffer, setResumeOffer] = useState<PlayerProgressPayload | null>(
    initialProgress?.status === 'in_progress' ? initialProgress : null
  );

  const currentScene = sceneMap.get(sceneId);
  const moodClass = currentScene
    ? moodClassForLocation(currentScene.location, currentScene.id)
    : 'mood-neutral';

  const persistProgress = useCallback(
    (payload: PlayerProgressPayload) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await fetch('/api/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ world: worldId, episodeNumber, progress: payload })
          });
        } finally {
          setSaving(false);
        }
      }, 400);
    },
    [worldId, episodeNumber]
  );

  const buildPayload = useCallback(
    (overrides: Partial<PlayerProgressPayload>): PlayerProgressPayload => {
      const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
      return {
        status: 'in_progress',
        choiceHistory,
        currentSceneId: sceneId,
        beat,
        startedAt: new Date(startedAtRef.current).toISOString(),
        playTimeSeconds: elapsed,
        reflectionText,
        ...overrides
      };
    },
    [beat, choiceHistory, reflectionText, sceneId]
  );

  const finishEpisode = useCallback(
    (history: string[], endSceneId: string) => {
      const endScene = sceneMap.get(endSceneId);
      const branch = resolvePrimaryEndingBranch(episode.branches, history);
      const choiceOutcomes = summarizeChoiceOutcomes(episode, history);
      const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
      const meta = {
        endingSceneTitle: endScene?.title,
        endingBranchName: branch?.name,
        choiceOutcomes
      };
      setOutcomeMeta(meta);
      setPhase('outcome');
      setAwaitingChoice(false);

      const completed: PlayerProgressPayload = {
        status: 'completed',
        choiceHistory: history,
        currentSceneId: endSceneId,
        beat: 'scene',
        startedAt: new Date(startedAtRef.current).toISOString(),
        completedAt: new Date().toISOString(),
        playTimeSeconds: elapsed,
        reflectionText,
        ...meta,
        endingBranchId: branch?.id
      };
      persistProgress(completed);
    },
    [episode, persistProgress, reflectionText, sceneMap]
  );

  const showScene = useCallback(
    (nextSceneId: string, history: string[], nextBeat: 'scene' | 'response' = 'scene', pendingPath?: string) => {
      const scene = sceneMap.get(nextSceneId);
      if (!scene) {
        finishEpisode(history, sceneId);
        return;
      }

      setSceneId(nextSceneId);
      setBeat(nextBeat);
      if (nextBeat === 'scene') {
        const lines = sceneBundle(scene, history, episode);
        setDisplayLines(toDisplayLines(lines, episode, nextSceneId));
      }

      if (scene.transition.type === 'choice' && nextBeat === 'scene') {
        setAwaitingChoice(true);
        persistProgress(
          buildPayload({
            choiceHistory: history,
            currentSceneId: nextSceneId,
            beat: 'scene',
            pendingChoicePath: undefined
          })
        );
        return;
      }

      if (scene.transition.type === 'end') {
        finishEpisode(history, nextSceneId);
        return;
      }

      setAwaitingChoice(false);
      persistProgress(
        buildPayload({
          choiceHistory: history,
          currentSceneId: nextSceneId,
          beat: nextBeat,
          pendingChoicePath: pendingPath
        })
      );
    },
    [buildPayload, choiceHistory, episode, finishEpisode, persistProgress, sceneId, sceneMap]
  );

  const startEpisode = useCallback(() => {
    startedAtRef.current = Date.now();
    setChoiceHistory([]);
    setPhase('playing');
    setResumeOffer(null);
    showScene(episode.startSceneId, [], 'scene');
  }, [episode.startSceneId, showScene]);

  const resumeEpisode = useCallback(() => {
    if (!resumeOffer) return;
    startedAtRef.current = Date.now() - (resumeOffer.playTimeSeconds ?? 0) * 1000;
    setPhase('playing');
    setChoiceHistory(resumeOffer.choiceHistory);
    setReflectionText(resumeOffer.reflectionText ?? '');

    if (resumeOffer.beat === 'response' && resumeOffer.pendingChoicePath) {
      const scene = sceneMap.get(resumeOffer.currentSceneId);
      const cd = scene?.transition.type === 'choice' ? scene.transition.choice : null;
      const optId = resumeOffer.pendingChoicePath.split(':')[1];
      const option = cd?.options.find(o => o.id === optId);
      if (option) {
        setSceneId(resumeOffer.currentSceneId);
        setBeat('response');
        setDisplayLines(toDisplayLines(option.responseLines, episode, resumeOffer.pendingChoicePath));
        setAwaitingChoice(false);
        setResumeOffer(null);
        return;
      }
    }

    setResumeOffer(null);
    showScene(resumeOffer.currentSceneId, resumeOffer.choiceHistory, 'scene');
  }, [episode, resumeOffer, sceneMap, showScene]);

  const continueLinear = useCallback(() => {
    if (beat === 'response') {
      const scene = sceneMap.get(sceneId);
      if (!scene || scene.transition.type !== 'choice') return;
      const path = choiceHistory[choiceHistory.length - 1];
      const optId = path?.split(':')[1];
      const option = scene.transition.choice.options.find(o => o.id === optId);
      if (!option) return;
      if (option.nextSceneId === 'END') {
        finishEpisode(choiceHistory, sceneId);
        return;
      }
      showScene(option.nextSceneId, choiceHistory, 'scene');
      return;
    }

    if (!currentScene || currentScene.transition.type !== 'linear') return;
    showScene(currentScene.transition.nextSceneId, choiceHistory, 'scene');
  }, [beat, choiceHistory, currentScene, finishEpisode, sceneId, sceneMap, showScene]);

  const pickOption = useCallback(
    (option: PlayerChoiceOption, choiceId: string) => {
      if (!currentScene || currentScene.transition.type !== 'choice') return;
      const path = `${choiceId}:${option.id}`;
      const nextHistory = [...choiceHistory, path];
      setChoiceHistory(nextHistory);
      setAwaitingChoice(false);
      setBeat('response');
      setDisplayLines(toDisplayLines(option.responseLines, episode, `${sceneId}-${path}`));

      if (option.nextSceneId === 'END') {
        finishEpisode(nextHistory, sceneId);
        return;
      }

      persistProgress(
        buildPayload({
          choiceHistory: nextHistory,
          currentSceneId: sceneId,
          beat: 'response',
          pendingChoicePath: path
        })
      );
    },
    [buildPayload, choiceHistory, currentScene, episode, finishEpisode, persistProgress, sceneId]
  );

  const handleReflectionSave = useCallback(() => {
    if (phase !== 'outcome') return;
    const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
    persistProgress({
      status: 'completed',
      choiceHistory,
      currentSceneId: sceneId,
      beat: 'scene',
      startedAt: new Date(startedAtRef.current).toISOString(),
      completedAt: new Date().toISOString(),
      playTimeSeconds: elapsed,
      reflectionText,
      ...outcomeMeta
    });
  }, [choiceHistory, outcomeMeta, persistProgress, phase, reflectionText, sceneId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Keep the viewport at the top when advancing scenes, choices, or phases.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [sceneId, beat, phase]);

  if (phase === 'intro') {
    return (
      <div className="player-intro">
        <p className="intro-eyebrow">Episode {episodeNumber}</p>
        <h1 className="intro-title">{title}</h1>
        <p className="intro-synopsis">{synopsis}</p>
        <p className="intro-playing-as">You are <strong>{episode.protagonist.name}</strong></p>
        {initialProgress?.status === 'completed' && (
          <p className="intro-status completed">You finished this episode before.</p>
        )}
        <div className="intro-actions">
          {resumeOffer ? (
            <>
              <button type="button" className="primary" onClick={resumeEpisode}>Continue where you left off</button>
              <button type="button" className="secondary" onClick={startEpisode}>Start over</button>
            </>
          ) : (
            <button type="button" className="primary" onClick={startEpisode}>
              {initialProgress?.status === 'completed' ? 'Play again' : 'Begin episode'}
            </button>
          )}
        </div>
      </div>
    );
  }

  const season = seasonForWorld(worldId);
  const nextEpisodeNumber =
    season?.episodeNumbers.includes(episodeNumber + 1) ? episodeNumber + 1 : null;
  const sceneArt = currentScene ? sceneArtUrl(worldId, episodeNumber, currentScene.id) : null;

  if (phase === 'outcome') {
    return (
      <EpisodeOutcome
        title={title}
        worldId={worldId}
        nextEpisodeNumber={nextEpisodeNumber}
        themes={episode.themes}
        endingSceneTitle={outcomeMeta.endingSceneTitle}
        endingBranchName={outcomeMeta.endingBranchName}
        choiceOutcomes={outcomeMeta.choiceOutcomes}
        choiceCount={choiceHistory.length}
        reflectionText={reflectionText}
        onReflectionChange={setReflectionText}
        onSaveReflection={handleReflectionSave}
        onPlayAgain={startEpisode}
        saving={saving}
      />
    );
  }

  return (
    <div className={`scene-stage ${moodClass}`}>
      {sceneArt && (
        <div className="scene-art-panel" aria-hidden="true">
          <img className="scene-art-image" src={sceneArt} alt="" />
        </div>
      )}
      <header className="scene-header">
        {currentScene?.location && <p className="scene-location">{currentScene.location}</p>}
        {currentScene?.title && <h2 className="scene-title">{currentScene.title}</h2>}
      </header>

      <div className="scene-body" aria-live="polite">
        {displayLines.map(entry => (
          <div key={entry.key} className={`scene-line scene-line--${entry.kind}`}>
            {entry.kind !== 'narration' && (
              <div className="scene-speaker">{entry.speaker}</div>
            )}
            <p className="scene-text">{entry.text}</p>
            {entry.action && <p className="scene-action">{entry.action}</p>}
          </div>
        ))}
      </div>

      <footer className="scene-footer">
        {awaitingChoice && currentScene?.transition.type === 'choice' && (
          <div className="choice-panel">
            <p className="choice-prompt">{currentScene.transition.choice.prompt}</p>
            {currentScene.transition.choice.context && (
              <p className="choice-context">{currentScene.transition.choice.context}</p>
            )}
            <div className="choice-cards">
              {currentScene.transition.choice.options.map(option => (
                <button
                  key={option.id}
                  type="button"
                  className="choice-card"
                  onClick={() =>
                    pickOption(
                      option,
                      currentScene.transition.type === 'choice' ? currentScene.transition.choice.id : ''
                    )
                  }
                >
                  {option.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {!awaitingChoice && beat === 'response' && (
          <button type="button" className="primary scene-continue" onClick={continueLinear}>
            Continue
          </button>
        )}

        {!awaitingChoice && beat === 'scene' && currentScene?.transition.type === 'linear' && (
          <button type="button" className="primary scene-continue" onClick={continueLinear}>
            Continue
          </button>
        )}
      </footer>
    </div>
  );
}
