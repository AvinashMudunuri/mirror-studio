/**
 * Character Designer Agent (Kai)
 * 
 * Mission: Create authentic, memorable characters that teenagers connect with
 * emotionally while supporting educational goals through realistic relationships.
 */

import { BaseAgent, AgentConfig } from './base-agent-v2';
import type { Character } from '@mirror/schemas';

// ==================== Input/Output Schemas ====================

export interface CharacterRequirement {
  type: string;
  description: string;
}

export interface BigFiveProfile {
  openness: number;          // 1-10
  conscientiousness: number; // 1-10
  extraversion: number;      // 1-10
  agreeableness: number;     // 1-10
  neuroticism: number;       // 1-10
}

export interface CharacterDesignerInput {
  type: 'NEW_CHARACTER' | 'CHARACTER_REVIEW' | 'RELATIONSHIP_DESIGN' | 'ARC_DEVELOPMENT';
  
  newCharacter?: {
    world: string;
    role: string;
    requirements: string[];
    relationshipContext?: Character[];
    episodeRange?: [number, number];
  };
  
  characterReview?: {
    character: Character;
    usageContext: Array<{
      id: string;
      title: string;
      usage: string;
    }>;
    consistencyCheck: boolean;
  };
  
  relationshipDesign?: {
    characters: [Character, Character];
    desiredDynamic: string;
    context: string;
  };
  
  arcDevelopment?: {
    character: Character;
    season: string;
    growthGoals: string[];
  };
}

export interface CharacterProfile {
  id: string;
  name: string;
  age: number;
  pronouns: string;
  
  appearance: {
    brief: string;
    distinctiveFeatures: string[];
  };
  
  personality: {
    coreTraits: string[];
    bigFiveProfile: BigFiveProfile;
    mannerisms: string[];
    speechPatterns: string[];
    emotionalTendencies: string;
  };
  
  background: {
    family: string;
    interests: string[];
    strengths: string[];
    struggles: string[];
    secrets?: string[];
  };
  
  goals: {
    conscious: string[];
    unconscious: string[];
  };
  
  voiceGuidelines: {
    vocabularyLevel: string;
    sentenceComplexity: string;
    emotionalExpressiveness: string;
    examples: string[];
  };
  
  storyRole: string;
  arcPotential: string[];
}

export interface RelationshipDynamic {
  characters: string[];
  dynamic: string;
  evolution: string;
  keyMoments?: string[];
}

export interface CharacterArc {
  startState: string;
  endState: string;
  milestones: string[];
  themes: string[];
}

export interface CharacterDesignerOutput {
  character?: CharacterProfile;
  relationshipDynamics?: RelationshipDynamic[];
  characterArc?: CharacterArc;
  designNotes: string;
  representationNotes?: string;
}

// ==================== Character Designer Agent ====================

