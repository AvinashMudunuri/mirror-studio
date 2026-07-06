/**
 * Story Architect Agent (River)
 * 
 * Mission: Design emotionally engaging story structures that create meaningful
 * choices and support educational goals invisibly.
 * 
 * This is the manual implementation - later this will be generated/refined by Developer Agent.
 */

import { BaseAgent, AgentConfig } from './base-agent-v2';
import { getAgentModel, getAgentTemperature, getAgentMaxTokens } from './config';
import { parseLlmJson } from './json-parsing';
import type {
  Character,
  TraitId
} from '@mirror/schemas';

// ==================== Input/Output Schemas ====================

/** Pseudo scene id marking the end of an episode. */
export const EPISODE_END = 'END';

export interface Scene {
  id: string;
  title: string;
  location: string;
  characters: string[]; // character IDs
  duration: number; // minutes
  description: string;
  emotionalBeat: string;
  /**
   * Scene played after this one when the scene has no choice point.
   * Use EPISODE_END ('END') for the final scene. Scenes WITH a choice
   * point transition via their options' nextScene instead.
   */
  defaultNextScene?: string;
}

export interface StoryChoiceOption {
  id: string;
  text: string;
  consequence?: string;
  /** Scene this option transitions to: a valid scene id, or 'END'. */
  nextScene: string;
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
      model: getAgentModel('STORY_ARCHITECT'),
      temperature: getAgentTemperature('STORY_ARCHITECT'),
      maxTokens: getAgentMaxTokens('STORY_ARCHITECT')
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

PLAYABILITY REQUIREMENTS (the episode must be machine-executable):
- Every choice option MUST declare "nextScene": the id of the scene it
  transitions to, or "END" if it ends the episode.
- Every scene WITHOUT a choice point MUST declare "defaultNextScene"
  (a scene id, or "END" for a final scene).
- Every scene must be reachable from the first scene by some choice path.
- At least one path must reach "END" — no infinite loops, no dead ends.
- Use consistent snake_case or kebab-case ids everywhere; refer to the
  protagonist as "player" in scene character lists.

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

CRITICAL: Format your response as VALID JSON only. No comments, no trailing commas, no markdown except the code block wrapper.

Return ONLY this JSON structure (wrapped in \`\`\`json code block):
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
        "emotionalBeat": "...",
        "defaultNextScene": "scene-2"
      }
    ],
    "choicePoints": [
      {
        "id": "choice-1",
        "scene": "scene-2",
        "prompt": "...",
        "context": "...",
        "options": [
          { "id": "a", "text": "...", "nextScene": "scene-3a" },
          { "id": "b", "text": "...", "nextScene": "scene-3b" }
        ],
        "traitMapping": {
          "a": { "EMPATHY": 2, "CONFIDENCE": 1 },
          "b": { "CONFIDENCE": -1 }
        }
      }
    ],
    "branches": [
      {
        "id": "branch-authentic",
        "name": "The Authentic Path",
        "triggeredBy": ["choice-1:a", "choice-3:b"],
        "description": "...",
        "outcome": "..."
      }
    ],
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
}

TRANSITION RULES (MANDATORY — the episode is unplayable without them):
- EVERY option in EVERY choicePoint must include "nextScene" (a scene id or "END")
- EVERY scene that has NO choice point must include "defaultNextScene" (a scene id or "END")
- A scene that HAS a choice point transitions via its options, not defaultNextScene
- Every scene must be reachable from the first scene; at least one path must reach "END"
- EVERY branch must include "id" (kebab-case) and "triggeredBy" (the choice
  option paths, "choiceId:optionId", that put the player on that branch)

IMPORTANT REMINDERS:
- Return ONLY valid JSON wrapped in \`\`\`json code block
- NO trailing commas in arrays or objects
- NO comments in the JSON
- All string values must use double quotes
- Ensure all brackets and braces are properly closed
- Test that your JSON is valid before returning it`;
    
    const response = await this.callLLM(
      this.systemPrompt,
      prompt
    );
    
    // Parse LLM response and ensure the scene graph is playable
    const result = await this.ensurePlayableOutline(
      this.parseOutlineFromResponse(response)
    );
    
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

FORMAT YOUR RESPONSE AS JSON wrapped in a \`\`\`json code block. The outline
MUST be nested under the "episodeOutline" key — do NOT return the outline
object directly:
{
  "episodeOutline": { ...complete revised outline, same fields as the draft... },
  "designNotes": "what you changed and why",
  "uncertainties": [...]
}

TRANSITION RULES (MANDATORY — the episode is unplayable without them):
- EVERY option in EVERY choicePoint must include "nextScene" (a scene id or "END")
- EVERY scene that has NO choice point must include "defaultNextScene" (a scene id or "END")
- Every scene must be reachable from the first scene; at least one path must reach "END"
- EVERY branch must include "id" (kebab-case) and "triggeredBy" ("choiceId:optionId" paths)`;
    
    const response = await this.callLLM(
      this.systemPrompt,
      prompt
    );
    
    const result = await this.ensurePlayableOutline(
      this.parseOutlineFromResponse(response)
    );
    
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
    let parsed: any;
    try {
      parsed = parseLlmJson(content, { context: 'Story Architect' });
    } catch (error) {
      throw new Error(`Failed to parse episode outline: ${error instanceof Error ? error.message : error}`);
    }
    
    // Tolerate the model returning the outline object directly
    // (observed on REVISION_REQUEST) instead of nested under
    // "episodeOutline".
    if (!parsed.episodeOutline && parsed.title && Array.isArray(parsed.scenes)) {
      console.warn('[Story Architect] Response was a bare outline; wrapping in episodeOutline');
      parsed = { episodeOutline: parsed, designNotes: parsed.designNotes || '' };
    }
    
    if (!parsed.episodeOutline || !parsed.episodeOutline.title) {
      throw new Error('Failed to parse episode outline: missing episodeOutline.title');
    }
    
    console.log('[Story Architect] Successfully parsed episode outline:', parsed.episodeOutline.title);
    return parsed as StoryArchitectOutput;
  }
  
