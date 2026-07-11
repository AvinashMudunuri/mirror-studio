/**
 * Episode 1 scene art pilot — static SVG plates keyed by scene id.
 * Falls back to mood-only background when no art is defined.
 */

const EP1_SCENE_ART: Record<string, string> = {
  'scene-arrival': '/art/ep1/front-steps.svg',
  'scene-hallway': '/art/ep1/hallway.svg',
  'scene-classroom': '/art/ep1/classroom.svg',
  'scene-lunch-setup': '/art/ep1/cafeteria.svg',
  'scene-lunch-popular': '/art/ep1/cafeteria.svg',
  'scene-popular-join': '/art/ep1/cafeteria.svg',
  'scene-popular-neutral': '/art/ep1/cafeteria.svg',
  'scene-popular-defend': '/art/ep1/cafeteria.svg',
  'scene-lunch-alex': '/art/ep1/cafeteria.svg',
  'scene-alex-confront': '/art/ep1/cafeteria.svg',
  'scene-alex-ignore': '/art/ep1/cafeteria.svg',
  'scene-alex-humor': '/art/ep1/cafeteria.svg',
  'scene-lunch-invite': '/art/ep1/cafeteria.svg',
  'scene-invite-humor': '/art/ep1/cafeteria.svg',
  'scene-invite-honesty': '/art/ep1/cafeteria.svg',
  'scene-invite-awkward': '/art/ep1/cafeteria.svg',
  'scene-project-team': '/art/ep1/classroom.svg',
  'scene-climax': '/art/ep1/classroom.svg',
  'scene-ending-integrated': '/art/ep1/ending.svg',
  'scene-ending-popular-lonely': '/art/ep1/ending.svg',
  'scene-ending-outsider-strong': '/art/ep1/ending.svg',
  'scene-ending-compromise': '/art/ep1/ending.svg'
};

/** Legacy ep1 run ids (pre-regen) — same location art. */
const EP1_LEGACY_SCENE_ART: Record<string, string> = {
  'scene-1': '/art/ep1/front-steps.svg',
  'scene-2': '/art/ep1/hallway.svg',
  'scene-3a': '/art/ep1/classroom.svg',
  'scene-3b': '/art/ep1/classroom.svg',
  'scene-3c': '/art/ep1/classroom.svg',
  'scene-4a-popular-table': '/art/ep1/cafeteria.svg',
  'scene-5a-project-assignment': '/art/ep1/classroom.svg',
  'ending-authentic': '/art/ep1/ending.svg',
  'ending-hollow': '/art/ep1/ending.svg'
};

export function sceneArtUrl(
  worldId: string,
  episodeNumber: number,
  sceneId: string
): string | null {
  if (worldId !== 'NEW_SCHOOL' || episodeNumber !== 1) return null;
  return EP1_SCENE_ART[sceneId] ?? EP1_LEGACY_SCENE_ART[sceneId] ?? null;
}
