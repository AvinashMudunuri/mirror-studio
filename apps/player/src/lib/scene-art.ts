/**
 * Season 1 location art — AI-generated plates keyed by scene id and/or location text.
 *
 * Ep1 plates: apps/player/public/art/ep1/  (npm run art:ep1)
 * Extra campus plates: apps/player/public/art/locations/  (npm run art:locations)
 */

const LOCATION_ART: Record<string, string> = {
  'front-steps': '/art/ep1/front-steps.png',
  hallway: '/art/ep1/hallway.png',
  classroom: '/art/ep1/classroom.png',
  cafeteria: '/art/ep1/cafeteria.png',
  ending: '/art/ep1/ending.png',
  library: '/art/locations/library.png',
  courtyard: '/art/locations/courtyard.png',
  auditorium: '/art/locations/auditorium.png'
};

/** Explicit scene-id maps for published NEW_SCHOOL runs (when location text is thin). */
const EPISODE_SCENE_ART: Record<number, Record<string, string>> = {
  1: {
    'scene-arrival': LOCATION_ART['front-steps'],
    'scene-hallway': LOCATION_ART.hallway,
    'scene-classroom': LOCATION_ART.classroom,
    'scene-lunch-setup': LOCATION_ART.cafeteria,
    'scene-lunch-popular': LOCATION_ART.cafeteria,
    'scene-popular-join': LOCATION_ART.cafeteria,
    'scene-popular-neutral': LOCATION_ART.cafeteria,
    'scene-popular-defend': LOCATION_ART.cafeteria,
    'scene-lunch-alex': LOCATION_ART.cafeteria,
    'scene-alex-confront': LOCATION_ART.cafeteria,
    'scene-alex-ignore': LOCATION_ART.cafeteria,
    'scene-alex-humor': LOCATION_ART.cafeteria,
    'scene-lunch-invite': LOCATION_ART.cafeteria,
    'scene-invite-humor': LOCATION_ART.cafeteria,
    'scene-invite-honesty': LOCATION_ART.cafeteria,
    'scene-invite-awkward': LOCATION_ART.cafeteria,
    'scene-project-team': LOCATION_ART.classroom,
    'scene-climax': LOCATION_ART.classroom,
    'scene-ending-integrated': LOCATION_ART.ending,
    'scene-ending-popular-lonely': LOCATION_ART.ending,
    'scene-ending-outsider-strong': LOCATION_ART.ending,
    'scene-ending-compromise': LOCATION_ART.ending,
    // Legacy ep1 ids
    'scene-1': LOCATION_ART['front-steps'],
    'scene-2': LOCATION_ART.hallway,
    'scene-3a': LOCATION_ART.classroom,
    'scene-3b': LOCATION_ART.classroom,
    'scene-3c': LOCATION_ART.classroom,
    'scene-4a-popular-table': LOCATION_ART.cafeteria,
    'scene-5a-project-assignment': LOCATION_ART.classroom,
    'ending-authentic': LOCATION_ART.ending,
    'ending-hollow': LOCATION_ART.ending
  }
};

/** Map free-text scene.location → plate key. */
export function plateKeyFromLocation(location: string | undefined | null): string | null {
  if (!location) return null;
  const l = location.toLowerCase();
  if (/library/.test(l)) return 'library';
  if (/courtyard/.test(l)) return 'courtyard';
  if (/auditorium|showcase|backstage/.test(l)) return 'auditorium';
  // Hallway before cafeteria — e.g. "Hallway outside the cafeteria"
  if (/hallway|alcove|corridor/.test(l)) return 'hallway';
  if (/cafeteria|lunch|tray return|maya'?s table/.test(l)) return 'cafeteria';
  if (/classroom|homeroom|alvarez|second period|presentation day/.test(l)) return 'classroom';
  if (/front.?step|entrance/.test(l)) return 'front-steps';
  if (/ending|golden hour|sunset/.test(l)) return 'ending';
  return null;
}

export function sceneArtUrl(
  worldId: string,
  episodeNumber: number,
  sceneId: string,
  location?: string
): string | null {
  if (worldId !== 'NEW_SCHOOL') return null;

  const byScene = EPISODE_SCENE_ART[episodeNumber]?.[sceneId];
  if (byScene) return byScene;

  const key = plateKeyFromLocation(location);
  if (key && LOCATION_ART[key]) return LOCATION_ART[key];

  // Ending scene ids without a useful location string
  if (/ending|resolution/i.test(sceneId)) return LOCATION_ART.ending;

  return null;
}
