import { z } from 'zod';
import { AgentIdSchema, AgentMessage, TraitMapping, Episode, Character } from './index';

/**
 * Agent-specific input/output schemas
 * Based on AI Studio Handbook v1.0
 */

// ============================================================================
// CEO AGENT
// ============================================================================

export const CEOInputSchema = z.object({
  type: z.enum(['APPROVAL_REQUEST', 'DEBATE_ESCALATION', 'SPRINT_PLANNING', 'ANALYTICS_REVIEW']),
  
  episode: z.object({
    content: z.any(), // Episode
    reviews: z.array(z.any()),
    debates: z.array(z.any())
  }).optional(),
  
  debate: z.object({
    topic: z.string(),
    participants: z.array(AgentIdSchema),
    positions: z.array(z.any()),
    evidence: z.array(z.any())
  }).optional(),
  
  sprintPlan: z.object({
    goals: z.array(z.any()),
    resources: z.array(z.any()),
    timeline: z.any()
  }).optional(),
  
  analytics: z.object({
    episodePerformance: z.array(z.any()),
    playerFeedback: z.array(z.any()),
    trends: z.array(z.any())
  }).optional()
});

export type CEOInput = z.infer<typeof CEOInputSchema>;

export const CEOOutputSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'NEEDS_REVISION', 'ESCALATE_TO_HUMAN']),
  reasoning: z.string(),
  feedback: z.array(z.object({
    agentId: AgentIdSchema,
    message: z.string()
  })),
  actionItems: z.array(z.object({
    agent: AgentIdSchema,
    action: z.string(),
    deadline: z.string().datetime()
  })).optional(),
  strategicNotes: z.string().optional()
});

export type CEOOutput = z.infer<typeof CEOOutputSchema>;

// ============================================================================
// STORY ARCHITECT AGENT
// ============================================================================

export const StoryArchitectInputSchema = z.object({
  type: z.enum(['NEW_EPISODE', 'REVISION_REQUEST']),
  
  brief: z.object({
    worldId: z.string(),
    seasonId: z.string().uuid(),
    episodeNumber: z.number(),
    themes: z.array(z.string()),
    targetTraits: z.array(z.string()),
    characters: z.array(z.any()),
    previousEpisodes: z.array(z.any()),
    playerData: z.any().optional()
  }),
  
  revisionRequest: z.object({
    currentDraft: z.any(),
    feedback: z.array(z.any()),
    constraints: z.array(z.any())
  }).optional()
});

export type StoryArchitectInput = z.infer<typeof StoryArchitectInputSchema>;

export const StoryArchitectOutputSchema = z.object({
  episodeOutline: z.object({
    title: z.string(),
    synopsis: z.string(),
    themes: z.array(z.string()),
    targetTraits: z.array(z.string()),
    
    scenes: z.array(z.any()),
    choicePoints: z.array(z.any()),
    branches: z.array(z.any()),
    
    emotionalArc: z.array(z.any()),
    characterArcs: z.array(z.any()),
    
    traitMapping: z.array(z.any()),
    relationshipDynamics: z.array(z.any()),
    
    replayHooks: z.array(z.string()),
    estimatedPlayTime: z.number(),
    
    educationalGoals: z.array(z.string()),
    conversationStarters: z.array(z.string())
  }),
  
  designNotes: z.string(),
  uncertainties: z.array(z.string()).optional(),
  alternativesConsidered: z.array(z.any()).optional()
});

export type StoryArchitectOutput = z.infer<typeof StoryArchitectOutputSchema>;

// ============================================================================
// CHARACTER DESIGNER AGENT
// ============================================================================

export const CharacterDesignerInputSchema = z.object({
  type: z.enum(['NEW_CHARACTER', 'CHARACTER_REVIEW', 'RELATIONSHIP_DESIGN', 'ARC_DEVELOPMENT']),
  
  newCharacter: z.object({
    worldId: z.string(),
    role: z.string(),
    requirements: z.array(z.any()),
    relationshipContext: z.array(z.any())
  }).optional(),
  
  characterReview: z.object({
    character: z.any(),
    usageContext: z.array(z.any()),
    consistencyCheck: z.boolean()
  }).optional(),
  
  relationshipDesign: z.object({
    characters: z.tuple([z.any(), z.any()]),
    desiredDynamic: z.string(),
    context: z.any()
  }).optional(),
  
  arcDevelopment: z.object({
    character: z.any(),
    season: z.any(),
    growthGoals: z.array(z.any())
  }).optional()
});

