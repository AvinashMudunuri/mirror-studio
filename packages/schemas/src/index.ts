import { z } from 'zod';

/**
 * Core type definitions for Project MIRROR Studio
 * Based on PRD v1.0 and AI Studio Handbook v1.0
 */

// ============================================================================
// AGENT TYPES
// ============================================================================

export const AgentIdSchema = z.enum([
  'CEO',
  'CREATIVE_DIRECTOR',
  'STORY_ARCHITECT',
  'WORLD_BUILDER',
  'CHARACTER_DESIGNER',
  'DIALOGUE_WRITER',
  'GAME_DESIGNER',
  'CHILD_PSYCHOLOGIST',
  'LEARNING_SCIENTIST',
  'ETHICS_REVIEWER',
  'SPORTS_CONSULTANT',
  'ANIME_CONSULTANT',
  'TEEN_REVIEWER',
  'PARENT_REVIEWER',
  'QA_REVIEWER',
  'PUBLISHER',
  'ANALYTICS',
  'ILLUSTRATION',
  'VOICE_SCRIPT',
  'JSON_EXPORT',
  'TECH_LEAD',
  'BACKEND_DEVELOPER',
  'FRONTEND_DEVELOPER',
  'DEVOPS'
]);

export type AgentId = z.infer<typeof AgentIdSchema>;

export const MessageTypeSchema = z.enum([
  'REQUEST',
  'RESPONSE',
  'CHALLENGE',
  'APPROVAL',
  'REJECTION',
  'BROADCAST',
  'QUERY'
]);

export type MessageType = z.infer<typeof MessageTypeSchema>;

export const MessagePrioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']);
export type MessagePriority = z.infer<typeof MessagePrioritySchema>;

export const AgentMessageSchema = z.object({
  id: z.string().uuid(),
  type: MessageTypeSchema,
  from: AgentIdSchema,
  to: z.union([AgentIdSchema, z.array(AgentIdSchema)]),
  threadId: z.string(),
  workflowId: z.string(),
  timestamp: z.string().datetime(),
  priority: MessagePrioritySchema,
  payload: z.object({
    content: z.any(),
    context: z.any().optional(),
    constraints: z.array(z.any()).optional(),
    metadata: z.record(z.any()).optional()
  }),
  replyTo: z.string().uuid().optional(),
  requiresResponse: z.boolean(),
  expiresAt: z.string().datetime().optional()
});

export type AgentMessage = z.infer<typeof AgentMessageSchema>;

// ============================================================================
// STORY TYPES
// ============================================================================

export const WorldIdSchema = z.enum([
  'NEW_SCHOOL',
  'SPORTS_ACADEMY',
  'ANIME_HERO',
  'FANTASY_KINGDOM',
  'SPACE_COLONY',
  'DETECTIVE_ACADEMY',
  'ZOMBIE_SURVIVAL',
  'CRICKET_WORLD_CUP'
]);

export type WorldId = z.infer<typeof WorldIdSchema>;

export const WorldSchema = z.object({
  id: WorldIdSchema,
  name: z.string(),
  description: z.string(),
  themes: z.array(z.string()),
  targetAge: z.tuple([z.number(), z.number()]),
  seasons: z.array(z.string())
});

export type World = z.infer<typeof WorldSchema>;

export const SeasonSchema = z.object({
  id: z.string().uuid(),
  worldId: WorldIdSchema,
  seasonNumber: z.number(),
  title: z.string(),
  description: z.string(),
  themes: z.array(z.string()),
  episodeCount: z.number(),
  episodes: z.array(z.string())
});

export type Season = z.infer<typeof SeasonSchema>;

export const EmotionSchema = z.enum([
  'HAPPY',
  'SAD',
  'ANGRY',
  'FEARFUL',
  'SURPRISED',
  'DISGUSTED',
  'NEUTRAL',
  'ANXIOUS',
  'EXCITED',
  'CONFUSED',
  'ASHAMED',
  'PROUD',
  'GUILTY',
  'HOPEFUL',
  'DISAPPOINTED'
]);

export type Emotion = z.infer<typeof EmotionSchema>;

export const DialogueLineSchema = z.object({
  id: z.string().uuid(),
  character: z.string(), // CharacterId | 'NARRATOR' | 'INTERNAL'
  text: z.string(),
  emotion: EmotionSchema.optional(),
  action: z.string().optional(),
  pause: z.number().optional(), // milliseconds
  emphasis: z.array(z.string()).optional() // words to emphasize
});

export type DialogueLine = z.infer<typeof DialogueLineSchema>;

export const ChoiceOptionSchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
  metadata: z.object({
    traitMappings: z.record(z.number()).optional(),
    relationshipImpacts: z.record(z.number()).optional(),
    consequence: z.string().optional()
  }).optional()
});

export type ChoiceOption = z.infer<typeof ChoiceOptionSchema>;

