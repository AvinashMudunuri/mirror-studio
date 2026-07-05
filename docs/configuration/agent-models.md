# Agent Configuration Guide

All AI agent model settings are now centrally configured in `/packages/agents/src/config.ts`.

## Quick Start

### Default Configuration

All agents use **`claude-sonnet-5`** by default (as of July 2026).

No configuration needed - just set your API key:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
npm run real:episode
```

### Change Model for All Agents

Set the `ANTHROPIC_MODEL` environment variable:

```bash
# Use Claude Opus 4.8 for all agents
export ANTHROPIC_MODEL="claude-opus-4-8"
npm run real:episode
```

### Change Model for Specific Agent

Override individual agents using `{AGENT_ID}_MODEL`:

```bash
# Story Architect uses Opus, others use default Sonnet
export STORY_ARCHITECT_MODEL="claude-opus-4-8"
npm run real:episode
```

Available agent IDs:
- `STORY_ARCHITECT` - River (episode structure)
- `CHARACTER_DESIGNER` - Kai (characters)
- `DIALOGUE_WRITER` - Echo (dialogue)
- `CREATIVE_DIRECTOR` - Aria (quality review)
- `CEO_AGENT` - Morgan (strategic decisions)
- `DEVELOPER_AGENT` - Dev (code generation)

## Advanced Configuration

### Temperature Control

Adjust creativity/consistency per agent:

```bash
# Make dialogue more creative (default: 0.8)
export DIALOGUE_WRITER_TEMPERATURE="0.9"

# Make developer agent more deterministic (default: 0.3)
export DEVELOPER_AGENT_TEMPERATURE="0.1"
```

**Note for Claude 5+ models:** Temperature values are automatically mapped to Claude's `effort` parameter:
- **Low effort** (0.0 - 0.3): Deterministic, consistent outputs
- **Medium effort** (0.4 - 0.6): Balanced reasoning
- **High effort** (0.7 - 1.0): Creative, exploratory outputs

Default temperatures by role:
- **Creative** (0.8 → high effort): Story Architect, Dialogue Writer
- **Balanced** (0.6 → medium effort): Character Designer, Creative Director, CEO
- **Analytical** (0.3 → low effort): Developer Agent

### Token Limits

Adjust response length:

```bash
# Allow longer episode structures (default: 8192)
export STORY_ARCHITECT_MAX_TOKENS="12000"

# Shorter character descriptions (default: 4096)
export CHARACTER_DESIGNER_MAX_TOKENS="2048"
```

Default max tokens:
- **Small** (2048): Simple responses
- **Medium** (4096): Standard tasks
- **Large** (8192): Complex generation

## Available Models (July 2026)

Run `npm run test:models` to see which models your API key has access to.

Current Claude models:
- `claude-sonnet-5` ⭐ (recommended - latest, balanced)
- `claude-fable-5` (experimental)
- `claude-opus-4-8` (most capable, expensive)
- `claude-opus-4-7`
- `claude-sonnet-4-6`
- `claude-haiku-4-5-20251001` (fast, cost-effective)

## Example: Production Setup

```bash
# .env.production
ANTHROPIC_API_KEY="sk-ant-..."

# Use Opus for creative work, Sonnet for review
STORY_ARCHITECT_MODEL="claude-opus-4-8"
DIALOGUE_WRITER_MODEL="claude-opus-4-8"
CREATIVE_DIRECTOR_MODEL="claude-sonnet-5"

# Fine-tune temperatures
STORY_ARCHITECT_TEMPERATURE="0.85"  # More creative
CREATIVE_DIRECTOR_TEMPERATURE="0.5"  # More consistent

# Increase token limits for complex episodes
STORY_ARCHITECT_MAX_TOKENS="10000"
```

## Example: Development Setup

```bash
# .env.development
ANTHROPIC_API_KEY="sk-ant-..."

# Use faster/cheaper Haiku for testing
ANTHROPIC_MODEL="claude-haiku-4-5-20251001"

# Lower temperatures for consistent test results
STORY_ARCHITECT_TEMPERATURE="0.3"
DIALOGUE_WRITER_TEMPERATURE="0.3"

# Shorter outputs for faster iteration
STORY_ARCHITECT_MAX_TOKENS="4096"
```

## Programmatic Access

Import config helpers in your code:

```typescript
import { 
  LLM_CONFIG, 
  AGENT_MODELS,
  getAgentModel,
  getAgentTemperature,
  getAgentMaxTokens
} from '@mirror/agents';

// Get current model for an agent
const model = getAgentModel('STORY_ARCHITECT');
console.log(model); // 'claude-sonnet-5' (or env override)

// Access default configs
console.log(LLM_CONFIG.defaultModels.anthropic); // 'claude-sonnet-5'
console.log(AGENT_MODELS.STORY_ARCHITECT); // { model, temperature, maxTokens }
```

## Troubleshooting

### Model not found (404 error)

1. Run `npm run test:models` to see available models
2. Check your API key has access to the model
3. Verify SDK version: `npm list @anthropic-ai/sdk` (should be 0.32.1+)
4. Update SDK: `cd packages/agents && npm install @anthropic-ai/sdk@latest`

### Wrong model being used

1. Check environment variables: `env | grep MODEL`
2. Verify `.env` file is loaded
3. Check for typos in agent ID (use exact names from config.ts)

## Migration from Hardcoded Models

**Before (bad):**
```typescript
const config = {
  model: 'claude-3-opus-20240229', // Hardcoded, stale
  temperature: 0.7
};
```

**After (good):**
```typescript
import { getAgentModel, getAgentTemperature } from './config';

const config = {
  model: getAgentModel('STORY_ARCHITECT'),
  temperature: getAgentTemperature('STORY_ARCHITECT')
};
```

All agents now use this pattern automatically.
