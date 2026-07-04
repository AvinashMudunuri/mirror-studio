# Integration Tests and Sample Episode

This directory contains integration tests and sample episode creation workflows for Phase 1 agents.

## Integration Tests

Located in `tests/integration/phase-1-agents.test.ts`

Tests verify:
- Agent initialization
- Memory system integration
- LLM gateway configuration
- Agent type compatibility

### Running Integration Tests

```bash
# Run all tests
npm test

# Run only integration tests
npm run test:integration
```

**Note**: Basic tests run without API keys (they test initialization only). For full integration tests with LLM calls, set environment variables:

```bash
export ANTHROPIC_API_KEY="your-key-here"
# OR
export OPENAI_API_KEY="your-key-here"

npm run test:integration
```

## Sample Episode Creation

Located in `scripts/create-sample-episode.ts`

Creates a complete sample episode using all 4 Phase 1 agents:
1. Story Architect creates episode outline
2. Character Designer creates protagonist and supporting characters
3. Dialogue Writer writes authentic dialogue
4. Creative Director reviews the episode

### Running Sample Episode Creation

**Prerequisites**:
- Docker running (PostgreSQL + Redis)
- API key set (Anthropic or OpenAI)

```bash
# Set your API key
export ANTHROPIC_API_KEY="your-key-here"
# OR
export OPENAI_API_KEY="your-key-here"

# Create sample episode
npm run sample:episode
```

### Output

The sample episode creation workflow generates JSON files in `output/sample-episode/`:

1. `01-story-outline.json` - Episode structure from Story Architect
2. `02-protagonist.json` - Main character from Character Designer
3. `03-supporting-character.json` - Supporting character from Character Designer
4. `04-dialogue.json` - Complete dialogue from Dialogue Writer
5. `05-creative-review.json` - Quality review from Creative Director

## Environment Variables

```bash
# LLM Provider (required for sample episode, optional for tests)
ANTHROPIC_API_KEY="your-anthropic-api-key"
OPENAI_API_KEY="your-openai-api-key"

# Infrastructure (defaults to localhost)
POSTGRES_HOST="localhost"
POSTGRES_PORT="5432"
POSTGRES_DB="mirror_studio"
POSTGRES_USER="mirror_user"
POSTGRES_PASSWORD="mirror_pass"

REDIS_HOST="localhost"
REDIS_PORT="6379"
```

## Expected Runtime

- **Integration Tests** (without API keys): ~5 seconds
- **Integration Tests** (with API keys): ~30-60 seconds
- **Sample Episode Creation**: ~3-5 minutes (includes multiple LLM calls)
