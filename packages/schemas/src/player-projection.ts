/**
 * Player-facing content projection — trims the authoring/persistence shape
 * (`{ outline, cast, dialogue, choiceDialogue, branchDialogue }`) into a
 * graph a frontend can walk without knowing pipeline internals.
 *
 * Branch resolution at runtime: `all-matching-append-ordered` — every branch
 * whose full `triggeredBy` list is satisfied by the player's choice history
 * contributes its variant lines, ordered by the latest matching choice in
 * history (earlier path context first, most recent choice context last).
 */

export interface PlayerDialogueLine {
  id: string;
  character: string;
  text: string;
  emotion?: string;
  action?: string;
  pause?: number;
}

export interface PlayerChoiceOption {
  id: string;
  text: string;
  nextSceneId: string;
  responseLines: PlayerDialogueLine[];
}

export type PlayerSceneTransition =
  | { type: 'linear'; nextSceneId: string }
  | {
      type: 'choice';
      choice: {
        id: string;
        prompt: string;
        context?: string;
        options: PlayerChoiceOption[];
      };
    }
  | { type: 'end' };

export interface PlayerBranchVariant {
  branchId: string;
  triggeredBy: string[];
  lines: PlayerDialogueLine[];
}

export interface PlayerScene {
  id: string;
  title: string;
  location: string;
  lines: PlayerDialogueLine[];
  transition: PlayerSceneTransition;
  branchVariants?: PlayerBranchVariant[];
}

export interface PlayerEpisode {
  version: 1;
  title: string;
  synopsis: string;
  themes: string[];
  startSceneId: string;
  protagonist: { name: string; pronouns?: string };
  characters: Array<{ id: string; name: string; pronouns?: string }>;
  scenes: PlayerScene[];
  branches: Array<{ id: string; name: string; triggeredBy: string[] }>;
  branchResolution: 'all-matching-append-ordered';
}

/** Authoring shape stored in episodes.content / published_content. */
export interface AuthoringEpisodeContent {
  outline?: {
    title?: string;
    synopsis?: string;
    themes?: string[];
    scenes?: Array<{
      id: string;
      title?: string;
      location?: string;
      defaultNextScene?: string;
    }>;
    choicePoints?: Array<{
      id: string;
      scene: string;
      prompt?: string;
      context?: string;
      options?: Array<{ id: string; text?: string; nextScene?: string }>;
    }>;
    branches?: Array<{ id: string; name?: string; triggeredBy?: string[] }>;
  };
  cast?: Array<{ id: string; name?: string; pronouns?: string }>;
  dialogue?: Array<{ sceneId: string; lines?: PlayerDialogueLine[] }>;
  choiceDialogue?: Array<{
    choiceId: string;
    options?: Array<{ id: string; text?: string }>;
    responseDialogue?: Record<string, PlayerDialogueLine[]>;
  }>;
  branchDialogue?: Array<{
    sceneId: string;
    branchId: string;
    lines?: PlayerDialogueLine[];
  }>;
}

function asLines(lines: PlayerDialogueLine[] | undefined): PlayerDialogueLine[] {
  return (lines || []).filter(l => l?.id && l?.text);
}

/** Which branches match the player's choice history so far. */
export function matchingBranches(
  branches: Array<{ id: string; triggeredBy?: string[] }>,
  choiceHistory: string[]
): Array<{ id: string; triggeredBy: string[] }> {
  const history = new Set(choiceHistory);
  return branches
    .map(b => ({ id: b.id, triggeredBy: b.triggeredBy || [] }))
    .filter(b => b.triggeredBy.length > 0 && b.triggeredBy.every(path => history.has(path)));
}

/**
 * Resolve branch-variant lines for a scene given choice history.
 * Returns lines in display order (path context → recent choice context).
 */
