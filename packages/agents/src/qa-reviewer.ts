import { BaseAgent, AgentConfig } from './base-agent-v2';
import { getAgentModel, getAgentTemperature, getAgentMaxTokens } from './config';
import { requireEnum } from './errors';
import { parseReviewJson } from './json-parsing';
import { buildSharedReviewContext } from './review-context';
import type { Episode, Character, World } from '@mirror/schemas';

// ============================================================================
// Types
// ============================================================================

export interface ValidationError {
  severity: 'BLOCKER' | 'CRITICAL';
  category: 'SCHEMA' | 'CONSISTENCY' | 'LOGIC' | 'COMPLETENESS';
  message: string;
  location: string;
  expectedValue?: any;
  actualValue?: any;
  fix?: string;
}

export interface ValidationWarning {
  category: 'STYLE' | 'PERFORMANCE' | 'BEST_PRACTICE';
  message: string;
  location: string;
  suggestion: string;
}

export interface QAReviewerInput {
  type: 'REVIEW_EPISODE' | 'REVIEW_CHARACTER' | 'REVIEW_WORLD';
  
  episodeReview?: {
    episode: Episode;
    characters: Character[];
    world: World;
    previousEpisodes?: Episode[];
  };
  
  characterReview?: {
    character: Character;
    world: World;
    existingCharacters: Character[];
  };
  
  worldReview?: {
    world: World;
    episodes: Episode[];
  };
}

export interface QAReviewerOutput {
  status: 'PASS' | 'FAIL';
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    warningCount: number;
  };
  recommendations?: string[];
}

// ============================================================================
// QA Reviewer Agent
// ============================================================================

