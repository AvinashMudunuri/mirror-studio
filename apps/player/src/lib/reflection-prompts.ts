const THEME_PROMPTS: Record<string, string> = {
  Belonging: 'When have you felt like you were trying to figure out where you fit?',
  Authenticity: 'Is there a version of yourself you only show around certain people?',
  'First Impressions': 'What do people usually assume about you before they really know you?',
  'Peer Pressure': 'Have you ever gone along with something because everyone else was?',
  Honesty: 'When is telling the truth hardest — and when is it most worth it?',
  Teamwork: 'What makes working with other people feel good vs. frustrating?',
  Inclusion: 'Have you ever been left out of something that everyone else got invited to?',
  'Social Status': 'Does popularity at school actually feel the way people think it does?',
  Loyalty: 'Who would you stand up for, even if it cost you something?',
  'Conflict Repair': 'What does a real apology look like to you — not just saying sorry?',
  Apology: 'Have you ever had to apologize when you did not mean to hurt someone?',
  Boundaries: 'When is it okay to say "that is not funny" to a friend?',
  Growth: 'Who were you at the start of this year — and who are you becoming?',
  Identity: 'What is one thing about you that you are still figuring out?',
  'Choosing Your People': 'Who do you actually want in your corner?'
};

export function reflectionPromptForThemes(themes: string[]): string {
  for (const theme of themes) {
    const prompt = THEME_PROMPTS[theme];
    if (prompt) return prompt;
  }
  return 'What part of this story felt most real to you — and why?';
}