  // ==================== Validation ====================
  
  /**
   * Ensure the outline forms a playable scene graph. On structural failure,
   * give the model ONE chance to repair its own structure, then fail loudly.
   */
  private async ensurePlayableOutline(result: StoryArchitectOutput): Promise<StoryArchitectOutput> {
    let structuralErrors = this.validateTransitions(result.episodeOutline);
    
    if (structuralErrors.length > 0) {
      console.warn(`[River] Outline has ${structuralErrors.length} structural issue(s); requesting self-repair...`);
      structuralErrors.forEach(e => console.warn(`[River]   - ${e}`));
      
      const repairResponse = await this.callLLM(
        this.systemPrompt,
        this.buildStructuralRepairPrompt(result, structuralErrors)
      );
      result = this.parseOutlineFromResponse(repairResponse);
      
      structuralErrors = this.validateTransitions(result.episodeOutline);
      if (structuralErrors.length > 0) {
        throw new Error(
          `Episode outline is structurally unplayable after self-repair:\n- ${structuralErrors.join('\n- ')}`
        );
      }
      console.log('[River] Self-repair successful — scene graph is now valid');
    }
    
    this.validateOutline(result.episodeOutline);
    return result;
  }
  
  /**
   * Validate that the outline forms a playable scene graph:
   * - Every choice option declares nextScene (existing scene or END)
   * - Every scene without a choice point declares defaultNextScene
   * - Every scene is reachable from the opening scene
   * - At least one path terminates (reaches END)
   * 
   * Returns a list of human-readable errors (empty = valid).
   */
  private validateTransitions(outline: EpisodeOutline): string[] {
    const errors: string[] = [];
    const scenes = outline.scenes || [];
    const choicePoints = outline.choicePoints || [];
    
    if (scenes.length === 0) {
      return ['Episode has no scenes'];
    }
    
    const sceneIds = new Set(scenes.map(s => s.id));
    const scenesWithChoices = new Set<string>();
    
    for (const cp of choicePoints) {
      if (!sceneIds.has(cp.scene)) {
        errors.push(`Choice point "${cp.id}" is attached to unknown scene "${cp.scene}"`);
        continue;
      }
      scenesWithChoices.add(cp.scene);
      
      for (const opt of cp.options || []) {
        if (!opt.nextScene) {
          errors.push(`Option "${opt.id}" of choice "${cp.id}" is missing "nextScene"`);
        } else if (opt.nextScene !== EPISODE_END && !sceneIds.has(opt.nextScene)) {
          errors.push(`Option "${opt.id}" of choice "${cp.id}" points to unknown scene "${opt.nextScene}"`);
        }
      }
    }
    
    for (const scene of scenes) {
      if (scenesWithChoices.has(scene.id)) continue;
      
      if (!scene.defaultNextScene) {
        errors.push(`Scene "${scene.id}" has no choice point and no "defaultNextScene" — it is a dead end`);
      } else if (scene.defaultNextScene !== EPISODE_END && !sceneIds.has(scene.defaultNextScene)) {
        errors.push(`Scene "${scene.id}" has "defaultNextScene" pointing to unknown scene "${scene.defaultNextScene}"`);
      }
    }
    
    // Reachability walk from the opening scene
    const reachable = new Set<string>();
    let reachesEnd = false;
    const queue = [scenes[0].id];
    
    while (queue.length > 0) {
      const id = queue.pop()!;
      if (id === EPISODE_END) {
        reachesEnd = true;
        continue;
      }
      if (reachable.has(id) || !sceneIds.has(id)) continue;
      reachable.add(id);
      
      if (scenesWithChoices.has(id)) {
        for (const cp of choicePoints.filter(c => c.scene === id)) {
          for (const opt of cp.options || []) {
            if (opt.nextScene) queue.push(opt.nextScene);
          }
        }
      } else {
        const scene = scenes.find(s => s.id === id);
        if (scene?.defaultNextScene) queue.push(scene.defaultNextScene);
      }
    }
    
    for (const scene of scenes) {
      if (!reachable.has(scene.id)) {
        errors.push(`Scene "${scene.id}" is unreachable from the opening scene "${scenes[0].id}"`);
      }
    }
    
    if (!reachesEnd) {
      errors.push('No path through the episode ever reaches "END" — the episode cannot terminate');
    }
    
    // Branches need stable ids (branch-aware ending dialogue is keyed by
    // them) and a triggeredBy list (the only machine-readable mapping from
    // choice history to a branch).
    for (const [i, branch] of (outline.branches || []).entries()) {
      if (!branch.id) {
        errors.push(`Branch ${i} ("${branch.name || 'unnamed'}") is missing "id"`);
      }
      if (!Array.isArray(branch.triggeredBy) || branch.triggeredBy.length === 0) {
        errors.push(`Branch ${i} ("${branch.name || branch.id || 'unnamed'}") is missing "triggeredBy" (choice ids that select it)`);
      }
    }
    
    return errors;
  }
  
