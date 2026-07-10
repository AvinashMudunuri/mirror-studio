import { readFileSync } from 'fs';
import { join } from 'path';
import {
  projectPlayerEpisode,
  resolveBranchLines,
  matchingBranches,
  type AuthoringEpisodeContent
} from '@mirror/schemas';

const RUN = join(
  __dirname,
  '../../output/episodes/episode-01-first-day/run-2026-07-08_06-52-52'
);

function loadAuthoringContent(): AuthoringEpisodeContent {
  const outline = JSON.parse(readFileSync(join(RUN, '01-story-outline.json'), 'utf8')).episodeOutline;
  const cast = [
    JSON.parse(readFileSync(join(RUN, '02-protagonist.json'), 'utf8')).character,
    ...JSON.parse(readFileSync(join(RUN, '02-supporting-characters.json'), 'utf8')).map(
      (entry: { character: unknown }) => entry.character
    )
  ];
  const dialogueBundle = JSON.parse(readFileSync(join(RUN, '03-dialogue.json'), 'utf8'));
  return {
    outline,
    cast,
    dialogue: dialogueBundle.dialogue,
    choiceDialogue: dialogueBundle.choiceDialogue,
    branchDialogue: dialogueBundle.branchDialogue
  };
}

describe('projectPlayerEpisode', () => {
  const content = loadAuthoringContent();
  const player = projectPlayerEpisode(content);

  it('projects title, start scene, and protagonist from real episode 1 artifacts', () => {
    expect(player.version).toBe(1);
    expect(player.title).toBe('First Bell');
    expect(player.startSceneId).toBe('scene-1');
    expect(player.protagonist.name).toMatch(/Sol|Wren|Marisol/i);
    expect(player.scenes.length).toBeGreaterThan(15);
  });

  it('marks choice scenes with options and response dialogue', () => {
    const hallway = player.scenes.find(s => s.id === 'scene-2');
    expect(hallway?.transition.type).toBe('choice');
    if (hallway?.transition.type !== 'choice') return;
    expect(hallway.transition.choice.id).toBe('choice-1');
    expect(hallway.transition.choice.options).toHaveLength(3);
    const optionA = hallway.transition.choice.options.find(o => o.id === 'a');
    expect(optionA?.nextSceneId).toBe('scene-3a');
    expect(optionA?.responseLines.length).toBeGreaterThan(0);
  });

  it('marks linear and ending scenes correctly', () => {
    const arrival = player.scenes.find(s => s.id === 'scene-1');
    expect(arrival?.transition).toEqual({ type: 'linear', nextSceneId: 'scene-2' });

    const authenticEnding = player.scenes.find(s => s.id === 'ending-authentic');
    expect(authenticEnding?.transition).toEqual({ type: 'end' });
    expect(authenticEnding?.branchVariants?.length).toBeGreaterThan(0);
  });

  it('strips authoring-only cast fields but keeps playable characters', () => {
    expect(player.characters.some(c => c.id === 'alex')).toBe(true);
    expect(player.characters.every(c => c.id !== 'player')).toBe(true);
  });
});

describe('branch resolution', () => {
  const content = loadAuthoringContent();
  const player = projectPlayerEpisode(content);

  it('matchingBranches requires every triggeredBy path in history', () => {
    const branches = player.branches;
    const popular = matchingBranches(branches, ['choice-1:a']);
    expect(popular.some(b => b.id === 'branch-popular-path')).toBe(true);
    expect(popular.some(b => b.id === 'branch-bridge-path')).toBe(false);
  });

  it('resolveBranchLines appends all matching variants in history order', () => {
    const ending = player.scenes.find(s => s.id === 'ending-authentic');
    const lines = resolveBranchLines(
      ending?.branchVariants,
      ['choice-1:a', 'choice-5:a'],
      player.branches
    );
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some(l => l.text.includes('Priya'))).toBe(true);
    expect(lines.some(l => l.text.includes('sharing the credit'))).toBe(true);
  });
});

describe('projectPlayerEpisode validation', () => {
  it('throws when outline has no scenes', () => {
    expect(() => projectPlayerEpisode({ outline: { title: 'Empty' } })).toThrow(/no scenes/);
  });
});
