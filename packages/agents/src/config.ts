/**
 * Central configuration for AI agents
 * All model settings, API keys, and agent-specific configs are defined here
 */

// LLM Provider Configuration
export const LLM_CONFIG = {
  // Default models for each provider
  defaultModels: {
    anthropic: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
    openai: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
  },
  
  // API Keys (read from environment)
  apiKeys: {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
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
  },
} as const;

// Agent-specific configurations
export const AGENT_MODELS = {
  // Content Creation Agents
  STORY_ARCHITECT: {
    model: LLM_CONFIG.defaultModels.anthropic,
    temperature: LLM_CONFIG.temperatures.creative,
    maxTokens: LLM_CONFIG.maxTokens.large,
  },
  
  CHARACTER_DESIGNER: {
    model: LLM_CONFIG.defaultModels.anthropic,
    temperature: LLM_CONFIG.temperatures.balanced,
    maxTokens: LLM_CONFIG.maxTokens.medium,
  },
  
  DIALOGUE_WRITER: {
    model: LLM_CONFIG.defaultModels.anthropic,
    temperature: LLM_CONFIG.temperatures.creative,
    maxTokens: LLM_CONFIG.maxTokens.large,
  },
  
  CREATIVE_DIRECTOR: {
    model: LLM_CONFIG.defaultModels.anthropic,
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
  
  // Validation Agents
  QA_REVIEWER: {
    model: LLM_CONFIG.defaultModels.anthropic,
    temperature: 0.2, // Very low for deterministic validation
    maxTokens: LLM_CONFIG.maxTokens.medium,
  },
  
  CHILD_PSYCHOLOGIST: {
    model: LLM_CONFIG.defaultModels.anthropic,
    temperature: 0.5, // Balanced - needs consistency but also nuanced judgment
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
