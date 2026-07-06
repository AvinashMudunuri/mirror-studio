import { BaseAgent, AgentConfig } from './base-agent-v2';
import { getAgentModel, getAgentTemperature, getAgentMaxTokens } from './config';
import { ReviewParseError, requireEnum, requireScore } from './errors';
import { jsonrepair } from 'jsonrepair';
import type { Episode, Character, World } from '@mirror/schemas';

// ============================================================================
// Types
// ============================================================================

export interface EthicalIssue {
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  category: 'BIAS' | 'STEREOTYPE' | 'HARMFUL_TROPE' | 'REPRESENTATION' | 'CULTURAL' | 'ETHICAL_MODELING';
  issue: string;
  location: string;
  harmPotential: string;
  recommendation: string;
  priority: number;
}

export interface FlaggedContent {
  type: 'LANGUAGE' | 'PORTRAYAL' | 'NARRATIVE' | 'RELATIONSHIP' | 'DECISION';
  location: string;
  content: string;
  concern: string;
  suggestion: string;
}

export interface EthicsReviewerInput {
  type: 'REVIEW_EPISODE' | 'REVIEW_CHARACTER' | 'REVIEW_SCENE' | 'REVIEW_DIALOGUE';
  
  episodeReview?: {
    episode: Episode;
    characters: Character[];
    world: World;
  };
  
  characterReview?: {
    character: Character;
    context: string;
  };
  
  sceneReview?: {
    scene: any;
    characters: Character[];
    context: string;
  };
  
  dialogueReview?: {
    dialogue: any[];
    characters: Character[];
    context: string;
  };
}

export interface EthicsReviewerOutput {
  status: 'EXCELLENT' | 'GOOD' | 'NEEDS_WORK' | 'UNACCEPTABLE';
  issues: EthicalIssue[];
  strengths: string[];
  recommendations: string[];
  scores: {
    biasAvoidance: number;
    representation: number;
    tropes: number;
    ethicalModeling: number;
    culturalSensitivity: number;
    overall: number;
  };
  flaggedContent: FlaggedContent[];
  summary: {
    verdict: string;
    criticalIssues: string[];
    majorConcerns: string[];
    minorNotes: string[];
    strengths: string[];
    readyForPublication: boolean;
  };
}

// ============================================================================
// Ethics Reviewer Agent
// ============================================================================

