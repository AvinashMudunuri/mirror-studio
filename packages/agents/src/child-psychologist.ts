import { BaseAgent, AgentConfig } from './base-agent-v2';
import { getAgentModel, getAgentTemperature, getAgentMaxTokens } from './config';
import { requireEnum, requireScore } from './errors';
import { parseReviewJson } from './json-parsing';
import { buildSharedReviewContext } from './review-context';
import type { Episode, Character, World } from '@mirror/schemas';

// ============================================================================
// Types
// ============================================================================

export interface SafetyConcern {
  severity: 'CRITICAL' | 'MODERATE' | 'MINOR';
  category: 'AGE_INAPPROPRIATE' | 'EMOTIONAL_SAFETY' | 'MENTAL_HEALTH' | 'RELATIONSHIPS' | 'EDUCATIONAL';
  issue: string;
  location: string;
  recommendation: string;
  mustFix: boolean;
}

export interface TriggerWarning {
  category: 'ANXIETY' | 'DEPRESSION' | 'LOSS' | 'BULLYING' | 'FAMILY_CONFLICT' | 'TRAUMA' | 'SELF_ESTEEM';
  description: string;
  severity: 'MILD' | 'MODERATE' | 'INTENSE';
  location: string;
}

export interface ChildPsychologistInput {
  type: 'REVIEW_EPISODE' | 'REVIEW_CHARACTER' | 'REVIEW_SCENE';
  
  episodeReview?: {
    episode: Episode;
    characters: Character[];
    world: World;
  };
  
  characterReview?: {
    character: Character;
    world: World;
  };
  
  sceneReview?: {
    scene: any; // Scene type from schemas
    characters: Character[];
    context: string;
  };
}

export interface ChildPsychologistOutput {
  status: 'APPROVED' | 'NEEDS_REVISION' | 'REJECTED';
  concerns: SafetyConcern[];
  recommendations: string[];
  triggerWarnings: TriggerWarning[];
  scores: {
    ageAppropriateness: number;
    emotionalSafety: number;
    educationalValue: number;
    mentalHealthRep: number;
    overall: number;
  };
  summary: {
    strengths: string[];
    improvements: string[];
    readyForAudience: boolean;
  };
}

// ============================================================================
// Child Psychologist Agent
// ============================================================================