export const ChoicePointSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'MULTIPLE_CHOICE',
    'PRIORITY_RANKING',
    'CONVERSATION',
    'QUICK_REACTION',
    'RESOURCE_ALLOCATION',
    'ETHICAL_DILEMMA',
    'NEGOTIATION',
    'LEADERSHIP_DECISION'
  ]),
  prompt: z.string(),
  options: z.array(ChoiceOptionSchema),
  timeLimit: z.number().optional(), // seconds
  context: z.string().optional()
});

export type ChoicePoint = z.infer<typeof ChoicePointSchema>;

export const SceneSchema = z.object({
  id: z.string().uuid(),
  sceneNumber: z.number(),
  title: z.string().optional(),
  location: z.string(),
  characters: z.array(z.string()), // CharacterIds
  dialogue: z.array(DialogueLineSchema),
  choicePoint: ChoicePointSchema.optional(),
  emotionalBeat: z.string().optional(),
  estimatedDuration: z.number(), // seconds
  nextScenes: z.record(z.string()) // optionId -> sceneId mapping
});

export type Scene = z.infer<typeof SceneSchema>;

export const EpisodeSchema = z.object({
  id: z.string().uuid(),
  worldId: WorldIdSchema,
  seasonId: z.string().uuid(),
  episodeNumber: z.number(),
  title: z.string(),
  synopsis: z.string(),
  themes: z.array(z.string()),
  targetTraits: z.array(z.string()),
  targetAge: z.tuple([z.number(), z.number()]),
  
  scenes: z.array(SceneSchema),
  characters: z.array(z.string()),
  
  estimatedPlayTime: z.number(), // minutes
  
  metadata: z.object({
    createdBy: z.array(AgentIdSchema),
    createdAt: z.string().datetime(),
    version: z.number(),
    status: z.enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED']),
    reviews: z.array(z.any()).optional(),
    debates: z.array(z.any()).optional()
  })
});

export type Episode = z.infer<typeof EpisodeSchema>;

// ============================================================================
// CHARACTER TYPES
// ============================================================================

export const BigFiveTraitSchema = z.object({
  openness: z.number().min(0).max(100),
  conscientiousness: z.number().min(0).max(100),
  extraversion: z.number().min(0).max(100),
  agreeableness: z.number().min(0).max(100),
  neuroticism: z.number().min(0).max(100)
});

export type BigFiveTrait = z.infer<typeof BigFiveTraitSchema>;

export const RelationshipTypeSchema = z.enum([
  'FRIENDSHIP',
  'TRUST',
  'RESPECT',
  'RIVALRY',
  'INFLUENCE',
  'FEAR',
  'ROMANTIC',
  'MENTORSHIP'
]);

export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;

export const RelationshipStateSchema = z.object({
  type: RelationshipTypeSchema,
  value: z.number().min(-100).max(100),
  history: z.array(z.object({
    timestamp: z.string().datetime(),
    event: z.string(),
    delta: z.number()
  }))
});

export type RelationshipState = z.infer<typeof RelationshipStateSchema>;

export const CharacterSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  age: z.number(),
  pronouns: z.string(),
  
  appearance: z.object({
    brief: z.string(),
    distinctiveFeatures: z.array(z.string())
  }),
  
  personality: z.object({
    coreTraits: z.array(z.string()),
    bigFiveProfile: BigFiveTraitSchema,
    mannerisms: z.array(z.string()),
    speechPatterns: z.array(z.string()),
    emotionalTendencies: z.string()
  }),
  
  background: z.object({
    family: z.string(),
    interests: z.array(z.string()),
    strengths: z.array(z.string()),
    struggles: z.array(z.string()),
    secrets: z.array(z.string()).optional()
  }),
  
  goals: z.object({
    conscious: z.array(z.string()),
    unconscious: z.array(z.string())
  }),
  
  relationships: z.record(RelationshipStateSchema),
  
  voiceGuidelines: z.object({
    vocabularyLevel: z.string(),
    sentenceComplexity: z.string(),
    emotionalExpressiveness: z.string(),
    examples: z.array(z.string())
  }),
  
  storyRole: z.string(),
  worldId: WorldIdSchema
});

export type Character = z.infer<typeof CharacterSchema>;

// ============================================================================
// TRAIT TYPES
// ============================================================================

export const TraitIdSchema = z.enum([
  'EMPATHY',
  'LEADERSHIP',
  'RESILIENCE',
  'CURIOSITY',
  'INTEGRITY',
  'COMMUNICATION',
  'ADAPTABILITY',
  'CONFIDENCE',
  'JUDGMENT',
  'EMOTIONAL_AWARENESS'
]);

export type TraitId = z.infer<typeof TraitIdSchema>;

export const TraitMappingSchema = z.object({
  choiceId: z.string().uuid(),
  traitId: TraitIdSchema,
  delta: z.number().min(-10).max(10),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1) // 0-1, how confident in this mapping
});

