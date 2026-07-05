/**
 * Dialogue Writer Agent (Echo)
 * 
 * Mission: Write dialogue that sounds like real teenagers talking,
 * not adults writing for teenagers.
 */

import { BaseAgent, AgentConfig } from './base-agent-v2';
import type { Character } from '@mirror/schemas';
import type { 
  EpisodeOutline,
  Scene,
  ChoicePoint,
  EmotionalBeat
} from './story-architect';

// ==================== Input/Output Schemas ====================

export interface DialogueLine {
  id: string;
  character: string; // character ID or 'NARRATOR' or 'INTERNAL'
  text: string;
  emotion?: string;
  action?: string;
  pause?: number; // milliseconds
  emphasis?: string[]; // words to emphasize
}

export interface ChoiceOption {
  id: string;
  text: string;
}

export interface InternalThought {
  sceneId: string;
  moment: string;
  thought: string;
}

export interface DialogueWriterInput {
  type: 'WRITE_DIALOGUE' | 'REVISE_DIALOGUE' | 'VOICE_CHECK';
  
  writeRequest?: {
    episodeOutline: EpisodeOutline;
    characters: Character[];
    scenes: Scene[];
    emotionalBeats: EmotionalBeat[];
    choicePoints: ChoicePoint[];
  };
  
  revisionRequest?: {
    currentDialogue: SceneDialogue[];
    feedback: Feedback[];
    specificScenes?: string[];
  };
  
  voiceCheck?: {
    character: Character;
    dialogueSample: string[];
    context: Scene[];
  };
}

export interface SceneDialogue {
  sceneId: string;
  lines: DialogueLine[];
}

export interface Feedback {
  from: string;
  message: string;
  severity: 'MINOR' | 'MAJOR' | 'BLOCKER';
}

export interface DialogueWriterOutput {
  dialogue: SceneDialogue[];
  
  choiceDialogue: {
    choiceId: string;
    options: ChoiceOption[];
    responseDialogue: Record<string, DialogueLine[]>;
  }[];
  
  internalMonologue?: InternalThought[];
  
  voiceNotes: string;
  alternativeLines?: {
    lineId: string;
    alternatives: string[];
    reasoning: string;
  }[];
}

// ==================== Dialogue Writer Agent ====================

