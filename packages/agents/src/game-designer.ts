import { BaseAgent, AgentConfig } from './base-agent-v2';
import { getAgentModel, getAgentTemperature, getAgentMaxTokens } from './config';
import { ReviewParseError, requireEnum, requireScore } from './errors';
import { jsonrepair } from 'jsonrepair';
import type { Episode, Character, World } from '@mirror/schemas';

// ============================================================================
// Types
// ============================================================================

export interface GameplayIssue {
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  category: 'ENGAGEMENT' | 'CHOICES' | 'PACING' | 'AGENCY' | 'REPLAYABILITY' | 'TUTORIAL';
  issue: string;
  location: string;
  impact: string;
  fix: string;
  priority: number;
}

export interface GameDesignerInput {
  type: 'REVIEW_EPISODE' | 'REVIEW_SCENE' | 'REVIEW_CHOICES';
  
  episodeReview?: {
    episode: Episode;
    characters: Character[];
    world: World;
  };
  
  sceneReview?: {
    scene: any;
    previousScenes: any[];
    context: string;
  };
  
  choiceReview?: {
    choices: any[];
    context: string;
  };
}

export interface GameDesignerOutput {
  status: 'EXCELLENT' | 'GOOD' | 'NEEDS_WORK' | 'POOR';
  issues: GameplayIssue[];
  strengths: string[];
  recommendations: string[];
  scores: {
    engagement: number;
    choiceQuality: number;
    pacing: number;
    playerAgency: number;
    replayability: number;
    overall: number;
  };
  metrics: {
    averageSceneLength: number;
    choiceFrequency: number;
    branchingFactor: number;
    estimatedReplayValue: number;
  };
  summary: {
    verdict: string;
    keyIssues: string[];
    topStrengths: string[];
    mustFix: string[];
    niceToHave: string[];
  };
}

// ============================================================================
// Game Designer Agent
// ============================================================================

