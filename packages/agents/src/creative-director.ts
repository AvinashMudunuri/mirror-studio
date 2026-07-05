import { BaseAgent, AgentConfig } from './base-agent-v2';
import { getAgentModel, getAgentTemperature, getAgentMaxTokens } from './config';
import { jsonrepair } from 'jsonrepair';
import type { 
  Episode, 
  World,
  AgentId
} from '@mirror/schemas';
import type { 
  StoryCharacterArc 
} from './story-architect';

// ============================================================================
// Types
// ============================================================================

export interface Theme {
  name: string;
  description: string;
}

export interface SeasonBrief {
  world: World;
  themes: Theme[];
  characterArcs: StoryCharacterArc[];
  episodeCount: number;
}

export interface EpisodeReference {
  id: string;
  title: string;
  synopsis: string;
  themes: string[];
  playerRatings?: {
    storyQuality: number;
    engagement: number;
    emotionalImpact: number;
  };
}

export interface CreativeChallenge {
  from: AgentId;
  concern: string;
  artifact: any;
}

export interface Reference {
  type: 'FILM' | 'TV' | 'BOOK' | 'GAME' | 'OTHER';
  title: string;
  reasoning: string;
}

// ============================================================================
// Input/Output Interfaces
// ============================================================================

export interface CreativeDirectorInput {
  type: 'SEASON_BRIEF' | 'EPISODE_REVIEW' | 'WORLD_CONSISTENCY_CHECK' | 'CREATIVE_CHALLENGE';
  
  seasonBrief?: SeasonBrief;
  
  episodeReview?: {
    episode: Episode;
    worldContext: World;
    previousEpisodes: EpisodeReference[];
  };
  
  worldConsistencyCheck?: {
    episode: Episode;
    world: World;
    previousEpisodes: EpisodeReference[];
  };
  
  challenge?: CreativeChallenge;
}

export interface CreativeDirectorOutput {
  decision: 'APPROVED' | 'NEEDS_REVISION' | 'REJECTED';
  creativeNotes: string;
  specificFeedback: {
    story?: string[];
    character?: string[];
    dialogue?: string[];
    tone?: string[];
  };
  inspirationReferences?: Reference[];
  revisionPriority: 'LOW' | 'MEDIUM' | 'HIGH';
}

// ============================================================================
// Creative Director Agent
// ============================================================================

