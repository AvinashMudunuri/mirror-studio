/** Episode poster/thumbnail URLs for the browse homepage. */
const NEW_SCHOOL_POSTERS: Record<number, string> = {
  1: '/art/ep1/front-steps.png',
  2: '/art/ep1/hallway.png',
  3: '/art/ep1/classroom.png',
  4: '/art/ep1/cafeteria.png',
  5: '/art/ep1/ending.png'
};

export function episodePosterUrl(worldId: string, episodeNumber: number): string | null {
  if (worldId !== 'NEW_SCHOOL') return null;
  return NEW_SCHOOL_POSTERS[episodeNumber] ?? null;
}