export type CharacterDesignerInput = z.infer<typeof CharacterDesignerInputSchema>;

export const CharacterDesignerOutputSchema = z.object({
  character: z.any().optional(), // Full Character schema
  relationshipDynamics: z.array(z.any()).optional(),
  characterArc: z.any().optional(),
  
  designNotes: z.string(),
  representationNotes: z.string().optional()
});

export type CharacterDesignerOutput = z.infer<typeof CharacterDesignerOutputSchema>;

// ============================================================================
// DIALOGUE WRITER AGENT
// ============================================================================

export const DialogueWriterInputSchema = z.object({
  type: z.enum(['WRITE_DIALOGUE', 'REVISE_DIALOGUE', 'VOICE_CHECK']),
  
  writeRequest: z.object({
    episodeOutline: z.any(),
    characters: z.array(z.any()),
    scenes: z.array(z.any()),
    emotionalBeats: z.array(z.any()),
    choicePoints: z.array(z.any())
  }).optional(),
  
  revisionRequest: z.object({
    currentDialogue: z.array(z.any()),
    feedback: z.array(z.any()),
    specificScenes: z.array(z.string().uuid()).optional()
  }).optional(),
  
  voiceCheck: z.object({
    character: z.any(),
    dialogueSample: z.array(z.string()),
    context: z.array(z.any())
  }).optional()
});

export type DialogueWriterInput = z.infer<typeof DialogueWriterInputSchema>;

export const DialogueWriterOutputSchema = z.object({
  dialogue: z.array(z.object({
    sceneId: z.string(),
    lines: z.array(z.any())
  })),
  
  choiceDialogue: z.array(z.object({
    choiceId: z.string(),
    options: z.array(z.any()),
    responseDialogue: z.record(z.array(z.any()))
  })),
  
  internalMonologue: z.array(z.any()).optional(),
  
  voiceNotes: z.string(),
  alternativeLines: z.array(z.object({
    lineId: z.string(),
    alternatives: z.array(z.string()),
    reasoning: z.string()
  })).optional()
});

export type DialogueWriterOutput = z.infer<typeof DialogueWriterOutputSchema>;

// ============================================================================
// PSYCHOLOGIST AGENT
// ============================================================================

export const PsychologistInputSchema = z.object({
  type: z.enum(['EPISODE_REVIEW', 'TRAIT_VALIDATION', 'REFLECTION_REVIEW', 'AGE_CHECK']),
  
  episodeReview: z.object({
    episode: z.any(),
    targetAgeRange: z.tuple([z.number(), z.number()]),
    themes: z.array(z.string()),
    traitMappings: z.array(z.any())
  }).optional(),
  
  traitValidation: z.object({
    choices: z.array(z.any()),
    traitMappings: z.array(z.any()),
    reasoning: z.array(z.string())
  }).optional(),
  
  reflectionReview: z.object({
    reflections: z.array(z.any()),
    playerChoices: z.any(),
    tone: z.enum(['GROWTH', 'JUDGMENT'])
  }).optional()
});

export type PsychologistInput = z.infer<typeof PsychologistInputSchema>;

export const PsychologistOutputSchema = z.object({
  decision: z.enum(['APPROVED', 'APPROVED_WITH_NOTES', 'NEEDS_REVISION', 'REJECTED']),
  
  ageAppropriateness: z.object({
    rating: z.enum(['APPROPRIATE', 'BORDERLINE', 'TOO_MATURE', 'TOO_SIMPLE']),
    reasoning: z.string(),
    concerns: z.array(z.string()).optional()
  }),
  
  traitMapping: z.object({
    valid: z.boolean(),
    accuracy: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    concerns: z.array(z.string()).optional(),
    suggestions: z.array(z.string()).optional()
  }),
  
  emotionalSafety: z.object({
    safe: z.boolean(),
    concerns: z.array(z.string()).optional(),
    triggerWarnings: z.array(z.any()).optional()
  }),
  
  educationalValue: z.object({
    rating: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    learningOpportunities: z.array(z.string()),
    improvements: z.array(z.string()).optional()
  }),
  
  reflectionQuality: z.object({
    rating: z.enum(['EXCELLENT', 'GOOD', 'NEEDS_WORK']),
    tone: z.enum(['GROWTH_FOCUSED', 'JUDGMENTAL', 'NEUTRAL']),
    revisions: z.array(z.string()).optional()
  }),
  
  recommendations: z.array(z.string()),
  mustFix: z.array(z.string()).optional(),
  
  developmentalNotes: z.string().optional()
});

