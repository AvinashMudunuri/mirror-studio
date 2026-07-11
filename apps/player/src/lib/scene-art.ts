/**
 * Episode 1 scene art pilot — AI-generated location plates keyed by scene id.
 * Regenerate with: npm run art:ep1 (Bedrock Stability Ultra in us-west-2 by default).
 */

const EP1_LOCATION_ART: Record<string, string> = {
  'front-steps': '/art/ep1/front-steps.png',
  hallway: '/art/ep1/hallway.png',
  classroom: '/art/ep1/classroom.png',
  cafeteria: '/art/ep1/cafeteria.png',
  ending: '/art/ep1/ending.png'
};

const EP1_SCENE_ART: Record<string, string> = {
  'scene-arrival': EP1_LOCATION_ART['front-steps'],
  'scene-hallway': EP1_LOCATION_ART.hallway,
  'scene-classroom': EP1_LOCATION_ART.classroom,
  'scene-lunch-setup': EP1_LOCATION_ART.cafeteria,
  'scene-lunch-popular': EP1_LOCATION_ART.cafeteria,
  'scene-popular-join': EP1_LOCATION_ART.cafeteria,
  'scene-popular-neutral': EP1_LOCATION_ART.cafeteria,
  'scene-popular-defend': EP1_LOCATION_ART.cafeteria,
  'scene-lunch-alex': EP1_LOCATION_ART.cafeteria,
  'scene-alex-confront': EP1_LOCATION_ART.cafeteria,
  'scene-alex-ignore': EP1_LOCATION_ART.cafeteria,
  'scene-alex-humor': EP1_LOCATION_ART.cafeteria,
  'scene-lunch-invite': EP1_LOCATION_ART.cafeteria,
  'scene-invite-humor': EP1_LOCATION_ART.cafeteria,
  'scene-invite-honesty': EP1_LOCATION_ART.cafeteria,
  'scene-invite-awkward': EP1_LOCATION_ART.cafeteria,
  'scene-project-team': EP1_LOCATION_ART.classroom,
  'scene-climax': EP1_LOCATION_ART.classroom,
  'scene-ending-integrated': EP1_LOCATION_ART.ending,
  'scene-ending-popular-lonely': EP1_LOCATION_ART.ending,
  'scene-ending-outsider-strong': EP1_LOCATION_ART.ending,
  'scene-ending-compromise': EP1_LOCATION_ART.ending
};

/** Legacy ep1 run ids (pre-regen) — same location art. */
const EP1_LEGACY_SCENE_ART: Record<string, string> = {
  'scene-1': EP1_LOCATION_ART['front-steps'],
  'scene-2': EP1_LOCATION_ART.hallway,
  'scene-3a': EP1_LOCATION_ART.classroom,
  'scene-3b': EP1_LOCATION_ART.classroom,
  'scene-3c': EP1_LOCATION_ART.classroom,
  'scene-4a-popular-table': EP1_LOCATION_ART.cafeteria,
  'scene-5a-project-assignment': EP1_LOCATION_ART.classroom,
  'ending-authentic': EP1_LOCATION_ART.ending,
  'ending-hollow': EP1_LOCATION_ART.ending
};

export function sceneArtUrl(
  worldId: string,
  episodeNumber: number,
  sceneId: string
): string | null {
  if (worldId !== 'NEW_SCHOOL' || episodeNumber !== 1) return null;
  return EP1_SCENE_ART[sceneId] ?? EP1_LEGACY_SCENE_ART[sceneId] ?? null;
}