export class GameDesignerAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      id: 'GAME_DESIGNER',
      name: 'Jordan',
      role: 'Gameplay & Engagement Specialist',
      model: getAgentModel('GAME_DESIGNER'),
      temperature: getAgentTemperature('GAME_DESIGNER'),
      maxTokens: getAgentMaxTokens('GAME_DESIGNER')
    };
    super(config);
  }
  
  protected get systemPrompt(): string {
    return `You are Jordan, the Game Designer for Project MIRROR Studio.

Your mission: Ensure every episode is engaging, well-paced, and delivers a compelling gameplay experience. You care about whether players are having FUN.

EXPERTISE:
- Engagement design and hooks
- Choice architecture and meaningful decisions
- Pacing and flow
- Player agency and control
- Replayability and variety
- Tutorial design

EVALUATION FRAMEWORK:

1. ENGAGEMENT (Hook, Pacing, Emotional Beats)
   - Does the opening grab attention?
   - Are there curiosity gaps driving forward momentum?
   - Does emotional intensity vary appropriately?
   - Is there a clear arc (setup, conflict, resolution)?
   - Any boring or dragging sections?

2. CHOICE QUALITY (Meaningful, Interesting, Expressive)
   - Do choices have real consequences?
   - Are there interesting trade-offs (no obvious "right" answer)?
   - Can players express their values through choices?
   - Are choices clearly framed?
   - Is there variety in choice types?

3. PACING (Rhythm, Flow, Transitions)
   - Do scene lengths vary appropriately?
   - Is there tension/release rhythm?
   - Does information release at good pace?
   - Do scenes transition smoothly?
   - Any sudden pace changes that jar?

4. PLAYER AGENCY (Control, Impact, Expression)
   - Do players get regular opportunities to choose?
   - Can they see the impact of their choices?
   - Can they play different "styles"?
   - Do they feel in control or railroaded?
   - Is player power appropriate?

5. REPLAYABILITY (Variety, Secrets, Discovery)
   - Are paths significantly different?
   - Is there hidden content to discover?
   - Do different trait builds work?
   - Would players want to replay?
   - Any secrets or Easter eggs?

6. TUTORIAL INTEGRATION (Natural, Gradual, Unobtrusive)
   - Do players learn by doing?
   - Is complexity introduced gradually?
   - Does it break immersion?
   - Is guidance available when needed?
   - Can experienced players skip it?

SCORING CRITERIA (1-10):
10: Best-in-class, exceptional
8-9: Excellent, minor tweaks only
6-7: Good, some improvements needed
4-5: Needs work, several issues
1-3: Poor, major problems

STATUS LEVELS:
- EXCELLENT: 8+ overall, outstanding gameplay
- GOOD: 6-7 overall, solid with room for improvement
- NEEDS_WORK: 4-5 overall, significant issues to address
- POOR: <4 overall, major rework required

FORMAT YOUR RESPONSE AS JSON:
{
  "status": "EXCELLENT" | "GOOD" | "NEEDS_WORK" | "POOR",
  "issues": [
    {
      "severity": "CRITICAL" | "MAJOR" | "MINOR",
      "category": "ENGAGEMENT" | "CHOICES" | "PACING" | "AGENCY" | "REPLAYABILITY" | "TUTORIAL",
      "issue": "description",
      "location": "where",
      "impact": "how this hurts player experience",
      "fix": "specific improvement",
      "priority": 1-10
    }
  ],
  "strengths": ["what works well"],
  "recommendations": ["improvements"],
  "scores": {
    "engagement": 1-10,
    "choiceQuality": 1-10,
    "pacing": 1-10,
    "playerAgency": 1-10,
    "replayability": 1-10,
    "overall": 1-10
  },
  "metrics": {
    "averageSceneLength": seconds,
    "choiceFrequency": choices_per_minute,
    "branchingFactor": avg_paths_per_choice,
    "estimatedReplayValue": 1-10
  },
  "summary": {
    "verdict": "overall assessment",
    "keyIssues": ["main problems"],
    "topStrengths": ["best parts"],
    "mustFix": ["critical improvements"],
    "niceToHave": ["optional improvements"]
  }
}

Remember: You're evaluating GAMEPLAY and FUN FACTOR, not just story quality. A well-written story can still be boring to play!`;
  }
  
  protected async execute(input: GameDesignerInput): Promise<GameDesignerOutput> {
    console.log(`[Jordan] Performing ${input.type} review...`);
    
    if (input.type === 'REVIEW_EPISODE' && input.episodeReview) {
      return await this.reviewEpisode(input.episodeReview);
    } else if (input.type === 'REVIEW_SCENE' && input.sceneReview) {
      return await this.reviewScene(input.sceneReview);
    } else if (input.type === 'REVIEW_CHOICES' && input.choiceReview) {
      return await this.reviewChoices(input.choiceReview);
    } else {
      throw new Error('Invalid Game Designer input type');
    }
  }
  
  // ==================== Episode Review ====================
  
  private async reviewEpisode(
    review: NonNullable<GameDesignerInput['episodeReview']>
  ): Promise<GameDesignerOutput> {
    const { episode, characters, world } = review;
    
    // Scripts may pass partially-assembled episodes; the full JSON below is
    // the real review payload, so missing summary fields must not crash.
    const prompt = `REVIEW EPISODE FOR GAMEPLAY AND ENGAGEMENT:

EPISODE:
Title: ${episode.title}
Synopsis: ${episode.synopsis}
Themes: ${episode.themes?.join(', ') || 'Not specified'}
Target Traits: ${(episode.targetTraits as unknown[])?.map(t => typeof t === 'string' ? t : JSON.stringify(t)).join(', ') || 'Not specified'}
Estimated Play Time: ${episode.estimatedPlayTime ?? 'Not specified'} minutes
Scenes: ${episode.scenes?.length ?? 0}
Characters: ${episode.characters?.length ?? 0}

Full Episode Data: ${JSON.stringify(episode, null, 2)}

CHARACTERS:
${characters.map(c => `- ${c.name}: ${c.personality.coreTraits.join(', ')}`).join('\n')}

WORLD:
${world.description}

YOUR TASK:
Evaluate this episode's GAMEPLAY and ENGAGEMENT. Focus on whether it's FUN TO PLAY, not just well-written.

1. ENGAGEMENT
   - Opening hook: Does it grab attention immediately?
   - Curiosity gaps: Unanswered questions driving momentum?
   - Emotional variation: Does intensity rise and fall?
   - Arc clarity: Setup → conflict → resolution?
   - Dead spots: Any boring sections?

2. CHOICE QUALITY
   - Consequences: Do choices matter or feel cosmetic?
   - Trade-offs: Interesting dilemmas with no "right" answer?
   - Expression: Can players express their values?
   - Clarity: Are choices well-framed?
   - Variety: Different types of decisions?

3. PACING
   - Scene rhythm: Varied lengths or monotonous?
   - Tension: Building and releasing appropriately?
   - Information: Good dosing or info dumps?
   - Transitions: Smooth or jarring?
   - Flow: Natural progression?

4. PLAYER AGENCY
   - Choice frequency: Regular opportunities or railroading?
   - Impact visibility: See results of choices?
   - Playstyle variety: Different approaches viable?
   - Control: Player-driven or passive observer?

5. REPLAYABILITY
   - Path variety: Significantly different routes?
   - Secrets: Hidden content to discover?
   - Outcomes: Different endings/results?
   - Build variety: Multiple strategies work?

6. TUTORIAL
   - Learning: Natural or forced?
   - Complexity: Gradual introduction?
   - Immersion: Breaks flow or seamless?

Calculate:
- Average scene length (estimated)
- Choice frequency (choices per minute)
- Branching factor (avg paths per choice)
- Replay value estimate (1-10)

Rate each dimension 1-10, identify issues with severity and priority, provide specific fixes.

Return your assessment as JSON in the format specified in your system prompt.`;

    const response = await this.callLLM(this.systemPrompt, prompt);
    const result = this.parseReview(response);
    
    // Store in memory
    await this.remember(`gameplay-review:${episode.id}`, {
      episode: episode.id,
      result,
      timestamp: new Date().toISOString()
    });
    
    return result;
  }
  
  // ==================== Scene Review ====================
  
  private async reviewScene(
    review: NonNullable<GameDesignerInput['sceneReview']>
  ): Promise<GameDesignerOutput> {
    const { scene, previousScenes, context } = review;
    
    const prompt = `REVIEW SCENE FOR GAMEPLAY:

SCENE:
${JSON.stringify(scene, null, 2)}

PREVIOUS SCENES: ${previousScenes.length}
CONTEXT: ${context}

YOUR TASK:
Evaluate this scene's pacing, engagement, and player experience.
Focus on whether it flows well and maintains interest.

Return assessment in JSON format.`;

    const response = await this.callLLM(this.systemPrompt, prompt);
    return this.parseReview(response);
  }
  
  // ==================== Choice Review ====================
  
  private async reviewChoices(
    review: NonNullable<GameDesignerInput['choiceReview']>
  ): Promise<GameDesignerOutput> {
    const { choices, context } = review;
    
    const prompt = `REVIEW CHOICES FOR GAMEPLAY:

CHOICES:
${JSON.stringify(choices, null, 2)}

CONTEXT: ${context}

YOUR TASK:
Evaluate choice quality: meaningful consequences, interesting trade-offs, 
clear framing, variety.

Return assessment in JSON format.`;

    const response = await this.callLLM(this.systemPrompt, prompt);
    return this.parseReview(response);
  }
  
  // ==================== Helper Methods ====================
  
  private parseReview(content: string): GameDesignerOutput {
    // Log response for debugging
    console.log('[Game Designer] Response length:', content.length);
    console.log('[Game Designer] Response preview:', content.substring(0, 500));
    
    // Extract JSON
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
    
    if (!jsonMatch) {
      console.error('[Game Designer] No JSON found in response');
      console.error('Full response:', content);
      throw new ReviewParseError(
        this.config.id,
        'No JSON found in LLM review response',
        content
      );
    }
    
    let jsonString = jsonMatch[1];
    
    // Clean and repair JSON
    jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
    jsonString = jsonString.replace(/\/\/[^\n]*/g, '');
    jsonString = jsonString.replace(/\/\*[\s\S]*?\*\//g, '');
    jsonString = jsonString.trim();
    
    try {
      console.log('[Game Designer] Attempting to repair JSON...');
      jsonString = jsonrepair(jsonString);
      console.log('[Game Designer] JSON repair successful');
    } catch (repairError) {
      console.warn('[Game Designer] JSON repair failed:', repairError);
    }
    
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch (error) {
      console.error('[Game Designer] Failed to parse JSON:', error);
      console.error('JSON string:', jsonString.substring(0, 1000));
      throw new ReviewParseError(
        this.config.id,
        `LLM review response is not valid JSON: ${error}`,
        content
      );
    }
    
    const normalized = this.normalizeOutput(parsed, content);
    console.log('[Game Designer] Successfully parsed review:', normalized.status);
    return normalized;
  }
  
  private normalizeOutput(parsed: any, rawResponse: string): GameDesignerOutput {
    // Verdict and scores must come from the LLM; fabricated defaults would
    // masquerade as a real gameplay assessment. Informational lists and
    // metrics may default (missing metrics don't change the verdict).
    return {
      status: requireEnum(this.config.id, rawResponse, 'status', parsed.status,
        ['EXCELLENT', 'GOOD', 'NEEDS_WORK', 'POOR'] as const),
      issues: parsed.issues || [],
      strengths: parsed.strengths || [],
      recommendations: parsed.recommendations || [],
      scores: {
        engagement: requireScore(this.config.id, rawResponse, 'scores.engagement', parsed.scores?.engagement),
        choiceQuality: requireScore(this.config.id, rawResponse, 'scores.choiceQuality', parsed.scores?.choiceQuality),
        pacing: requireScore(this.config.id, rawResponse, 'scores.pacing', parsed.scores?.pacing),
        playerAgency: requireScore(this.config.id, rawResponse, 'scores.playerAgency', parsed.scores?.playerAgency),
        replayability: requireScore(this.config.id, rawResponse, 'scores.replayability', parsed.scores?.replayability),
        overall: requireScore(this.config.id, rawResponse, 'scores.overall', parsed.scores?.overall)
      },
      metrics: {
        averageSceneLength: parsed.metrics?.averageSceneLength ?? 0,
        choiceFrequency: parsed.metrics?.choiceFrequency ?? 0,
        branchingFactor: parsed.metrics?.branchingFactor ?? 0,
        estimatedReplayValue: parsed.metrics?.estimatedReplayValue ?? 0
      },
      summary: {
        verdict: parsed.summary?.verdict || 'No verdict provided',
        keyIssues: parsed.summary?.keyIssues || [],
        topStrengths: parsed.summary?.topStrengths || [],
        mustFix: parsed.summary?.mustFix || [],
        niceToHave: parsed.summary?.niceToHave || []
      }
    };
  }
}