  private buildStructuralRepairPrompt(draft: StoryArchitectOutput, errors: string[]): string {
    return `YOUR PREVIOUS EPISODE OUTLINE:
${JSON.stringify(draft, null, 2)}

The outline above is structurally UNPLAYABLE. Fix these problems:
${errors.map(e => `- ${e}`).join('\n')}

RULES:
- Every option in every choicePoint needs "nextScene": an existing scene id or "END"
- Every scene without a choice point needs "defaultNextScene": an existing scene id or "END"
- Every scene must be reachable from the first scene
- At least one path must reach "END"
- Every branch needs "id" (kebab-case) and "triggeredBy" ("choiceId:optionId" paths)

Keep the story content unchanged — ONLY fix the scene transitions and ids.
Return the COMPLETE corrected JSON in the exact same structure, wrapped in a \`\`\`json code block.`;
  }
  
  private validateOutline(outline: EpisodeOutline): void {
    // Soft design guidelines — warn only, never block
    if (outline.estimatedPlayTime < 10 || outline.estimatedPlayTime > 15) {
      console.warn(`[River] Warning: Play time ${outline.estimatedPlayTime} outside 10-15 min range`);
    }
    
    if ((outline.choicePoints?.length ?? 0) < 5) {
      console.warn(`[River] Warning: Only ${outline.choicePoints?.length ?? 0} choice points (min 5 recommended)`);
    }
    
    if ((outline.branches?.length ?? 0) < 2) {
      console.warn(`[River] Warning: Only ${outline.branches?.length ?? 0} branches (min 2 required)`);
    }
    
    if ((outline.targetTraits?.length ?? 0) < 3 || (outline.targetTraits?.length ?? 0) > 5) {
      console.warn(`[River] Warning: ${outline.targetTraits?.length ?? 0} target traits (3-5 recommended)`);
    }
  }
}
