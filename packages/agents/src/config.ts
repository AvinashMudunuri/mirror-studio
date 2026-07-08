/**
 * Central configuration for AI agents
 * All model settings, API keys, and agent-specific configs are defined here
 */

// LLM Provider Configuration
export const LLM_CONFIG = {
  // Default models for each provider.
  // Creation and review deliberately use DIFFERENT models: generation needs
  // the strongest available model, while reviewers judge provided text and
  // run fine on a cheaper one — reviews also carry the largest inputs
  // (the whole episode), so this is where token cost concentrates.
  defaultModels: {
    anthropic: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
    anthropicReview: process.env.ANTHROPIC_REVIEW_MODEL || 'claude-haiku-4-5-20251001',
    openai: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
  },
  
  // API Keys (read from environment)
  apiKeys: {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
  },

  // Which backend serves Claude calls. 'bedrock' routes through AWS
  // Bedrock (AWS credentials, no ANTHROPIC_API_KEY needed) instead of the
  // Anthropic API directly — see packages/agents/README.md and
  // docs/decisions/004-aws-bedrock-alternative-backend.md. Model ID
  // strings differ between the two (e.g. `claude-sonnet-5` vs a Bedrock ID
  // like `us.anthropic.claude-sonnet-5`), so ANTHROPIC_MODEL/
  // ANTHROPIC_REVIEW_MODEL/<AGENT>_MODEL must be set accordingly per backend.
  claude: {
    backend: (process.env.CLAUDE_BACKEND === 'bedrock' ? 'bedrock' : 'anthropic') as 'anthropic' | 'bedrock',
  },

  // AWS Bedrock connection (only used when claude.backend === 'bedrock').
  // All fields are optional overrides — omitted fields fall back to the
  // standard AWS credential provider chain (AWS_ACCESS_KEY_ID/
  // AWS_SECRET_ACCESS_KEY/AWS_SESSION_TOKEN env vars, ~/.aws/credentials,
  // or an IAM role), which is the recommended way to authenticate.
  bedrock: {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  },
  
  // Default temperature settings by agent role
  // NOTE: For Claude 5+ models (claude-sonnet-5, claude-opus-5, etc.) and Opus 4.6+,
  // temperature is automatically mapped to 'effort' parameter nested in output_config
  // with adaptive thinking enabled:
  //   0.0-0.3 = low effort (deterministic)
  //   0.4-0.6 = medium effort (balanced)
  //   0.7-1.0 = high effort (creative, default - not sent to optimize caching)
  temperatures: {
    creative: 0.8,      // Story Architect, Dialogue Writer
    analytical: 0.3,    // Developer Agent
    balanced: 0.6,      // Character Designer, Creative Director, CEO
  },
  
  // Default max tokens by task complexity
  maxTokens: {
    small: 2048,        // Simple responses
    medium: 4096,       // Standard tasks
    large: 8192,        // Complex generation (episodes, code)
    // Full-episode generation (outline, all-scene dialogue). Live runs
    // showed these ALWAYS truncating at large+headroom (16384) and paying
    // for a wasted first attempt before succeeding at 32768 — so budget
    // for the successful size up front.
    xlarge: 24576,
  },
} as const;

// Agent-specific configurations
export const AGENT_MODELS = {
  // Content Creation Agents — strongest model, generous budgets
  STORY_ARCHITECT: {
    model: LLM_CONFIG.defaultModels.anthropic,
    temperature: LLM_CONFIG.temperatures.creative,
    maxTokens: LLM_CONFIG.maxTokens.xlarge, // full outlines truncated at 16k on every live run
  },
  
  CHARACTER_DESIGNER: {
    model: LLM_CONFIG.defaultModels.anthropic,
    temperature: LLM_CONFIG.temperatures.balanced,
    maxTokens: LLM_CONFIG.maxTokens.medium,
  },
  
  DIALOGUE_WRITER: {
    model: LLM_CONFIG.defaultModels.anthropic,
    temperature: LLM_CONFIG.temperatures.creative,
    maxTokens: LLM_CONFIG.maxTokens.xlarge, // all-scene dialogue truncated at 16k on every live run
  },
  
  CREATIVE_DIRECTOR: {
    model: LLM_CONFIG.defaultModels.anthropicReview,
    temperature: LLM_CONFIG.temperatures.balanced,
    maxTokens: LLM_CONFIG.maxTokens.medium,
  },
  
  // System Agents
  CEO_AGENT: {
    model: LLM_CONFIG.defaultModels.anthropic,
    temperature: LLM_CONFIG.temperatures.balanced,
    maxTokens: LLM_CONFIG.maxTokens.medium,
  },
  
  DEVELOPER_AGENT: {
    model: LLM_CONFIG.defaultModels.anthropic,
    temperature: LLM_CONFIG.temperatures.analytical,
    maxTokens: LLM_CONFIG.maxTokens.large,
  },
  
  // Validation Agents — review model (cheaper); they judge provided text
  QA_REVIEWER: {
    model: LLM_CONFIG.defaultModels.anthropicReview,
    temperature: 0.2, // Very low for deterministic validation
    // `large`, not `medium`: a real episode with a complex branching
    // structure can have a dozen-plus detailed errors (each carrying
    // message/location/expectedValue/actualValue/fix), and 4096 tokens
    // truncated QA's response on every single call across a live run
    // (docs/OPEN-QUESTIONS.md item 11 follow-up, 2026-07-08) — haiku models
    // don't get the adaptive-thinking retry-with-bigger-budget path, so a
    // truncated QA response never self-corrects and may silently drop
    // findings past the cutoff.
    maxTokens: LLM_CONFIG.maxTokens.large,
  },
  
  CHILD_PSYCHOLOGIST: {
    model: LLM_CONFIG.defaultModels.anthropicReview,
    temperature: 0.5, // Balanced - needs consistency but also nuanced judgment
    maxTokens: LLM_CONFIG.maxTokens.medium,
  },
  
  GAME_DESIGNER: {
    model: LLM_CONFIG.defaultModels.anthropicReview,
    temperature: 0.6, // Balanced - needs consistency with creative insight
    maxTokens: LLM_CONFIG.maxTokens.medium,
  },
  
  ETHICS_REVIEWER: {
    model: LLM_CONFIG.defaultModels.anthropicReview,
    temperature: 0.4, // Low-medium - needs consistency with nuanced ethical judgment
    maxTokens: LLM_CONFIG.maxTokens.medium,
  },
} as const;

// Helper to override model for a specific agent via environment variable
export function getAgentModel(agentId: keyof typeof AGENT_MODELS): string {
  const envKey = `${agentId}_MODEL`;
  return process.env[envKey] || AGENT_MODELS[agentId].model;
}

// Helper to override temperature for a specific agent
export function getAgentTemperature(agentId: keyof typeof AGENT_MODELS): number {
  const envKey = `${agentId}_TEMPERATURE`;
  const envValue = process.env[envKey];
  return envValue ? parseFloat(envValue) : AGENT_MODELS[agentId].temperature;
}

// Helper to override max tokens for a specific agent
export function getAgentMaxTokens(agentId: keyof typeof AGENT_MODELS): number {
  const envKey = `${agentId}_MAX_TOKENS`;
  const envValue = process.env[envKey];
  return envValue ? parseInt(envValue, 10) : AGENT_MODELS[agentId].maxTokens;
}