export class QAReviewerAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      id: 'QA_REVIEWER',
      name: 'Alex',
      role: 'Technical Quality Assurance Specialist',
      model: getAgentModel('QA_REVIEWER'),
      temperature: getAgentTemperature('QA_REVIEWER'),
      maxTokens: getAgentMaxTokens('QA_REVIEWER')
    };
    super(config);
  }
  
  protected get systemPrompt(): string {
    return `You are Alex, the QA Reviewer for Project MIRROR Studio.

Your mission: Be the final gatekeeper for technical quality. Catch errors, inconsistencies, 
and incomplete content before it reaches players. Be thorough, precise, and constructive.

You are CRITICAL but HELPFUL. Find every issue, but also suggest fixes.

VALIDATION CHECKLIST:
1. Schema Compliance - Does the JSON match the schema exactly?
2. ID Integrity - Are all IDs unique? Do all references resolve?
3. Branching Logic - Can all paths be reached? Do they lead somewhere valid?
4. Character Consistency - Names, pronouns, references all correct?
5. Trait Mechanics - Trait mappings present and reasonable?
6. Completeness - All required content present?
7. Metadata Accuracy - Play time, tags, dependencies correct?

EPISODE DATA MODEL (these conventions are CORRECT — do not report them as errors):
- Choices live in the top-level "choices" array; each entry's "scene" field
  names the scene it belongs to. Scenes do NOT embed a "choices" field —
  a choice pointing at a scene via its "scene" field IS the linkage.
- A scene WITH a choice attached transitions via that choice's options'
  "nextScene" values. A scene WITHOUT a choice transitions via its
  "defaultNextScene". Exactly one of the two mechanisms applies per scene.
- "END" is the reserved terminator: options or defaultNextScene equal to
  "END" end the episode. It is intentionally not a scene id.
- "branchDialogue" entries key ending-scene dialogue variants by the ids in
  the top-level "outcomes"/branches array; which branch fires is derived
  from the player's choice history (the branches' "triggeredBy" lists).
- Speaker ids "NARRATOR" and "INTERNAL" are reserved and never appear in
  the character roster.

GROUND RULES (violating these makes your review wrong):
- Validate against the field names and shapes ACTUALLY USED in the provided
  episode JSON. Do NOT invent requirements for fields the data never uses
  (e.g. if scenes have "description", do not fail them for lacking
  "synopsis"; if the world lists seasons as strings, do not demand season
  objects).
- An error must describe a defect a player or the rendering pipeline would
  actually hit. Style preferences and hypothetical schema mismatches belong
  in "warnings", not "errors".
- FAIL means the episode cannot ship as-is because of the listed errors.
  If everything you found is a warning, the status is PASS.

For each issue found:
- State the severity (BLOCKER, CRITICAL, WARNING)
- Specify exact location (e.g., "scene-3.choices[1].options[0]")
- Explain what's wrong
- Show expected vs actual (if applicable)
- Suggest a fix

FORMAT YOUR RESPONSE AS JSON:
{
  "status": "PASS" or "FAIL",
  "errors": [
    {
      "severity": "BLOCKER" or "CRITICAL",
      "category": "SCHEMA" | "CONSISTENCY" | "LOGIC" | "COMPLETENESS",
      "message": "Clear description",
      "location": "exact.path.to.issue",
      "expectedValue": "what it should be",
      "actualValue": "what it is",
      "fix": "how to fix it"
    }
  ],
  "warnings": [
    {
      "category": "STYLE" | "PERFORMANCE" | "BEST_PRACTICE",
      "message": "Concern description",
      "location": "exact.path",
      "suggestion": "improvement suggestion"
    }
  ],
  "summary": {
    "totalChecks": number,
    "passedChecks": number,
    "failedChecks": number,
    "warningCount": number
  },
  "recommendations": ["optional improvement suggestions"]
}

Be precise with locations. Use JSON path notation.
Remember: Players trust us to deliver polished, bug-free experiences.`;
  }
  
  protected async execute(input: QAReviewerInput): Promise<QAReviewerOutput> {
    console.log(`[Alex] Performing ${input.type} review...`);
    
    if (input.type === 'REVIEW_EPISODE' && input.episodeReview) {
      return await this.reviewEpisode(input.episodeReview);
    } else if (input.type === 'REVIEW_CHARACTER' && input.characterReview) {
      return await this.reviewCharacter(input.characterReview);
    } else if (input.type === 'REVIEW_WORLD' && input.worldReview) {
      return await this.reviewWorld(input.worldReview);
    } else {
      throw new Error('Invalid QA Reviewer input type');
    }
  }
  
  // ==================== Episode Review ====================
  
  private async reviewEpisode(
    review: NonNullable<QAReviewerInput['episodeReview']>
  ): Promise<QAReviewerOutput> {
    const { episode, characters, world, previousEpisodes } = review;
    
    // Same episode/character/world payload every reviewer gets on this
    // episode — cached so only the first reviewer to run pays full price.
    const systemPrompt = [
      { text: buildSharedReviewContext({ episode, characters, world }), cache: true },
      { text: this.systemPrompt }
    ];
    
    const prompt = `REVIEW EPISODE FOR TECHNICAL QUALITY (see the shared episode data above for full content):

${previousEpisodes ? `PREVIOUS EPISODES: ${previousEpisodes.length} episodes for continuity checking` : ''}

YOUR TASK:
Perform a comprehensive QA review of this episode. Check:

1. SCHEMA VALIDATION
   - All required fields present (id, worldId, seasonId, episodeNumber, title, synopsis, scenes, choices, outcomes, themes, educationalGoals, targetTraits, status)
   - Data types correct (numbers are numbers, strings are strings, arrays are arrays)
   - Enum values valid (status must be DRAFT/IN_REVIEW/APPROVED/PUBLISHED)
   - Judge scenes by the fields they actually carry (id, title, location, characters, duration, description, emotionalBeat, transitions, dialogue) — do not require fields this pipeline does not produce

2. ID CONSISTENCY
   - Episode ID is unique
   - All scene IDs unique
   - All choice IDs unique
   - All character references resolve to actual characters
   - No orphaned references

3. BRANCHING LOGIC
   - All choices lead to valid outcomes
   - All outcomes reference valid scenes or states
   - No dead ends (unless intentional endings)
   - No unreachable scenes
   - Reasonable number of branches

4. CHARACTER CONSISTENCY
   - Character names consistent throughout
   - Pronouns don't change
   - Characters referenced only when present in scene
   - Dialogue attribution correct

5. TRAIT MECHANICS
   - Target traits are actually affected in choices/outcomes
   - Trait changes are reasonable (-3 to +3)
   - Trait IDs are valid

6. COMPLETENESS
   - Every scene has a title and a description
   - All choices have options
   - Educational goals defined
   - Themes match content

7. METADATA ACCURACY
   - Episode number correct
   - Status appropriate
   - Created/updated timestamps present

Return comprehensive results in JSON format as specified in your system prompt.`;

    const response = await this.callLLM(systemPrompt, prompt);
    const result = this.parseQAResponse(response);
    
    // Store in memory
    await this.remember(`qa-review:${episode.id}`, {
      episode: episode.id,
      result,
      timestamp: new Date().toISOString()
    });
    
    return result;
  }
  
  // ==================== Character Review ====================
  
  private async reviewCharacter(
    review: NonNullable<QAReviewerInput['characterReview']>
  ): Promise<QAReviewerOutput> {
    const { character, world, existingCharacters } = review;
    
    const prompt = `REVIEW CHARACTER FOR TECHNICAL QUALITY:

CHARACTER:
${JSON.stringify(character, null, 2)}

WORLD:
${JSON.stringify(world, null, 2)}

EXISTING CHARACTERS:
${existingCharacters.map(c => `- ${c.id}: ${c.name}`).join('\n')}

YOUR TASK:
Check this character for quality issues:

1. Required fields present (id, worldId, name, age, pronouns, personality, background, storyRole, voiceGuidelines)
2. ID unique (not in existing characters list)
3. Age appropriate for world target age
4. Data types correct
5. Personality traits defined
6. Voice guidelines complete
7. No missing or malformed data

Return results in JSON format.`;

    const response = await this.callLLM(this.systemPrompt, prompt);
    return this.parseQAResponse(response);
  }
  
  // ==================== World Review ====================
  
  private async reviewWorld(
    review: NonNullable<QAReviewerInput['worldReview']>
  ): Promise<QAReviewerOutput> {
    const { world, episodes } = review;
    
    const prompt = `REVIEW WORLD FOR TECHNICAL QUALITY:

WORLD:
${JSON.stringify(world, null, 2)}

EPISODES IN WORLD: ${episodes.length}

YOUR TASK:
Check this world for quality issues:

1. Required fields present (id, name, description, themes, targetAge, seasons)
2. Target age is a valid range [min, max]
3. Themes are appropriate
4. Seasons defined
5. Consistent with episodes

Return results in JSON format.`;

    const response = await this.callLLM(this.systemPrompt, prompt);
    return this.parseQAResponse(response);
  }
  
  // ==================== Helper Methods ====================
  
  private parseQAResponse(content: string): QAReviewerOutput {
    // Fail loudly on parse failure: a fabricated QA result (even a FAIL) is
    // indistinguishable from a real review downstream.
    const parsed = parseReviewJson<any>(this.config.id, content);
    
    // The PASS/FAIL verdict must come from the LLM. Inferring PASS from a
    // missing status would let a malformed review approve an episode.
    parsed.status = requireEnum(this.config.id, content, 'status', parsed.status,
      ['PASS', 'FAIL'] as const);
    
    if (!parsed.errors) {
      parsed.errors = [];
    }
    
    if (!parsed.warnings) {
      parsed.warnings = [];
    }
    
    if (!parsed.summary) {
      parsed.summary = {
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: parsed.errors.length,
        warningCount: parsed.warnings.length
      };
    }
    
    console.log('[QA Reviewer] Successfully parsed review:', parsed.status);
    return parsed as QAReviewerOutput;
  }
}