export class DialogueWriterAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      id: 'DIALOGUE_WRITER',
      name: 'Echo',
      role: 'Dialogue and Voice Specialist',
      model: 'claude-3-opus-20240229',
      temperature: 0.7, // Higher for creative, authentic dialogue
      maxTokens: 8192
    };
    super(config);
  }
  
  protected get systemPrompt(): string {
    return `You are Echo, Dialogue Writer at Project MIRROR Studio.

Your mission: Write dialogue that sounds like real teenagers, not adults pretending to be teenagers.

DIALOGUE PRINCIPLES:
1. Teenagers don't explain their feelings clearly - they talk around them
2. Every character sounds different
3. Subtext > exposition
4. Real conversations have interruptions, trailing off, "um"s and "like"s (sparingly)
5. Emotion comes through what's NOT said
6. Read it aloud - if it sounds written, rewrite
7. Less is more - silence can speak

VOICE MATCHING:
For each character, reference their:
- Speech patterns
- Vocabulary level
- Emotional expressiveness
- Mannerisms
- Examples from character profile

TECHNICAL REQUIREMENTS:
- Age-appropriate language
- No profanity
- Culturally sensitive
- Each line needs character, text, optional emotion/action
- Choice options must sound like player's voice

PROCESS:
1. What's the surface conversation? (what they're saying)
2. What's the real conversation? (what they mean)
3. How does each character's personality shape their speech?
4. Where are the pauses, the hesitations, the subtext?
5. Read aloud - does it sound real?

OUTPUT:
Complete dialogue for the scene with:
- Character-differentiated voices
- Subtext and emotional layering
- Action/emotion tags where needed
- Natural choice options
- Alternative lines if uncertain

Be authentic. Be specific. Be brave with subtext.`;
  }
  
  protected async execute(input: DialogueWriterInput): Promise<DialogueWriterOutput> {
    console.log(`[Echo] Working on ${input.type}...`);
    
    switch (input.type) {
      case 'WRITE_DIALOGUE':
        if (!input.writeRequest) throw new Error('WRITE_DIALOGUE requires writeRequest field');
        return await this.writeDialogue(input.writeRequest);
      
      case 'REVISE_DIALOGUE':
        if (!input.revisionRequest) throw new Error('REVISE_DIALOGUE requires revisionRequest field');
        return await this.reviseDialogue(input.revisionRequest);
      
      case 'VOICE_CHECK':
        if (!input.voiceCheck) throw new Error('VOICE_CHECK requires voiceCheck field');
        return await this.checkVoice(input.voiceCheck);
      
      default:
        throw new Error(`Unknown Dialogue Writer task: ${input.type}`);
    }
  }
  
  // ==================== Dialogue Writing ====================
  
  private async writeDialogue(
    request: NonNullable<DialogueWriterInput['writeRequest']>
  ): Promise<DialogueWriterOutput> {
    const { episodeOutline, characters, scenes, emotionalBeats, choicePoints } = request;
    
    // Build context for LLM
    const context = this.buildDialogueContext(episodeOutline, characters, scenes, emotionalBeats);
    
    const prompt = `${context}

YOUR TASK:
Write complete dialogue for all scenes in this episode.

For each scene:
1. Write authentic dialogue that matches character voices
2. Layer in subtext and emotional beats
3. Use action/emotion tags sparingly but effectively
4. Include pauses and emphasis where natural
5. Ensure choice options sound like things players would say

FORMAT YOUR RESPONSE AS JSON:
{
  "dialogue": [
    {
      "sceneId": "scene-1",
      "lines": [
        {
          "id": "line-1",
          "character": "alex",
          "text": "Hey, are you okay?",
          "emotion": "concerned",
          "action": "sits down next to them"
        }
      ]
    }
  ],
  "choiceDialogue": [
    {
      "choiceId": "choice-1",
      "options": [
        { "id": "a", "text": "I'm here if you want to talk." },
        { "id": "b", "text": "You don't have to tell me anything." }
      ],
      "responseDialogue": {
        "a": [
          {
            "id": "resp-a-1",
            "character": "casey",
            "text": "Thanks. I... I appreciate that.",
            "pause": 1000
          }
        ]
      }
    }
  ],
  "voiceNotes": "Character voice analysis and subtext notes...",
  "alternativeLines": [
    {
      "lineId": "line-1",
      "alternatives": ["Hey, what's wrong?", "You look upset."],
      "reasoning": "Current version feels more natural"
    }
  ]
}`;
    
    const response = await this.callLLM(
      this.systemPrompt,
      prompt
    );
    
    const result = this.parseDialogueFromResponse(response);
    
    // Store in memory
    await this.remember(`episode-dialogue:${episodeOutline.title}`, {
      episodeOutline,
      dialogue: result,
      generatedAt: new Date().toISOString()
    });
    
    return result;
  }
  
  // ==================== Dialogue Revision ====================
  
  private async reviseDialogue(
    request: NonNullable<DialogueWriterInput['revisionRequest']>
  ): Promise<DialogueWriterOutput> {
    const { currentDialogue, feedback, specificScenes } = request;
    
    const scenesToRevise = specificScenes || currentDialogue.map(d => d.sceneId);
    
    const prompt = `CURRENT DIALOGUE:
${JSON.stringify(currentDialogue.filter(d => scenesToRevise.includes(d.sceneId)), null, 2)}

FEEDBACK TO ADDRESS:
${feedback.map(f => `[${f.severity}] ${f.from}: ${f.message}`).join('\n')}

YOUR TASK:
Revise the dialogue to address all feedback while maintaining:
- Character voice consistency
- Authentic teen speech
- Subtext and emotional layering
- Age-appropriateness

FORMAT YOUR RESPONSE AS JSON (same structure as before).`;
    
    const response = await this.callLLM(
      this.systemPrompt,
      prompt
    );
    
    const result = this.parseDialogueFromResponse(response);
    
    // Store revision
    await this.remember('dialogue-revision', {
      original: currentDialogue,
      feedback,
      revised: result,
      revisedAt: new Date().toISOString()
    });
    
    return result;
  }
  
  // ==================== Voice Check ====================
  
  private async checkVoice(
    request: NonNullable<DialogueWriterInput['voiceCheck']>
  ): Promise<DialogueWriterOutput> {
    const { character, dialogueSample, context } = request;
    
    const prompt = `CHARACTER PROFILE:
Name: ${character.name} (${character.age}, ${character.pronouns})
Speech Patterns: ${character.personality.speechPatterns.join(', ')}
Mannerisms: ${character.personality.mannerisms.join(', ')}
Voice Examples:
${character.voiceGuidelines.examples.join('\n')}

DIALOGUE SAMPLE TO CHECK:
${dialogueSample.map((line, i) => `${i + 1}. "${line}"`).join('\n')}

CONTEXT:
${context.map(s => `Scene: ${s.title} - ${s.description}`).join('\n')}

YOUR TASK:
Review the dialogue sample for voice consistency.

Does it match:
1. Speech patterns?
2. Vocabulary level?
3. Emotional expressiveness?
4. Mannerisms?

FORMAT YOUR RESPONSE AS JSON:
{
  "dialogue": [], 
  "choiceDialogue": [],
  "voiceNotes": "Detailed voice consistency analysis with specific examples of what works and what doesn't...",
  "alternativeLines": [
    {
      "lineId": "original-1",
      "alternatives": ["Better version 1", "Better version 2"],
      "reasoning": "Why these alternatives better match the character"
    }
  ]
}`;
    
    const response = await this.callLLM(
      this.systemPrompt,
      prompt
    );
    
    return this.parseDialogueFromResponse(response);
  }
  
  // ==================== Helper Methods ====================
  
  private buildDialogueContext(
    episodeOutline: EpisodeOutline,
    characters: Character[],
    scenes: Scene[],
    emotionalBeats: EmotionalBeat[]
  ): string {
    let context = `EPISODE CONTEXT:
Title: ${episodeOutline.title}
Synopsis: ${episodeOutline.synopsis}
Themes: ${episodeOutline.themes.join(', ')}

CHARACTERS:
${characters.map(c => `
${c.name} (${c.age}, ${c.pronouns}):
- Core Traits: ${c.personality.coreTraits.join(', ')}
- Speech Patterns: ${c.personality.speechPatterns.join(', ')}
- Mannerisms: ${c.personality.mannerisms.join(', ')}
- Voice Examples:
${c.voiceGuidelines.examples.map(ex => `  * ${ex}`).join('\n')}
`).join('\n')}

SCENES:
${scenes.map(s => `
Scene ${s.id}: ${s.title}
Location: ${s.location}
Characters: ${s.characters.join(', ')}
Duration: ${s.duration} min
Description: ${s.description}
Emotional Beat: ${s.emotionalBeat}
`).join('\n')}`;
    
    if (emotionalBeats.length > 0) {
      context += `\n\nEMOTIONAL BEATS:
${emotionalBeats.map(eb => `- Scene ${eb.scene}: ${eb.emotion} (${eb.description})`).join('\n')}`;
    }
    
    if (episodeOutline.choicePoints.length > 0) {
      context += `\n\nCHOICE POINTS:
${episodeOutline.choicePoints.map(cp => `
Choice ${cp.id} (Scene ${cp.scene}):
Prompt: ${cp.prompt}
Options:
${cp.options.map(opt => `  ${opt.id}) ${opt.text}`).join('\n')}
`).join('\n')}`;
    }
    
    return context;
  }
  
  private parseDialogueFromResponse(content: string): DialogueWriterOutput {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
    
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON from LLM response');
    }
    
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      
      // Validate required fields
      if (!parsed.dialogue || !Array.isArray(parsed.dialogue)) {
        throw new Error('Invalid dialogue structure - missing dialogue array');
      }
      
      // Ensure choiceDialogue exists (can be empty)
      if (!parsed.choiceDialogue) {
        parsed.choiceDialogue = [];
      }
      
      // Ensure voiceNotes exists
      if (!parsed.voiceNotes) {
        parsed.voiceNotes = 'Dialogue generated successfully.';
      }
      
      return parsed as DialogueWriterOutput;
    } catch (error) {
      console.error('Failed to parse dialogue:', error);
      throw new Error(`Failed to parse dialogue output: ${error}`);
    }
  }
  
  // ==================== Validation ====================
  
  private validateDialogue(output: DialogueWriterOutput, characters: Character[]): void {
    const characterIds = new Set(characters.map(c => c.id));
    characterIds.add('NARRATOR');
    characterIds.add('INTERNAL');
    
    for (const sceneDialogue of output.dialogue) {
      for (const line of sceneDialogue.lines) {
        if (!characterIds.has(line.character)) {
          console.warn(`[Echo] Warning: Unknown character "${line.character}" in scene ${sceneDialogue.sceneId}`);
        }
        
        if (line.text.length < 2) {
          console.warn(`[Echo] Warning: Very short dialogue line "${line.id}" in scene ${sceneDialogue.sceneId}`);
        }
        
        // Check for overly long lines (teenagers don't monologue)
        if (line.text.length > 200 && line.character !== 'NARRATOR') {
          console.warn(`[Echo] Warning: Long dialogue line (${line.text.length} chars) for ${line.character} - consider breaking up`);
        }
      }
    }
    
    console.log(`[Echo] Validated ${output.dialogue.length} scenes with dialogue`);
  }
}
