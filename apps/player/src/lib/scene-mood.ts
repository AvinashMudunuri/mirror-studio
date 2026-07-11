/** Map scene location text to a CSS mood class (Tier 0 — no art assets). */
export function moodClassForLocation(location: string, sceneId: string): string {
  const loc = location.toLowerCase();
  const id = sceneId.toLowerCase();

  if (id.includes('ending') || id.includes('end')) return 'mood-ending';
  if (/cafeteria|lunch|food|table/.test(loc)) return 'mood-warm';
  if (/hallway|corridor|locker|stairs/.test(loc)) return 'mood-cool';
  if (/library|study|quiet/.test(loc)) return 'mood-quiet';
  if (/classroom|class|project|presentation/.test(loc)) return 'mood-focus';
  if (/home|bedroom|house|apartment/.test(loc)) return 'mood-home';
  if (/party|backstage|gym|auditorium/.test(loc)) return 'mood-energy';
  return 'mood-neutral';
}
