import { reflectionPromptForThemes } from '../../apps/player/src/lib/reflection-prompts';

describe('reflectionPromptForThemes', () => {
  it('returns a theme-specific prompt when recognized', () => {
    const prompt = reflectionPromptForThemes(['Belonging', 'Other']);
    expect(prompt).toContain('fit');
  });

  it('falls back to a generic prompt for unknown themes', () => {
    const prompt = reflectionPromptForThemes(['UnknownTheme']);
    expect(prompt).toContain('real');
  });
});