export class CreativeDirectorAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      id: 'CREATIVE_DIRECTOR',
      name: 'Aria',
      role: 'Creative Vision Keeper',
      model: getAgentModel('CREATIVE_DIRECTOR'),
      temperature: getAgentTemperature('CREATIVE_DIRECTOR'),
      maxTokens: getAgentMaxTokens('CREATIVE_DIRECTOR')
    };
    super(config);
  }
  
  protected get systemPrompt(): string {
    return `You are Aria, Creative Director at Project MIRROR Studio.

Your mission: Ensure every episode is emotionally resonant, creatively excellent, and true to its world.

CREATIVE STANDARDS:
- Every scene must serve character or plot
- Dialogue must sound authentic to age and personality
- Emotional beats must earn their moments
- Choices must matter
- World consistency is non-negotiable

YOUR ROLE:
- Define creative direction for each season
- Ensure tonal consistency across episodes
- Review all creative output for quality
- Challenge creatively safe or derivative work
- Maintain world bibles
- Mentor other creative agents

REVIEW CRITERIA:
- Would teenagers actually want to experience this story?
- Are the characters compelling and consistent?
- Does the dialogue sound real?
- Are the emotional moments earned or manipulative?
- Does this add to the world or feel disconnected?
- Is this creatively brave or safe?

OUTPUT FORMAT:
Respond with a JSON object containing:
{
  "decision": "APPROVED" | "NEEDS_REVISION" | "REJECTED",
  "creativeNotes": "string (overall assessment)",
  "specificFeedback": {
    "story": ["string array of story feedback"],
    "character": ["string array of character feedback"],
    "dialogue": ["string array of dialogue feedback"],
    "tone": ["string array of tone feedback"]
  },
  "inspirationReferences": [
    {
      "type": "FILM" | "TV" | "BOOK" | "GAME" | "OTHER",
      "title": "string",
      "reasoning": "string"
    }
  ],
  "revisionPriority": "LOW" | "MEDIUM" | "HIGH"
}

Be honest. Be specific. Push for excellence.`;
  }
  
  protected async execute(input: CreativeDirectorInput): Promise<CreativeDirectorOutput> {
    switch (input.type) {
      case 'SEASON_BRIEF':
        if (!input.seasonBrief) {
          throw new Error('Season brief is required for SEASON_BRIEF type');
        }
        return await this.reviewSeasonBrief(input.seasonBrief);
        
      case 'EPISODE_REVIEW':
        if (!input.episodeReview) {
          throw new Error('Episode review data is required for EPISODE_REVIEW type');
        }
        return await this.reviewEpisode(input.episodeReview);
        
      case 'WORLD_CONSISTENCY_CHECK':
        if (!input.worldConsistencyCheck) {
          throw new Error('World consistency data is required for WORLD_CONSISTENCY_CHECK type');
        }
        return await this.checkWorldConsistency(input.worldConsistencyCheck);
        
      case 'CREATIVE_CHALLENGE':
        if (!input.challenge) {
          throw new Error('Challenge data is required for CREATIVE_CHALLENGE type');
        }
        return await this.respondToChallenge(input.challenge);
        
      default:
        throw new Error(`Unknown CreativeDirector input type: ${(input as any).type}`);
    }
  }
  
  // ============================================================================
  // Private Methods
  // ============================================================================
  
  private async reviewSeasonBrief(brief: SeasonBrief): Promise<CreativeDirectorOutput> {
    const context = this.buildSeasonContext(brief);
    
    const userPrompt = `SEASON BRIEF FOR REVIEW:

World: ${brief.world.name}
Episode Count: ${brief.episodeCount}

Themes:
${brief.themes.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Character Arcs:
${brief.characterArcs.map(arc => `- ${arc.characterId}: ${arc.startState} → ${arc.endState}`).join('\n')}

Context:
${context}

Review this season brief for creative direction. Consider:
- Are the themes rich and engaging for teenagers?
- Do the character arcs provide emotional depth?
- Is there variety and progression across episodes?
- Does this season have a clear identity?
- Are we pushing creative boundaries?

Provide your creative assessment.`;

    const response = await this.callLLM(this.systemPrompt, userPrompt);
    const output = this.parseCreativeResponse(response);
    
    await this.remember('season_brief', brief);
    await this.remember('season_review', output);
    
    return output;
  }
  
  private async reviewEpisode(review: NonNullable<CreativeDirectorInput['episodeReview']>): Promise<CreativeDirectorOutput> {
    const context = this.buildEpisodeContext(review);
    
    const userPrompt = `EPISODE FOR CREATIVE REVIEW:

Title: ${review.episode.title}
Synopsis: ${review.episode.synopsis}

World: ${review.worldContext.name}
Themes: ${review.episode.themes?.join(', ') || 'None specified'}

Previous Episodes in Season:
${review.previousEpisodes.map(ep => `- ${ep.title}: ${ep.synopsis}`).join('\n')}

Episode Details:
${JSON.stringify(review.episode, null, 2)}

Context:
${context}

Review this episode for creative quality. Consider:
- Story structure and pacing
- Character consistency and development
- Dialogue authenticity
- Emotional beats (earned or manipulative?)
- World consistency
- Originality vs. derivative work
- Engagement for target audience (teenagers)

Provide detailed creative feedback with specific examples.`;

    const response = await this.callLLM(this.systemPrompt, userPrompt);
    const output = this.parseCreativeResponse(response);
    
    await this.remember(`episode_${review.episode.id}_review`, {
      episode: review.episode,
      review: output,
      timestamp: new Date().toISOString()
    });
    
    return output;
  }
  
  private async checkWorldConsistency(check: NonNullable<CreativeDirectorInput['worldConsistencyCheck']>): Promise<CreativeDirectorOutput> {
    const context = this.buildWorldConsistencyContext(check);
    
    const userPrompt = `WORLD CONSISTENCY CHECK:

World: ${check.world.name}
Description: ${check.world.description}

Episode Under Review: ${check.episode.title}

Previous Episodes:
${check.previousEpisodes.map(ep => `- ${ep.title}: ${ep.synopsis}`).join('\n')}

Context:
${context}

Check this episode for consistency with the established world:
- Tone and atmosphere
- Character voices and behaviors
- World rules and logic
- Thematic coherence
- Established lore

Identify any inconsistencies and assess their severity.`;

    const response = await this.callLLM(this.systemPrompt, userPrompt);
    const output = this.parseCreativeResponse(response);
    
    await this.remember('world_consistency_check', {
      episode: check.episode.id,
      result: output,
      timestamp: new Date().toISOString()
    });
    
    return output;
  }
  
  private async respondToChallenge(challenge: CreativeChallenge): Promise<CreativeDirectorOutput> {
    const userPrompt = `CREATIVE CHALLENGE:

From: ${challenge.from}
Concern: ${challenge.concern}

Artifact Under Discussion:
${JSON.stringify(challenge.artifact, null, 2)}

A colleague has raised a creative concern. Review the artifact and respond:
- Do you agree with the concern?
- What's your creative assessment?
- How would you improve this?
- What creative principles are at stake?

Be honest and constructive.`;

    const response = await this.callLLM(this.systemPrompt, userPrompt);
    const output = this.parseCreativeResponse(response);
    
    await this.remember('creative_challenge', {
      from: challenge.from,
      concern: challenge.concern,
      response: output,
      timestamp: new Date().toISOString()
    });
    
    return output;
  }
  
  // ============================================================================
  // Helper Methods
  // ============================================================================
  
  private buildSeasonContext(brief: SeasonBrief): string {
    let context = `World Description: ${brief.world.description}\n`;
    
    // World has targetAge as [min, max] tuple
    if (brief.world.targetAge) {
      context += `Target Age: ${brief.world.targetAge[0]}-${brief.world.targetAge[1]}\n`;
    }
    
    // World themes are strings
    if (brief.world.themes && brief.world.themes.length > 0) {
      context += `World Themes: ${brief.world.themes.join(', ')}\n`;
    }
    
    return context;
  }
  
  private buildEpisodeContext(review: NonNullable<CreativeDirectorInput['episodeReview']>): string {
    let context = `World Description: ${review.worldContext.description}\n`;
    
    // World themes are strings
    if (review.worldContext.themes && review.worldContext.themes.length > 0) {
      context += `World Themes: ${review.worldContext.themes.join(', ')}\n`;
    }
    
    if (review.previousEpisodes.length > 0) {
      const avgRating = review.previousEpisodes
        .filter(ep => ep.playerRatings)
        .reduce((sum, ep) => sum + (ep.playerRatings?.storyQuality || 0), 0) / 
        review.previousEpisodes.filter(ep => ep.playerRatings).length;
      
      if (!isNaN(avgRating)) {
        context += `Average Story Quality (previous episodes): ${avgRating.toFixed(2)}/5\n`;
      }
    }
    
    return context;
  }
  
  private buildWorldConsistencyContext(check: NonNullable<CreativeDirectorInput['worldConsistencyCheck']>): string {
    let context = '';
    
    // World has themes as string array
    if (check.world.themes && check.world.themes.length > 0) {
      context += `World Themes: ${check.world.themes.join(', ')}\n`;
    }
    
    if (check.previousEpisodes.length > 0) {
      context += `\nEstablished Themes:\n`;
      const allThemes = new Set<string>();
      check.previousEpisodes.forEach(ep => {
        ep.themes.forEach(t => allThemes.add(t));
      });
      allThemes.forEach(theme => {
        context += `- ${theme}\n`;
      });
    }
    
    return context;
  }
  
  private parseCreativeResponse(content: string): CreativeDirectorOutput {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        decision: 'NEEDS_REVISION',
        creativeNotes: content,
        specificFeedback: {},
        revisionPriority: 'MEDIUM'
      };
    }
    
    let jsonString = jsonMatch[0];
    
    // Basic cleaning
    jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1'); // trailing commas
    jsonString = jsonString.replace(/\/\/[^\n]*/g, ''); // comments
    jsonString = jsonString.replace(/\/\*[\s\S]*?\*\//g, ''); // block comments
    jsonString = jsonString.trim();
    
    // Use jsonrepair
    try {
      console.log('[Creative Director] Attempting to repair JSON...');
      jsonString = jsonrepair(jsonString);
      console.log('[Creative Director] JSON repair successful');
    } catch (repairError) {
      console.warn('[Creative Director] JSON repair failed:', repairError);
    }
    
    try {
      const parsed = JSON.parse(jsonString);
      
      if (!parsed.decision || !['APPROVED', 'NEEDS_REVISION', 'REJECTED'].includes(parsed.decision)) {
        parsed.decision = 'NEEDS_REVISION';
      }
      
      if (!parsed.creativeNotes) {
        parsed.creativeNotes = 'Review completed';
      }
      
      if (!parsed.specificFeedback) {
        parsed.specificFeedback = {};
      }
      
      if (!parsed.revisionPriority || !['LOW', 'MEDIUM', 'HIGH'].includes(parsed.revisionPriority)) {
        parsed.revisionPriority = 'MEDIUM';
      }
      
      console.log('[Creative Director] Successfully parsed review:', parsed.decision);
      return parsed as CreativeDirectorOutput;
    } catch (error) {
      return {
        decision: 'NEEDS_REVISION',
        creativeNotes: content,
        specificFeedback: {},
        revisionPriority: 'MEDIUM'
      };
    }
  }
}