export class ChildPsychologistAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      id: 'CHILD_PSYCHOLOGIST',
      name: 'Dr. Sam',
      role: 'Child Development & Emotional Safety Specialist',
      model: getAgentModel('CHILD_PSYCHOLOGIST'),
      temperature: getAgentTemperature('CHILD_PSYCHOLOGIST'),
      maxTokens: getAgentMaxTokens('CHILD_PSYCHOLOGIST')
    };
    super(config);
  }
  
  protected get systemPrompt(): string {
    return `You are Dr. Sam, a Child Psychologist specializing in adolescent development and educational content for Project MIRROR Studio.

Your mission: Ensure all content is safe, appropriate, and beneficial for teenagers aged 13-17. You are their advocate and protector.

EXPERTISE:
- Adolescent developmental psychology (13-17 years)
- Trauma-informed content design
- Social-emotional learning (SEL)
- Mental health representation
- Age-appropriate educational design

EVALUATION FRAMEWORK:

1. AGE APPROPRIATENESS (13-17 years)
   - Language and complexity match cognitive stage?
   - Themes relevant to teen experiences?
   - Respects teen intelligence while acknowledging developing brains?
   - Realistic consequences and cause-effect?

2. EMOTIONAL SAFETY
   - No graphic trauma or triggering content without purpose?
   - Emotional intensity appropriate?
   - Difficult topics handled sensitively?
   - Clear path toward resolution?
   - Trigger warnings needed?

3. EDUCATIONAL VALUE
   - Teaches social-emotional skills?
   - Promotes critical thinking?
   - Models healthy behaviors?
   - Growth opportunities present?
   - Aligned with learning objectives?

4. MENTAL HEALTH REPRESENTATION
   - Realistic emotional experiences?
   - Healthy coping strategies?
   - Help-seeking normalized?
   - Hope and resilience present?
   - No romanticizing or stigmatizing?

5. RELATIONSHIP DYNAMICS
   - Consent and boundaries respected?
   - Healthy communication modeled?
   - Support systems available?
   - Positive conflict resolution?
   - No toxic dynamics normalized?

6. IDENTITY & DIVERSITY
   - Authentic, respectful representation?
   - Supports identity exploration?
   - Inclusive and accepting?
   - No harmful stereotypes?

SEVERITY LEVELS:
- CRITICAL: Immediate harm risk or completely inappropriate
- MODERATE: Potentially problematic, needs revision
- MINOR: Could be improved but acceptable

DECISION CRITERIA:
- APPROVED: Safe, appropriate, beneficial (minor issues ok)
- NEEDS_REVISION: Good foundation but moderate concerns need addressing
- REJECTED: Critical safety issues or fundamentally inappropriate

FORMAT YOUR RESPONSE AS JSON:
{
  "status": "APPROVED" | "NEEDS_REVISION" | "REJECTED",
  "concerns": [
    {
      "severity": "CRITICAL" | "MODERATE" | "MINOR",
      "category": "AGE_INAPPROPRIATE" | "EMOTIONAL_SAFETY" | "MENTAL_HEALTH" | "RELATIONSHIPS" | "EDUCATIONAL",
      "issue": "Clear description",
      "location": "where in content",
      "recommendation": "specific fix",
      "mustFix": boolean
    }
  ],
  "recommendations": ["improvement suggestions"],
  "triggerWarnings": [
    {
      "category": "ANXIETY" | "DEPRESSION" | "LOSS" | "BULLYING" | "FAMILY_CONFLICT" | "TRAUMA" | "SELF_ESTEEM",
      "description": "what the trigger is",
      "severity": "MILD" | "MODERATE" | "INTENSE",
      "location": "where it appears"
    }
  ],
  "scores": {
    "ageAppropriateness": 1-10,
    "emotionalSafety": 1-10,
    "educationalValue": 1-10,
    "mentalHealthRep": 1-10,
    "overall": 1-10
  },
  "summary": {
    "strengths": ["what works well"],
    "improvements": ["what needs work"],
    "readyForAudience": boolean
  }
}

Remember: You protect teens while respecting their intelligence and capacity for growth. Be thorough but not overly cautious. Teens can handle complex emotions and challenging topics when presented appropriately.`;
  }
  
  protected async execute(input: ChildPsychologistInput): Promise<ChildPsychologistOutput> {
    console.log(`[Dr. Sam] Performing ${input.type} review...`);
    
    if (input.type === 'REVIEW_EPISODE' && input.episodeReview) {
      return await this.reviewEpisode(input.episodeReview);
    } else if (input.type === 'REVIEW_CHARACTER' && input.characterReview) {
      return await this.reviewCharacter(input.characterReview);
    } else if (input.type === 'REVIEW_SCENE' && input.sceneReview) {
      return await this.reviewScene(input.sceneReview);
    } else {
      throw new Error('Invalid Child Psychologist input type');
    }
  }
  
  // ==================== Episode Review ====================
  
  private async reviewEpisode(
    review: NonNullable<ChildPsychologistInput['episodeReview']>
  ): Promise<ChildPsychologistOutput> {
    const { episode, characters, world } = review;
    
    // Educational goals might be passed but not in official Episode type
    const educationalGoals = (episode as any).educationalGoals || [];
    
    // Same episode/character/world payload every reviewer gets on this
    // episode — cached so only the first reviewer to run pays full price.
    const systemPrompt = [
      { text: buildSharedReviewContext({ episode, characters, world }), cache: true },
      { text: this.systemPrompt }
    ];
    
    const prompt = `REVIEW EPISODE FOR PSYCHOLOGICAL SAFETY AND AGE APPROPRIATENESS (see the shared episode data above for full content):

TARGET AUDIENCE: ${world.targetAge?.[0] || 13}-${world.targetAge?.[1] || 17} years old

EPISODE SUMMARY:
Title: ${episode.title}
Synopsis: ${episode.synopsis}
Themes: ${episode.themes?.join(', ') || 'Not specified'}
Educational Goals: ${Array.isArray(educationalGoals) ? educationalGoals.join(', ') : 'Not specified'}

CHARACTERS:
${characters.map(c => `- ${c.name} (${c.age} years, ${c.pronouns}): ${c.personality.coreTraits.join(', ')}`).join('\n')}

WORLD CONTEXT:
${world.description}
Themes: ${world.themes.join(', ')}

YOUR TASK:
Perform a comprehensive psychological safety review. Evaluate:

1. AGE APPROPRIATENESS (13-17 years)
   - Is the language complexity appropriate?
   - Are themes relevant to teen experiences?
   - Does it respect teen intelligence?
   - Are consequences realistic?

2. EMOTIONAL SAFETY
   - Any graphic or triggering content?
   - Is emotional intensity appropriate?
   - Are difficult topics handled sensitively?
   - Is there a path toward resolution?
   - What trigger warnings are needed?

3. EDUCATIONAL VALUE
   - Does it teach social-emotional skills?
   - Does it promote critical thinking?
   - Does it model healthy behaviors?
   - Are growth opportunities present?

4. MENTAL HEALTH REPRESENTATION
   - Are emotions portrayed realistically?
   - Are coping strategies healthy?
   - Is help-seeking normalized?
   - Is there hope and resilience?

5. RELATIONSHIP DYNAMICS
   - Are boundaries respected?
   - Is communication healthy?
   - Are support systems available?
   - Is conflict resolution positive?

6. IDENTITY & DIVERSITY
   - Is representation authentic?
   - Does it support identity exploration?
   - Is it inclusive?
   - Are there harmful stereotypes?

Rate each area 1-10, identify concerns with severity levels, recommend improvements, and flag trigger warnings.

Return your assessment as JSON in the format specified in your system prompt.`;

    const response = await this.callLLM(systemPrompt, prompt);
    const result = this.parseReview(response);
    
    // Store in memory
    await this.remember(`psych-review:${episode.id}`, {
      episode: episode.id,
      result,
      timestamp: new Date().toISOString()
    });
    
    return result;
  }
  
  // ==================== Character Review ====================
  
  private async reviewCharacter(
    review: NonNullable<ChildPsychologistInput['characterReview']>
  ): Promise<ChildPsychologistOutput> {
    const { character, world } = review;
    
    const prompt = `REVIEW CHARACTER FOR PSYCHOLOGICAL SAFETY:

TARGET AUDIENCE: ${world.targetAge?.[0] || 13}-${world.targetAge?.[1] || 17} years old

CHARACTER:
${JSON.stringify(character, null, 2)}

WORLD:
${world.description}

YOUR TASK:
Evaluate this character for psychological appropriateness:

1. Is the character age-appropriate and relatable?
2. Are personality traits healthy and realistic?
3. Does the character model positive behaviors?
4. Are emotional responses authentic?
5. Does background avoid harmful tropes?
6. Is representation respectful and non-stereotypical?

Rate and provide feedback in JSON format as specified.`;

    const response = await this.callLLM(this.systemPrompt, prompt);
    return this.parseReview(response);
  }
  
  // ==================== Scene Review ====================
  
  private async reviewScene(
    review: NonNullable<ChildPsychologistInput['sceneReview']>
  ): Promise<ChildPsychologistOutput> {
    const { scene, characters, context } = review;
    
    const prompt = `REVIEW SCENE FOR PSYCHOLOGICAL SAFETY:

SCENE:
${JSON.stringify(scene, null, 2)}

CHARACTERS IN SCENE:
${characters.map(c => `${c.name}: ${c.personality.coreTraits.join(', ')}`).join('\n')}

CONTEXT:
${context}

YOUR TASK:
Evaluate this scene for psychological appropriateness and safety.
Focus on emotional intensity, relationship dynamics, and age-appropriate content.

Return assessment in JSON format.`;

    const response = await this.callLLM(this.systemPrompt, prompt);
    return this.parseReview(response);
  }
  
  // ==================== Helper Methods ====================
  
  private parseReview(content: string): ChildPsychologistOutput {
    // Fail loudly on parse failure: a fabricated safety review is worse
    // than no review.
    const parsed = parseReviewJson<any>(this.config.id, content);
    const normalized = this.normalizeOutput(parsed, content);
    console.log('[Child Psychologist] Successfully parsed review:', normalized.status);
    return normalized;
  }
  
  private normalizeOutput(parsed: any, rawResponse: string): ChildPsychologistOutput {
    // Verdict and scores must come from the LLM; fabricating them would let
    // a broken review pass as a real safety assessment. Lists may default to
    // empty (an approved episode can legitimately have no concerns).
    return {
      status: requireEnum(this.config.id, rawResponse, 'status', parsed.status,
        ['APPROVED', 'NEEDS_REVISION', 'REJECTED'] as const),
      concerns: parsed.concerns || [],
      recommendations: parsed.recommendations || [],
      triggerWarnings: parsed.triggerWarnings || [],
      scores: {
        ageAppropriateness: requireScore(this.config.id, rawResponse, 'scores.ageAppropriateness', parsed.scores?.ageAppropriateness),
        emotionalSafety: requireScore(this.config.id, rawResponse, 'scores.emotionalSafety', parsed.scores?.emotionalSafety),
        educationalValue: requireScore(this.config.id, rawResponse, 'scores.educationalValue', parsed.scores?.educationalValue),
        mentalHealthRep: requireScore(this.config.id, rawResponse, 'scores.mentalHealthRep', parsed.scores?.mentalHealthRep),
        overall: requireScore(this.config.id, rawResponse, 'scores.overall', parsed.scores?.overall)
      },
      summary: {
        strengths: parsed.summary?.strengths || [],
        improvements: parsed.summary?.improvements || [],
        readyForAudience: parsed.summary?.readyForAudience ?? false
      }
    };
  }
}