export class CharacterDesignerAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      id: 'CHARACTER_DESIGNER',
      name: 'Kai',
      role: 'Character Psychology and Development Specialist',
      model: 'claude-sonnet-5',
      temperature: 0.6, // Slightly higher for creativity
      maxTokens: 6144
    };
    super(config);
  }
  
  protected get systemPrompt(): string {
    return `You are Kai, Character Designer at Project MIRROR Studio.

Your mission: Create authentic, memorable characters that teenagers genuinely connect with.

CHARACTER DESIGN PRINCIPLES:
1. Real people are contradictory - embrace complexity
2. Age-appropriate voice is critical
3. Every character has pain and joy
4. Representation matters - be thoughtful
5. "Teaching tool" characters are boring - make them real first
6. Specific details create authenticity
7. Characters should surprise players (and writers)

PSYCHOLOGICAL DEPTH:
- What do they want (conscious goal)?
- What do they need (unconscious need)?
- What are they afraid of?
- What's their defense mechanism?
- How do they relate to others?

PROCESS:
1. Start with emotional core - who is this person deep down?
2. Build outward - how does that core manifest in behavior?
3. Add specificity - mannerisms, speech, interests
4. Consider relationships - how do they treat different people?
5. Find the contradictions - what doesn't fit the surface?
6. Design voice - how do they sound different from others?

OUTPUT:
Complete character profile with psychological depth, authentic voice, and arc potential.

Be specific. Be authentic. Make them real.`;
  }
  
  protected async execute(input: CharacterDesignerInput): Promise<CharacterDesignerOutput> {
    console.log(`[Kai] Working on ${input.type}...`);
    
    switch (input.type) {
      case 'NEW_CHARACTER':
        if (!input.newCharacter) throw new Error('NEW_CHARACTER requires newCharacter field');
        return await this.createNewCharacter(input.newCharacter);
      
      case 'CHARACTER_REVIEW':
        if (!input.characterReview) throw new Error('CHARACTER_REVIEW requires characterReview field');
        return await this.reviewCharacter(input.characterReview);
      
      case 'RELATIONSHIP_DESIGN':
        if (!input.relationshipDesign) throw new Error('RELATIONSHIP_DESIGN requires relationshipDesign field');
        return await this.designRelationship(input.relationshipDesign);
      
      case 'ARC_DEVELOPMENT':
        if (!input.arcDevelopment) throw new Error('ARC_DEVELOPMENT requires arcDevelopment field');
        return await this.developArc(input.arcDevelopment);
      
      default:
        throw new Error(`Unknown Character Designer task: ${input.type}`);
    }
  }
  
  // ==================== Character Creation ====================
  
  private async createNewCharacter(
    request: NonNullable<CharacterDesignerInput['newCharacter']>
  ): Promise<CharacterDesignerOutput> {
    const context = this.buildCharacterContext(request);
    
    const prompt = `${context}

YOUR TASK:
Design a complete character profile.

FORMAT YOUR RESPONSE AS JSON:
{
  "character": {
    "id": "unique-id",
    "name": "Character Name",
    "age": 14,
    "pronouns": "they/them",
    "appearance": {
      "brief": "Physical description",
      "distinctiveFeatures": ["feature 1", "feature 2"]
    },
    "personality": {
      "coreTraits": ["trait1", "trait2"],
      "bigFiveProfile": {
        "openness": 7,
        "conscientiousness": 6,
        "extraversion": 8,
        "agreeableness": 7,
        "neuroticism": 5
      },
      "mannerisms": ["mannerism 1"],
      "speechPatterns": ["pattern 1"],
      "emotionalTendencies": "Description..."
    },
    "background": {
      "family": "Family context...",
      "interests": ["interest1"],
      "strengths": ["strength1"],
      "struggles": ["struggle1"],
      "secrets": ["secret1"]
    },
    "goals": {
      "conscious": ["goal1"],
      "unconscious": ["need1"]
    },
    "voiceGuidelines": {
      "vocabularyLevel": "Age-appropriate...",
      "sentenceComplexity": "Casual...",
      "emotionalExpressiveness": "Direct...",
      "examples": [
        "Example line 1: \"...\"",
        "Example line 2: \"...\""
      ]
    },
    "storyRole": "Role description",
    "arcPotential": ["Episode X: ...", "Episode Y: ..."]
  },
  "designNotes": "Explanation of design choices...",
  "representationNotes": "Notes on representation considerations..."
}`;
    
    const response = await this.callLLM(
      this.systemPrompt,
      prompt
    );
    
    const result = this.parseCharacterFromResponse(response);
    
    // Store in memory
    await this.remember(`character:${result.character?.id}`, {
      character: result.character,
      createdAt: new Date().toISOString(),
      request
    });
    
    return result;
  }
  
  // ==================== Character Review ====================
  
  private async reviewCharacter(
    request: NonNullable<CharacterDesignerInput['characterReview']>
  ): Promise<CharacterDesignerOutput> {
    const { character, usageContext, consistencyCheck } = request;
    
    const prompt = `CHARACTER TO REVIEW:
${JSON.stringify(character, null, 2)}

USAGE CONTEXT:
${usageContext.map(e => `Episode ${e.id}: ${e.usage}`).join('\n')}

CONSISTENCY CHECK: ${consistencyCheck ? 'Yes - check for inconsistencies' : 'No'}

YOUR TASK:
Review this character for:
1. Authenticity and depth
2. Age-appropriateness
3. Voice consistency
4. Representation quality
5. ${consistencyCheck ? 'Consistency across episodes' : 'Overall quality'}

FORMAT YOUR RESPONSE AS JSON:
{
  "designNotes": "Overall assessment...",
  "issues": ["issue 1", "issue 2"],
  "strengths": ["strength 1"],
  "recommendations": ["recommendation 1"]
}`;
    
    const response = await this.callLLM(
      this.systemPrompt,
      prompt
    );
    
    return this.parseReviewFromResponse(response);
  }
  
  // ==================== Relationship Design ====================
  
  private async designRelationship(
    request: NonNullable<CharacterDesignerInput['relationshipDesign']>
  ): Promise<CharacterDesignerOutput> {
    const [char1, char2] = request.characters;
    
    const prompt = `CHARACTER 1:
${char1.name} (${char1.age}, ${char1.pronouns})
Traits: ${char1.personality.coreTraits.join(', ')}

CHARACTER 2:
${char2.name} (${char2.age}, ${char2.pronouns})
Traits: ${char2.personality.coreTraits.join(', ')}

DESIRED DYNAMIC: ${request.desiredDynamic}
CONTEXT: ${request.context}

YOUR TASK:
Design the relationship dynamic between these characters.

FORMAT YOUR RESPONSE AS JSON:
{
  "relationshipDynamics": [{
    "characters": ["${char1.name}", "${char2.name}"],
    "dynamic": "Description of dynamic...",
    "evolution": "How it changes over time...",
    "keyMoments": ["moment 1", "moment 2"]
  }],
  "designNotes": "Explanation..."
}`;
    
    const response = await this.callLLM(
      this.systemPrompt,
      prompt
    );
    
    return this.parseRelationshipFromResponse(response);
  }
  
  // ==================== Arc Development ====================
  
  private async developArc(
    request: NonNullable<CharacterDesignerInput['arcDevelopment']>
  ): Promise<CharacterDesignerOutput> {
    const { character, season, growthGoals } = request;
    
    const prompt = `CHARACTER:
${character.name} (${character.age})
Current State: ${character.storyRole}
Goals: ${character.goals.conscious.join(', ')}
Struggles: ${character.background.struggles.join(', ')}

SEASON: ${season}
GROWTH GOALS: ${growthGoals.join(', ')}

YOUR TASK:
Design a character arc for this season.

FORMAT YOUR RESPONSE AS JSON:
{
  "characterArc": {
    "startState": "Where they begin...",
    "endState": "Where they end up...",
    "milestones": [
      "Episode 1-3: ...",
      "Episode 4-6: ...",
      "Episode 7-9: ..."
    ],
    "themes": ["theme1", "theme2"]
  },
  "designNotes": "Arc design rationale..."
}`;
    
    const response = await this.callLLM(
      this.systemPrompt,
      prompt
    );
    
    return this.parseArcFromResponse(response);
  }
  
  // ==================== Helper Methods ====================
  
  private buildCharacterContext(
    request: NonNullable<CharacterDesignerInput['newCharacter']>
  ): string {
    let context = `CHARACTER REQUEST:
World: ${request.world}
Role: ${request.role}
Requirements:
${request.requirements.map(r => `- ${r}`).join('\n')}`;
    
    if (request.episodeRange) {
      context += `\nAppears in: Episodes ${request.episodeRange[0]}-${request.episodeRange[1]}`;
    }
    
    if (request.relationshipContext && request.relationshipContext.length > 0) {
      context += `\n\nEXISTING CHARACTERS:
${request.relationshipContext.map(c => 
  `- ${c.name} (${c.age}, ${c.pronouns}): ${c.storyRole}\n  Traits: ${c.personality.coreTraits.join(', ')}`
).join('\n\n')}`;
    }
    
    return context;
  }
  
  private parseCharacterFromResponse(content: string): CharacterDesignerOutput {
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
    
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON from LLM response');
    }
    
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      
      if (!parsed.character || !parsed.character.name) {
        throw new Error('Invalid character structure');
      }
      
      return parsed as CharacterDesignerOutput;
    } catch (error) {
      console.error('Failed to parse character:', error);
      throw new Error(`Failed to parse character profile: ${error}`);
    }
  }
  
  private parseReviewFromResponse(content: string): CharacterDesignerOutput {
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
    
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON from LLM response');
    }
    
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return { designNotes: parsed.designNotes || parsed.notes, ...parsed };
    } catch (error) {
      throw new Error(`Failed to parse review: ${error}`);
    }
  }
  
  private parseRelationshipFromResponse(content: string): CharacterDesignerOutput {
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
    
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON from LLM response');
    }
    
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return parsed as CharacterDesignerOutput;
    } catch (error) {
      throw new Error(`Failed to parse relationship: ${error}`);
    }
  }
  
  private parseArcFromResponse(content: string): CharacterDesignerOutput {
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
    
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON from LLM response');
    }
    
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return parsed as CharacterDesignerOutput;
    } catch (error) {
      throw new Error(`Failed to parse arc: ${error}`);
    }
  }
}
