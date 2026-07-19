import {
  plateKeyFromLocation,
  sceneArtUrl
} from '../../apps/player/src/lib/scene-art';

describe('plateKeyFromLocation', () => {
  it('maps common Season 1 locations', () => {
    expect(plateKeyFromLocation('School library, study room 2')).toBe('library');
    expect(plateKeyFromLocation('The courtyard lunch table')).toBe('courtyard');
    expect(plateKeyFromLocation('Auditorium')).toBe('auditorium');
    expect(plateKeyFromLocation("Cafeteria - Maya's table")).toBe('cafeteria');
    expect(plateKeyFromLocation('Hallway outside the cafeteria')).toBe('hallway');
    expect(plateKeyFromLocation("Mr. Alvarez's classroom")).toBe('classroom');
  });

  it('returns null for empty or unknown locations', () => {
    expect(plateKeyFromLocation('')).toBeNull();
    expect(plateKeyFromLocation(undefined)).toBeNull();
    expect(plateKeyFromLocation('Somewhere else entirely')).toBeNull();
  });
});

describe('sceneArtUrl', () => {
  it('resolves ep1 by scene id', () => {
    expect(sceneArtUrl('NEW_SCHOOL', 1, 'scene-arrival')).toBe('/art/ep1/front-steps.png');
  });

  it('resolves ep2–5 by location text', () => {
    expect(sceneArtUrl('NEW_SCHOOL', 2, 'scene-4-library-session', 'School library, study room 2')).toBe(
      '/art/locations/library.png'
    );
    expect(sceneArtUrl('NEW_SCHOOL', 3, 'scene-9a-showcase-real', 'Auditorium')).toBe(
      '/art/locations/auditorium.png'
    );
    expect(sceneArtUrl('NEW_SCHOOL', 4, 'scene-1-the-laugh', "Cafeteria - Maya's table")).toBe(
      '/art/ep1/cafeteria.png'
    );
  });

  it('returns null outside NEW_SCHOOL', () => {
    expect(sceneArtUrl('SPORTS_ACADEMY', 1, 'scene-1', 'Classroom')).toBeNull();
  });
});
