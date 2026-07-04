/**
 * Story Architect Agent (River)
 * 
 * Mission: Design emotionally engaging story structures that create meaningful
 * choices and support educational goals invisibly.
 * 
 * This is the manual implementation - later this will be generated/refined by Developer Agent.
 */

import { BaseAgent, AgentConfig } from './base-agent-v2';
import type {
  Character,
  TraitId
} from '@mirror/schemas';

// ==================== Input/Output Schemas ====================

export interface Scene {
  id: string;
  title: string;
  location: string;
  characters: string[]; // character IDs
  duration: number; // minutes
  description: string;
  emotionalBeat: string;
}

export interface StoryChoiceOption {
  id: string;
  text: string;
  consequence?: string;
}

export interface ChoicePoint {
  id: string;
  scene: string; // scene ID
  prompt: string;
  context?: string;
  options: StoryChoiceOption[];
  traitMapping: Record<string, Record<TraitId, number>>; // option ID -> trait -> delta
}

export interface Branch {
  id: string;
  name: string;
  triggeredBy: string[]; // choice IDs
  description: string;
  outcome: string;
}

export interface EmotionalBeat {
  scene: string;
  emotion: string;
  intensity: number; // 1-10
  description: string;
}

export interface StoryCharacterArc {
  characterId: string;
  startState: string;
  endState: string;
  keyMoments: string[]; // scene IDs
}

export interface TraitMapping {
  trait: TraitId;
  opportunities: string[]; // choice IDs
  subtlety: 'HIDDEN' | 'SUBTLE' | 'MODERATE';
}

export interface StoryArchitectInput {
  type: 'NEW_EPISODE' | 'REVISION_REQUEST';
  
  brief?: {
    world: string;
    season: string;
    episodeNumber: number;
    themes: string[];
    targetTraits: TraitId[];
    characters: Character[];
    previousEpisodes?: Array<{
      id: string;
      title: string;
      synopsis: string;
    }>;
    playerData?: {
      completionRate: number;
      replayRate: number;
      avgSessionTime: number;
      preferredChoices: string[];
    };
  };
  
  revisionRequest?: {
    currentDraft: EpisodeOutline;
    feedback: Array<{
      from: string;
      message: string;
      severity: 'MINOR' | 'MAJOR' | 'BLOCKER';
    }>;
    constraints: string[];
  };
}

export interface EpisodeOutline {
  title: string;
  synopsis: string;
  themes: string[];
  targetTraits: TraitId[];
  
  scenes: Scene[];
  choicePoints: ChoicePoint[];
  branches: Branch[];
  
  emotionalArc: EmotionalBeat[];
  characterArcs: StoryCharacterArc[];
  
  traitMapping: TraitMapping[];
  relationshipDynamics: Array<{
    characters: string[];
    dynamic: string;
    evolution: string;
  }>;
  
  replayHooks: string[];
  estimatedPlayTime: number; // minutes
  
  educationalGoals: string[];
  conversationStarters: string[];
}

export interface StoryArchitectOutput {
  episodeOutline: EpisodeOutline;
  designNotes: string;
  uncertainties?: string[];
  alternativesConsidered?: Array<{
    approach: string;
    reasoning: string;
  }>;
}

// ==================== Story Architect Agent ====================