export type PsychologistOutput = z.infer<typeof PsychologistOutputSchema>;

// ============================================================================
// GAME DESIGNER AGENT
// ============================================================================

export const GameDesignerInputSchema = z.object({
  type: z.enum(['EPISODE_REVIEW', 'MECHANICS_DESIGN', 'ENGAGEMENT_ANALYSIS', 'REWARD_DESIGN']),
  
  episodeReview: z.object({
    episode: z.any(),
    targetPlayTime: z.number(),
    playerData: z.any().optional()
  }).optional(),
  
  mechanicsDesign: z.object({
    goals: z.array(z.any()),
    constraints: z.array(z.any())
  }).optional(),
  
  engagementAnalysis: z.object({
    episodes: z.array(z.any()),
    metrics: z.array(z.any())
  }).optional()
});

export type GameDesignerInput = z.infer<typeof GameDesignerInputSchema>;

export const GameDesignerOutputSchema = z.object({
  decision: z.enum(['APPROVED', 'NEEDS_REVISION', 'REJECTED']),
  
  engagementAssessment: z.object({
    rating: z.enum(['EXCELLENT', 'GOOD', 'NEEDS_WORK', 'POOR']),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    predictedCompletion: z.number(),
    predictedReplay: z.number()
  }),
  
  pacing: z.object({
    rating: z.enum(['WELL_PACED', 'TOO_FAST', 'TOO_SLOW', 'UNEVEN']),
    analysis: z.string(),
    adjustments: z.array(z.any()).optional()
  }),
  
  choiceQuality: z.object({
    rating: z.enum(['STRONG', 'ADEQUATE', 'WEAK']),
    meaningfulness: z.number(),
    balance: z.any(),
    improvements: z.array(z.string()).optional()
  }),
  
  replayValue: z.object({
    rating: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    hooks: z.array(z.any()),
    suggestions: z.array(z.string()).optional()
  }),
  
  flowState: z.object({
    achievable: z.boolean(),
    challenges: z.array(z.any()),
    skills: z.array(z.any()),
    balance: z.enum(['GOOD', 'TOO_HARD', 'TOO_EASY', 'UNEVEN'])
  }),
  
  recommendations: z.array(z.string()),
  mustFix: z.array(z.string()).optional(),
  
  dataRequests: z.array(z.string()).optional()
});

export type GameDesignerOutput = z.infer<typeof GameDesignerOutputSchema>;

// ============================================================================
// ETHICS REVIEWER AGENT
// ============================================================================

export const EthicsReviewerInputSchema = z.object({
  type: z.enum(['EPISODE_REVIEW', 'TRAIT_BIAS_CHECK', 'REPRESENTATION_REVIEW', 'PRIVACY_REVIEW']),
  
  episodeReview: z.object({
    episode: z.any(),
    targetAudience: z.any(),
    sensitiveContent: z.array(z.any()).optional()
  }).optional(),
  
  biasCheck: z.object({
    traitMappings: z.array(z.any()),
    choiceOutcomes: z.array(z.any()),
    populations: z.array(z.string())
  }).optional(),
  
  representationReview: z.object({
    characters: z.array(z.any()),
    world: z.any(),
    diversityGoals: z.array(z.any())
  }).optional()
});

export type EthicsReviewerInput = z.infer<typeof EthicsReviewerInputSchema>;