export function resolveBranchLines(
  branchVariants: PlayerBranchVariant[] | undefined,
  choiceHistory: string[],
  branches: Array<{ id: string; triggeredBy: string[] }>
): PlayerDialogueLine[] {
  if (!branchVariants?.length) return [];

  const matched = matchingBranches(branches, choiceHistory);
  const matchedIds = new Set(matched.map(b => b.id));
  const variants = branchVariants.filter(v => matchedIds.has(v.branchId));
  if (!variants.length) return [];

  const historyIndex = new Map(choiceHistory.map((path, i) => [path, i]));

  const sortKey = (triggeredBy: string[]) => {
    const indices = triggeredBy.map(path => historyIndex.get(path) ?? -1);
    const latest = Math.max(...indices);
    return [latest, triggeredBy.length] as const;
  };

  variants.sort((a, b) => {
    const [aLatest, aLen] = sortKey(a.triggeredBy);
    const [bLatest, bLen] = sortKey(b.triggeredBy);
    if (aLatest !== bLatest) return aLatest - bLatest;
    return aLen - bLen;
  });

  return variants.flatMap(v => asLines(v.lines));
}

/** Pure projection from persisted authoring content to a player graph. */
export function projectPlayerEpisode(content: AuthoringEpisodeContent): PlayerEpisode {
  const outline = content.outline || {};
  const scenes = outline.scenes || [];
  if (!scenes.length) {
    throw new Error('Cannot project player episode: outline has no scenes');
  }

  const cast = content.cast || [];
  const protagonistRow = cast.find(c => c.id === 'player');
  const protagonist = {
    name: protagonistRow?.name || 'You',
    pronouns: protagonistRow?.pronouns
  };

  const dialogueByScene = new Map(
    (content.dialogue || []).map(d => [d.sceneId, asLines(d.lines)])
  );

  const choiceByScene = new Map(
    (outline.choicePoints || []).map(cp => [cp.scene, cp])
  );

  const choiceDialogueById = new Map(
    (content.choiceDialogue || []).map(cd => [cd.choiceId, cd])
  );

  const branchMeta = (outline.branches || []).map(b => ({
    id: b.id,
    name: b.name || b.id,
    triggeredBy: b.triggeredBy || []
  }));

  const branchTriggeredBy = new Map(branchMeta.map(b => [b.id, b.triggeredBy]));

  const branchVariantsByScene = new Map<string, PlayerBranchVariant[]>();
  for (const entry of content.branchDialogue || []) {
    if (!entry.sceneId || !entry.branchId) continue;
    const list = branchVariantsByScene.get(entry.sceneId) || [];
    list.push({
      branchId: entry.branchId,
      triggeredBy: branchTriggeredBy.get(entry.branchId) || [],
      lines: asLines(entry.lines)
    });
    branchVariantsByScene.set(entry.sceneId, list);
  }

  const playerScenes: PlayerScene[] = scenes.map(scene => {
    const choicePoint = choiceByScene.get(scene.id);
    const choiceDialogue = choicePoint ? choiceDialogueById.get(choicePoint.id) : undefined;
    const responseDialogue = choiceDialogue?.responseDialogue || {};

    let transition: PlayerSceneTransition;
    if (choicePoint) {
      transition = {
        type: 'choice',
        choice: {
          id: choicePoint.id,
          prompt: choicePoint.prompt || 'What do you do?',
          context: choicePoint.context,
          options: (choicePoint.options || []).map(opt => ({
            id: opt.id,
            text: opt.text || opt.id,
            nextSceneId: opt.nextScene || 'END',
            responseLines: asLines(responseDialogue[opt.id])
          }))
        }
      };
    } else if (scene.defaultNextScene === 'END' || !scene.defaultNextScene) {
      transition = { type: 'end' };
    } else {
      transition = { type: 'linear', nextSceneId: scene.defaultNextScene };
    }

    const branchVariants = branchVariantsByScene.get(scene.id);
    return {
      id: scene.id,
      title: scene.title || scene.id,
      location: scene.location || '',
      lines: dialogueByScene.get(scene.id) || [],
      transition,
      ...(branchVariants?.length ? { branchVariants } : {})
    };
  });

  return {
    version: 1,
    title: outline.title || 'Untitled Episode',
    synopsis: outline.synopsis || '',
    themes: outline.themes || [],
    startSceneId: scenes[0].id,
    protagonist,
    characters: cast
      .filter(c => c.id !== 'player')
      .map(c => ({ id: c.id, name: c.name || c.id, pronouns: c.pronouns })),
    scenes: playerScenes,
    branches: branchMeta,
    branchResolution: 'all-matching-append-ordered'
  };
}