export class StoryArchitectAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      id: 'STORY_ARCHITECT',
      name: 'River',
      role: 'Lead Story Designer',
      model: 'claude-sonnet-4.5',
      temperature: 0.5,
      maxTokens: 8192
    };
    super(config);
  }
  
  protected get systemPrompt(): string {
    return `You are River, Lead Story Architect at Project MIRROR Studio.

Your mission: Design emotionally engaging story structures that create meaningful choices and support educational goals invisibly.

DESIGN PRINCIPLES:
1. Story first - educational goals must be invisible
2. Every choice must feel natural to the situation
3. Branches must meaningfully diverge
4. Characters must drive the plot
5. Emotional beats must be earned
6. Players should want to replay to see "what if"

STRUCTURE REQUIREMENTS:
- 10-15 minutes play time
- 5+ meaningful choices
- 2+ significantly different paths
- Maps to 3-5 traits naturally
- Creates conversation opportunities

PROCESS:
1. What's the core conflict?
2. Why does it matter emotionally?
3. What choice pressure feels real?
4. How do different choices reveal character aspects?
5. What makes players want to replay?
6. Where are trait-mapping opportunities? (hide them)

OUTPUT:
Full episode outline with:
- Scene breakdown
- Choice points with branches
- Emotional arc
- Character dynamics
- Trait mapping (subtle)
- Replay hooks

Be creative. Be honest about uncertainties. Suggest alternatives.`;
  }
  
  protected async execute(input: StoryArchitectInput): Promise<StoryArchitectOutput> {
    console.log(`[River] Designing ${input.type === 'NEW_EPISODE' ? 'new episode' : 'revision'}...`);
    
    if (input.type === 'NEW_EPISODE' && input.brief) {
      return await this.createNewEpisode(input.brief);
    } else if (input.type === 'REVISION_REQUEST' && input.revisionRequest) {
      return await this.reviseEpisode(input.revisionRequest);
    } else {
      throw new Error('Invalid Story Architect input');
    }
  }
  
  // ==================== Episode Creation ====================
  
  private async createNewEpisode(brief: NonNullable<StoryArchitectInput['brief']>): Promise<StoryArchitectOutput> {
    const context = this.buildContext(brief);
    
    const prompt = `${context}

YOUR TASK:
Design a complete episode outline.

FORMAT YOUR RESPONSE AS JSON:
{
  "episodeOutline": {
    "title": "...",
    "synopsis": "...",
    "themes": [...],
    "targetTraits": [...],
    "scenes": [
      {
        "id": "scene-1",
        "title": "...",
        "location": "...",
        "characters": [...],
        "duration": 2,
        "description": "...",
        "emotionalBeat": "..."
      }
    ],
    "choicePoints": [
      {
        "id": "choice-1",
        "scene": "scene-2",
        "prompt": "...",
        "context": "...",
        "options": [
          { "id": "a", "text": "..." },
          { "id": "b", "text": "..." }
        ],
        "traitMapping": {
          "a": { "EMPATHY": 2, "CONFIDENCE": 1 },
          "b": { "CONFIDENCE": -1 }
        }
      }
    ],
    "branches": [...],
    "emotionalArc": [...],
    "characterArcs": [...],
    "traitMapping": [...],
    "relationshipDynamics": [...],
    "replayHooks": [...],
    "estimatedPlayTime": 12,
    "educationalGoals": [...],
    "conversationStarters": [...]
  },
  "designNotes": "...",
  "uncertainties": [...],
  "alternativesConsidered": [...]
}`;
    
    const response = await this.callLLM(
      this.systemPrompt,
      prompt
    );
    
    // Parse LLM response
    const result = this.parseOutlineFromResponse(response);
    
    // Store in memory
    await this.remember('episode-outline', {
      brief,
      outline: result.episodeOutline,
      generatedAt: new Date().toISOString()
    });
    
    return result;
  }
  
  // ==================== Episode Revision ====================
  
  private async reviseEpisode(revision: NonNullable<StoryArchitectInput['revisionRequest']>): Promise<StoryArchitectOutput> {
    const { currentDraft, feedback, constraints } = revision;
    
    const prompt = `CURRENT DRAFT:
${JSON.stringify(currentDraft, null, 2)}

FEEDBACK TO ADDRESS:
${feedback.map(f => `[${f.severity}] ${f.from}: ${f.message}`).join('\n')}

CONSTRAINTS:
${constraints.map(c => `- ${c}`).join('\n')}

YOUR TASK:
Revise the episode outline to address all feedback while maintaining story quality.

FORMAT YOUR RESPONSE AS JSON (same structure as before).`;
    
    const response = await this.callLLM(
      this.systemPrompt,
      prompt
    );
    
    const result = this.parseOutlineFromResponse(response);
    
    // Store revision
    await this.remember('episode-revision', {
      original: currentDraft,
      feedback,
      revised: result.episodeOutline,
      revisedAt: new Date().toISOString()
    });
    
    return result;
  }
  
  // ==================== Helper Methods ====================
  
  private buildContext(brief: NonNullable<StoryArchitectInput['brief']>): string {
    let context = `EPISODE BRIEF:
World: ${brief.world}
Season: ${brief.season}
Episode: ${brief.episodeNumber}
Themes: ${brief.themes.join(', ')}
Target Traits: ${brief.targetTraits.join(', ')}

AVAILABLE CHARACTERS:
${brief.characters.map(c => `- ${c.name} (${c.storyRole}, age ${c.age})\n  Personality: ${c.personality.coreTraits.join(', ')}\n  Background: ${c.background.interests.join(', ')}`).join('\n\n')}`;
    
    if (brief.previousEpisodes && brief.previousEpisodes.length > 0) {
      context += `\n\nPREVIOUS EPISODES:
${brief.previousEpisodes.map(e => `- Episode ${e.id}: ${e.title}\n  ${e.synopsis}`).join('\n\n')}`;
    }
    
    if (brief.playerData) {
      context += `\n\nPLAYER INSIGHTS:
- Completion Rate: ${(brief.playerData.completionRate * 100).toFixed(1)}%
- Replay Rate: ${(brief.playerData.replayRate * 100).toFixed(1)}%
- Avg Session Time: ${brief.playerData.avgSessionTime} min
- Preferred Choices: ${brief.playerData.preferredChoices.join(', ')}`;
    }
    
    return context;
  }
  
  private parseOutlineFromResponse(content: string): StoryArchitectOutput {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
    
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON from LLM response');
    }
    
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      
      // Validate required fields
      if (!parsed.episodeOutline || !parsed.episodeOutline.title) {
        throw new Error('Invalid outline structure');
      }
      
      return parsed as StoryArchitectOutput;
    } catch (error) {
      console.error('Failed to parse outline:', error);
      throw new Error(`Failed to parse episode outline: ${error}`);
    }
  }
  
  // ==================== Validation ====================
  
  private validateOutline(outline: EpisodeOutline): void {
    // Check requirements
    if (outline.estimatedPlayTime < 10 || outline.estimatedPlayTime > 15) {
      console.warn(`[River] Warning: Play time ${outline.estimatedPlayTime} outside 10-15 min range`);
    }
    
    if (outline.choicePoints.length < 5) {
      console.warn(`[River] Warning: Only ${outline.choicePoints.length} choice points (min 5 recommended)`);
    }
    
    if (outline.branches.length < 2) {
      console.warn(`[River] Warning: Only ${outline.branches.length} branches (min 2 required)`);
    }
    
    if (outline.targetTraits.length < 3 || outline.targetTraits.length > 5) {
      console.warn(`[River] Warning: ${outline.targetTraits.length} target traits (3-5 recommended)`);
    }
  }
}