export type TraitMapping = z.infer<typeof TraitMappingSchema>;

export const TraitProfileSchema = z.object({
  playerId: z.string().uuid(),
  traits: z.record(z.object({
    value: z.number().min(0).max(100),
    history: z.array(z.object({
      timestamp: z.string().datetime(),
      episodeId: z.string().uuid(),
      choiceId: z.string().uuid(),
      delta: z.number()
    })),
    confidence: z.number().min(0).max(1)
  })),
  lastUpdated: z.string().datetime()
});

export type TraitProfile = z.infer<typeof TraitProfileSchema>;

// ============================================================================
// REFLECTION TYPES
// ============================================================================

export const ReflectionSchema = z.object({
  id: z.string().uuid(),
  episodeId: z.string().uuid(),
  playerId: z.string().uuid(),
  
  observations: z.array(z.string()),
  conversationStarters: z.array(z.string()),
  
  tone: z.enum(['GROWTH', 'NEUTRAL']),
  
  metadata: z.object({
    generatedAt: z.string().datetime(),
    choicesSummary: z.array(z.object({
      choiceId: z.string().uuid(),
      optionChosen: z.string()
    })),
    traitsHighlighted: z.array(TraitIdSchema)
  })
});

export type Reflection = z.infer<typeof ReflectionSchema>;

// ============================================================================
// PLAYER TYPES
// ============================================================================

export const PlayerSchema = z.object({
  id: z.string().uuid(),
  age: z.number(),
  
  completedEpisodes: z.array(z.string().uuid()),
  characterRelationships: z.record(RelationshipStateSchema),
  traitProfile: TraitProfileSchema,
  
  preferences: z.object({
    favoriteWorld: WorldIdSchema.optional(),
    favoriteCharacter: z.string().uuid().optional(),
    playStyle: z.string().optional()
  }),
  
  achievements: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string(),
    unlockedAt: z.string().datetime()
  })),
  
  metadata: z.object({
    createdAt: z.string().datetime(),
    lastActive: z.string().datetime(),
    totalPlayTime: z.number() // minutes
  })
});

export type Player = z.infer<typeof PlayerSchema>;

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export const EngagementMetricsSchema = z.object({
  episodeId: z.string().uuid(),
  
  completionRate: z.number().min(0).max(1),
  averagePlayTime: z.number(), // minutes
  dropOffPoints: z.array(z.object({
    sceneId: z.string().uuid(),
    dropOffRate: z.number()
  })),
  
  replayRate: z.number().min(0).max(1),
  
  choiceDistribution: z.record(z.object({
    choiceId: z.string().uuid(),
    options: z.record(z.number()) // optionId -> count
  })),
  
  reflectionReadRate: z.number().min(0).max(1),
  
  averageRating: z.number().min(0).max(5).optional(),
  
  totalPlays: z.number(),
  
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime()
});

export type EngagementMetrics = z.infer<typeof EngagementMetricsSchema>;

// ============================================================================
// MEMORY TYPES
// ============================================================================

export const MemoryScopeSchema = z.enum([
  'EPISODE',
  'AGENT_WORKING',
  'INSTITUTIONAL',
  'PLAYER'
]);

export type MemoryScope = z.infer<typeof MemoryScopeSchema>;

export const MemoryEntrySchema = z.object({
  id: z.string().uuid(),
  scope: MemoryScopeSchema,
  key: z.string(),
  value: z.any(),
  metadata: z.object({
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime().optional(),
    accessCount: z.number(),
    lastAccessed: z.string().datetime().optional()
  }),
  embedding: z.array(z.number()).optional() // vector embedding for semantic search
});

export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

// ============================================================================
// WORKFLOW TYPES
// ============================================================================

export const WorkflowStatusSchema = z.enum([
  'PLANNING',
  'CREATING',
  'REVIEWING',
  'DEBATING',
  'REVISING',
  'PUBLISHING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
]);

export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;

export const WorkflowSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['EPISODE_CREATION', 'EPISODE_REVISION', 'SEASON_PLANNING']),
  status: WorkflowStatusSchema,
  
  target: z.object({
    worldId: WorldIdSchema.optional(),
    seasonId: z.string().uuid().optional(),
    episodeId: z.string().uuid().optional()
  }),
  
  participants: z.array(AgentIdSchema),
  
  timeline: z.object({
    startedAt: z.string().datetime(),
    estimatedCompletion: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional()
  }),
  
  state: z.record(z.any()), // workflow-specific state
  
  messages: z.array(z.string().uuid()), // message IDs
  
  checkpoints: z.array(z.object({
    name: z.string(),
    status: z.enum(['PENDING', 'PASSED', 'FAILED']),
    timestamp: z.string().datetime().optional()
  }))
});

export type Workflow = z.infer<typeof WorkflowSchema>;

// ============================================================================
// EXPORTS
// ============================================================================

export * from './agent-specs';
export * from './player-projection';