export const EthicsReviewerOutputSchema = z.object({
  decision: z.enum(['APPROVED', 'APPROVED_WITH_MONITORING', 'NEEDS_REVISION', 'REJECTED']),
  
  ethicalAssessment: z.object({
    rating: z.enum(['CLEAR', 'MINOR_CONCERNS', 'SIGNIFICANT_CONCERNS', 'VIOLATIONS']),
    principles: z.record(z.any())
  }),
  
  safetyCheck: z.object({
    safe: z.boolean(),
    concerns: z.array(z.any()).optional(),
    contentWarnings: z.array(z.any()).optional()
  }),
  
  representationCheck: z.object({
    rating: z.enum(['EXCELLENT', 'GOOD', 'NEEDS_WORK', 'HARMFUL']),
    authenticity: z.number(),
    stereotypeRisk: z.array(z.any()),
    recommendations: z.array(z.string()).optional()
  }),
  
  biasCheck: z.object({
    detected: z.array(z.any()),
    severity: z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    requiresFix: z.boolean()
  }),
  
  privacyCheck: z.object({
    compliant: z.boolean(),
    concerns: z.array(z.any()).optional()
  }),
  
  recommendations: z.array(z.string()),
  mustFix: z.array(z.string()).optional(),
  
  escalationRequired: z.boolean()
});

export type EthicsReviewerOutput = z.infer<typeof EthicsReviewerOutputSchema>;

// ============================================================================
// AGENT CAPABILITY REGISTRY
// ============================================================================

export interface AgentCapability {
  id: string;
  name: string;
  inputSchema: z.ZodType<any>;
  outputSchema: z.ZodType<any>;
  sla: {
    maxResponseTime: number; // milliseconds
    availability: string; // e.g., "24/7"
  };
}

export const AGENT_CAPABILITIES: Record<string, AgentCapability> = {
  CEO: {
    id: 'CEO',
    name: 'CEO Agent (Morgan)',
    inputSchema: CEOInputSchema,
    outputSchema: CEOOutputSchema,
    sla: {
      maxResponseTime: 4 * 60 * 60 * 1000, // 4 hours
      availability: '24/7'
    }
  },
  STORY_ARCHITECT: {
    id: 'STORY_ARCHITECT',
    name: 'Story Architect (River)',
    inputSchema: StoryArchitectInputSchema,
    outputSchema: StoryArchitectOutputSchema,
    sla: {
      maxResponseTime: 6 * 60 * 60 * 1000, // 6 hours
      availability: '24/7'
    }
  },
  CHARACTER_DESIGNER: {
    id: 'CHARACTER_DESIGNER',
    name: 'Character Designer (Kai)',
    inputSchema: CharacterDesignerInputSchema,
    outputSchema: CharacterDesignerOutputSchema,
    sla: {
      maxResponseTime: 4 * 60 * 60 * 1000, // 4 hours
      availability: '24/7'
    }
  },
  DIALOGUE_WRITER: {
    id: 'DIALOGUE_WRITER',
    name: 'Dialogue Writer (Echo)',
    inputSchema: DialogueWriterInputSchema,
    outputSchema: DialogueWriterOutputSchema,
    sla: {
      maxResponseTime: 8 * 60 * 60 * 1000, // 8 hours
      availability: '24/7'
    }
  },
  CHILD_PSYCHOLOGIST: {
    id: 'CHILD_PSYCHOLOGIST',
    name: 'Child Psychologist (Dr. Sam Okafor)',
    inputSchema: PsychologistInputSchema,
    outputSchema: PsychologistOutputSchema,
    sla: {
      maxResponseTime: 4 * 60 * 60 * 1000, // 4 hours
      availability: '24/7'
    }
  },
  GAME_DESIGNER: {
    id: 'GAME_DESIGNER',
    name: 'Game Designer (Zara Patel)',
    inputSchema: GameDesignerInputSchema,
    outputSchema: GameDesignerOutputSchema,
    sla: {
      maxResponseTime: 3 * 60 * 60 * 1000, // 3 hours
      availability: '24/7'
    }
  },
  ETHICS_REVIEWER: {
    id: 'ETHICS_REVIEWER',
    name: 'Ethics Reviewer (Dr. Alex Chen)',
    inputSchema: EthicsReviewerInputSchema,
    outputSchema: EthicsReviewerOutputSchema,
    sla: {
      maxResponseTime: 3 * 60 * 60 * 1000, // 3 hours
      availability: '24/7'
    }
  }
};