export class EthicsReviewerAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      id: 'ETHICS_REVIEWER',
      name: 'Riley',
      role: 'Ethics & Representation Specialist',
      model: getAgentModel('ETHICS_REVIEWER'),
      temperature: getAgentTemperature('ETHICS_REVIEWER'),
      maxTokens: getAgentMaxTokens('ETHICS_REVIEWER')
    };
    super(config);
  }
  
  protected get systemPrompt(): string {
    return `You are Riley, the Ethics Reviewer for Project MIRROR Studio.

Your mission: Ensure content is ethically sound, free from harmful bias, and respectful to all players. Protect marginalized communities from harm while creating inclusive, welcoming experiences.

EXPERTISE:
- Bias and stereotype detection
- Harmful trope identification
- Fair representation assessment
- Ethical decision modeling
- Cultural sensitivity
- Inclusivity evaluation

EVALUATION FRAMEWORK:

1. BIAS & STEREOTYPES
   - Are any characters defined solely by their identity (race, gender, disability, etc.)?
   - Do behaviors or traits align with harmful stereotypes?
   - Are there microaggressions or loaded language?
   - Is there tokenization (single representative of a group)?
   - Are power dynamics fair across identities?

2. HARMFUL TROPES
   - "Tragic [identity]" - marginalized character exists only to suffer?
   - "Bury your gays" - LGBTQ+ characters disproportionately killed/harmed?
   - "Magical minority" - character of color exists to help white protagonist?
   - "Model minority" - Asian character is only smart/hardworking?
   - "Disability superpower" - disability only valued if it provides ability?
   - "Savior narrative" - privileged character rescues marginalized?
   - Identity as plot device rather than authentic character element?

3. REPRESENTATION
   - Are diverse characters portrayed authentically, not stereotypically?
   - Do they have agency and complexity?
   - Is diversity normalized or treated as "special"?
   - Are multiple identities represented (not just one type)?
   - Does representation feel authentic or performative?

4. ETHICAL DECISION MODELING
   - Are ethical choices clearly framed?
   - Do consequences match actions appropriately?
   - Is harmful behavior properly addressed, not glorified?
   - Are values consistent with stated goals (teen emotional intelligence)?
   - Does content model positive behavior?

5. CULTURAL SENSITIVITY
   - Are cultural elements portrayed respectfully and accurately?
   - Is there cultural appropriation (using sacred/significant elements casually)?
   - Are cultures treated with nuance, not monolithically?
   - Would members of these communities feel respected?

6. AGE APPROPRIATENESS (ETHICAL LENS)
   - Is content appropriate for 11-16 year olds?
   - Are power dynamics healthy (no adult-teen romance, etc.)?
   - Is risk behavior framed with appropriate consequences?
   - Is identity exploration supportive, not harmful?

SCORING CRITERIA (1-10):
10: Exemplary - model for ethical content
8-9: Excellent - minor tweaks only
6-7: Good - some improvements needed
4-5: Needs work - significant issues
1-3: Unacceptable - major ethical problems

STATUS LEVELS:
- EXCELLENT: 8+ overall, exemplary ethical content
- GOOD: 6-7 overall, solid with improvements
- NEEDS_WORK: 4-5 overall, significant issues to address
- UNACCEPTABLE: <4 overall, cannot publish without major revision

IMPORTANT PRINCIPLES:

1. **Assume good intent, but identify impact**: Focus on harm potential, not creator intent
2. **Be specific**: Explain exactly what's problematic and why
3. **Provide alternatives**: Don't just criticize, offer constructive fixes
4. **Context matters**: Consider audience age and educational goals
5. **Multiple perspectives**: Consider how different communities might react
6. **Intersectionality**: Consider multiple, overlapping identities
7. **Evolving standards**: Apply current understanding, not outdated norms

CRITICAL vs MAJOR vs MINOR:

- CRITICAL: Could cause significant harm, reinforce dangerous stereotypes, or alienate communities
  - Must fix before publication
  - Examples: Harmful stereotypes, glorifying abuse, cultural disrespect

- MAJOR: Problematic but not immediately harmful
  - Should fix before publication
  - Examples: Minor stereotypes, missed representation opportunities, unclear ethics

- MINOR: Room for improvement but acceptable
  - Nice to address but not blocking
  - Examples: Could be more inclusive, small language tweaks

FORMAT YOUR RESPONSE AS JSON:
{
  "status": "EXCELLENT" | "GOOD" | "NEEDS_WORK" | "UNACCEPTABLE",
  "issues": [
    {
      "severity": "CRITICAL" | "MAJOR" | "MINOR",
      "category": "BIAS" | "STEREOTYPE" | "HARMFUL_TROPE" | "REPRESENTATION" | "CULTURAL" | "ETHICAL_MODELING",
      "issue": "description",
      "location": "where",
      "harmPotential": "who could be harmed and how",
      "recommendation": "how to fix",
      "priority": 1-10
    }
  ],
  "strengths": ["what works well ethically"],
  "recommendations": ["improvements"],
  "scores": {
    "biasAvoidance": 1-10,
    "representation": 1-10,
    "tropes": 1-10,
    "ethicalModeling": 1-10,
    "culturalSensitivity": 1-10,
    "overall": 1-10
  },
  "flaggedContent": [
    {
      "type": "LANGUAGE" | "PORTRAYAL" | "NARRATIVE" | "RELATIONSHIP" | "DECISION",
      "location": "where",
      "content": "what",
      "concern": "why problematic",
      "suggestion": "how to improve"
    }
  ],
  "summary": {
    "verdict": "overall assessment",
    "criticalIssues": ["must fix before publication"],
    "majorConcerns": ["should fix"],
    "minorNotes": ["nice to address"],
    "strengths": ["what works well"],
    "readyForPublication": boolean
  }
}

Remember: Your role is to ensure content is SAFE, INCLUSIVE, and RESPECTFUL while supporting the mission of helping teens develop emotional intelligence.`;
  }
  
  protected async execute(input: EthicsReviewerInput): Promise<EthicsReviewerOutput> {
    console.log(`[Riley] Performing ${input.type} review...`);
    
    if (input.type === 'REVIEW_EPISODE' && input.episodeReview) {
      return await this.reviewEpisode(input.episodeReview);
    } else if (input.type === 'REVIEW_CHARACTER' && input.characterReview) {
      return await this.reviewCharacter(input.characterReview);
    } else if (input.type === 'REVIEW_SCENE' && input.sceneReview) {
      return await this.reviewScene(input.sceneReview);
    } else if (input.type === 'REVIEW_DIALOGUE' && input.dialogueReview) {
      return await this.reviewDialogue(input.dialogueReview);
    } else {
      throw new Error('Invalid Ethics Reviewer input type');
    }
  }
  
  // ==================== Episode Review ====================
  
  private async reviewEpisode(
    review: NonNullable<EthicsReviewerInput['episodeReview']>
  ): Promise<EthicsReviewerOutput> {
    const { episode, characters, world } = review;
    
    // Scripts may pass partially-assembled episodes; fall back to the world's
    // target age and tolerate missing summary fields (full JSON is below).
    const targetAge = episode.targetAge || world.targetAge;
    
    const prompt = `REVIEW EPISODE FOR ETHICAL CONTENT, BIAS, AND REPRESENTATION:

EPISODE:
Title: ${episode.title}
Synopsis: ${episode.synopsis}
Themes: ${episode.themes?.join(', ') || 'Not specified'}
Target Age: ${targetAge ? `${targetAge[0]}-${targetAge[1]}` : 'Not specified'}

Full Episode Data: ${JSON.stringify(episode, null, 2)}

CHARACTERS:
${characters.map(c => `
- ${c.name}
  Background: ${c.background}
  Core Traits: ${c.personality.coreTraits.join(', ')}
  Values: ${(c.personality as any).values?.join(', ') || 'N/A'}
  Flaws: ${(c.personality as any).flaws?.join(', ') || 'N/A'}
`).join('\n')}

WORLD:
${world.description}
Setting: ${(world as any).setting || world.name}

YOUR TASK:
Evaluate this episode's ETHICAL CONTENT and REPRESENTATION. Focus on potential harm, bias, stereotypes, and inclusivity.

1. BIAS & STEREOTYPES
   - Character portrayal: Any reductive stereotypes based on identity?
   - Behavior patterns: Do traits align with harmful stereotypes?
   - Language: Any microaggressions or loaded terms?
   - Power dynamics: Fair treatment across identities?
   - Tokenization: Single representative of group?

2. HARMFUL TROPES
   Check for problematic patterns:
   - "Tragic [identity]" - suffering tied to identity?
   - "Bury your gays" - LGBTQ+ harmed disproportionately?
   - "Magical minority" - exists to help protagonist?
   - "Model minority" - only smart/hardworking Asian?
   - "Disability superpower" - valued only for ability?
   - "Savior narrative" - privileged rescuing marginalized?
   - Identity as plot device vs. authentic element?

3. REPRESENTATION
   - Authenticity: Real, complex characters or stereotypes?
   - Agency: Do diverse characters drive their stories?
   - Normalization: Is diversity natural or "special"?
   - Variety: Multiple types represented?
   - Intersectionality: Multiple identities acknowledged?

4. ETHICAL DECISION MODELING
   - Moral clarity: Right/wrong appropriately framed?
   - Consequences: Match actions appropriately?
   - Harmful behavior: Glorified or properly addressed?
   - Values: Consistent with teen emotional intelligence goals?
   - Positive modeling: Good behavior rewarded fairly?

5. CULTURAL SENSITIVITY
   - Accuracy: Culturally accurate portrayal?
   - Respect: No mockery or appropriation?
   - Nuance: Avoid monolithic portrayal?
   - Context: Cultural elements used properly?

6. AGE APPROPRIATENESS (ETHICAL LENS)
   - Content fit: Appropriate for 11-16?
   - Power dynamics: Healthy relationships?
   - Risk behavior: Proper framing/consequences?
   - Identity exploration: Supportive, not harmful?

For each issue found:
- Severity: CRITICAL (must fix), MAJOR (should fix), MINOR (nice to fix)
- Category: BIAS, STEREOTYPE, HARMFUL_TROPE, REPRESENTATION, CULTURAL, ETHICAL_MODELING
- Harm potential: Who could be harmed and how
- Specific recommendation: How to improve

Rate each dimension 1-10, identify readiness for publication.

Return your assessment as JSON in the format specified in your system prompt.`;

    const response = await this.callLLM(this.systemPrompt, prompt);
    const result = this.parseReview(response);
    
    // Store in memory
    await this.remember(`ethics-review:${episode.id}`, {
      episode: episode.id,
      result,
      timestamp: new Date().toISOString()
    });
    
    return result;
  }
  
  // ==================== Character Review ====================
  
  private async reviewCharacter(
    review: NonNullable<EthicsReviewerInput['characterReview']>
  ): Promise<EthicsReviewerOutput> {
    const { character, context } = review;
    
    const prompt = `REVIEW CHARACTER FOR STEREOTYPES AND BIAS:

CHARACTER:
${JSON.stringify(character, null, 2)}

CONTEXT: ${context}

YOUR TASK:
Evaluate this character for stereotypes, bias, and authentic representation.
Focus on whether portrayal is respectful and avoids harmful patterns.

Return assessment in JSON format.`;

    const response = await this.callLLM(this.systemPrompt, prompt);
    return this.parseReview(response);
  }
  
  // ==================== Scene Review ====================
  
  private async reviewScene(
    review: NonNullable<EthicsReviewerInput['sceneReview']>
  ): Promise<EthicsReviewerOutput> {
    const { scene, characters, context } = review;
    
    const prompt = `REVIEW SCENE FOR ETHICAL ISSUES:

SCENE:
${JSON.stringify(scene, null, 2)}

CHARACTERS:
${JSON.stringify(characters, null, 2)}

CONTEXT: ${context}

YOUR TASK:
Evaluate this scene for ethical issues, bias, and problematic content.

Return assessment in JSON format.`;

    const response = await this.callLLM(this.systemPrompt, prompt);
    return this.parseReview(response);
  }
  
  // ==================== Dialogue Review ====================
  
  private async reviewDialogue(
    review: NonNullable<EthicsReviewerInput['dialogueReview']>
  ): Promise<EthicsReviewerOutput> {
    const { dialogue, characters, context } = review;
    
    const prompt = `REVIEW DIALOGUE FOR BIAS AND LOADED LANGUAGE:

DIALOGUE:
${JSON.stringify(dialogue, null, 2)}

CHARACTERS:
${JSON.stringify(characters, null, 2)}

CONTEXT: ${context}

YOUR TASK:
Evaluate dialogue for microaggressions, bias, stereotypical speech patterns,
and loaded language.

Return assessment in JSON format.`;

    const response = await this.callLLM(this.systemPrompt, prompt);
    return this.parseReview(response);
  }
  
  // ==================== Helper Methods ====================
  
  private parseReview(content: string): EthicsReviewerOutput {
    // Log response for debugging
    console.log('[Ethics Reviewer] Response length:', content.length);
    console.log('[Ethics Reviewer] Response preview:', content.substring(0, 500));
    
    // Extract JSON
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
    
    if (!jsonMatch) {
      console.error('[Ethics Reviewer] No JSON found in response');
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
      console.log('[Ethics Reviewer] Attempting to repair JSON...');
      jsonString = jsonrepair(jsonString);
      console.log('[Ethics Reviewer] JSON repair successful');
    } catch (repairError) {
      console.warn('[Ethics Reviewer] JSON repair failed:', repairError);
    }
    
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch (error) {
      console.error('[Ethics Reviewer] Failed to parse JSON:', error);
      console.error('JSON string:', jsonString.substring(0, 1000));
      throw new ReviewParseError(
        this.config.id,
        `LLM review response is not valid JSON: ${error}`,
        content
      );
    }
    
    const normalized = this.normalizeOutput(parsed, content);
    console.log('[Ethics Reviewer] Successfully parsed review:', normalized.status);
    return normalized;
  }
  
  private normalizeOutput(parsed: any, rawResponse: string): EthicsReviewerOutput {
    // Verdict and scores must come from the LLM; a fabricated ethics review
    // is a safety hazard. Lists may default to empty (clean content can
    // legitimately have no issues or flagged passages).
    return {
      status: requireEnum(this.config.id, rawResponse, 'status', parsed.status,
        ['EXCELLENT', 'GOOD', 'NEEDS_WORK', 'UNACCEPTABLE'] as const),
      issues: parsed.issues || [],
      strengths: parsed.strengths || [],
      recommendations: parsed.recommendations || [],
      scores: {
        biasAvoidance: requireScore(this.config.id, rawResponse, 'scores.biasAvoidance', parsed.scores?.biasAvoidance),
        representation: requireScore(this.config.id, rawResponse, 'scores.representation', parsed.scores?.representation),
        tropes: requireScore(this.config.id, rawResponse, 'scores.tropes', parsed.scores?.tropes),
        ethicalModeling: requireScore(this.config.id, rawResponse, 'scores.ethicalModeling', parsed.scores?.ethicalModeling),
        culturalSensitivity: requireScore(this.config.id, rawResponse, 'scores.culturalSensitivity', parsed.scores?.culturalSensitivity),
        overall: requireScore(this.config.id, rawResponse, 'scores.overall', parsed.scores?.overall)
      },
      flaggedContent: parsed.flaggedContent || [],
      summary: {
        verdict: parsed.summary?.verdict || 'No verdict provided',
        criticalIssues: parsed.summary?.criticalIssues || [],
        majorConcerns: parsed.summary?.majorConcerns || [],
        minorNotes: parsed.summary?.minorNotes || [],
        strengths: parsed.summary?.strengths || [],
        readyForPublication: parsed.summary?.readyForPublication ?? false
      }
    };
  }
}
