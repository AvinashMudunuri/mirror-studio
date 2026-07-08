# @mirror/agents

AI Agent framework and implementations for Project MIRROR Studio.

## Overview

This package provides the core agent framework and specific agent implementations for the autonomous AI studio system.

### What's Included

**Base Framework**:
- `BaseAgent` - Abstract base class all agents extend
- `LLMGateway` - Unified interface for Claude and GPT, with Claude callable
  via either the direct Anthropic API or AWS Bedrock (see "Claude backend"
  below)
- Agent lifecycle management
- Message handling
- Memory integration

**Agent Implementations**:
- `CEOAgent` - Strategic oversight and final approval
- `DeveloperAgent` - **Writes code autonomously!**
- More agents coming in Phase 2+

## Key Concept: Developer Agent

The **DeveloperAgent** is special - it's an AI agent that writes code. This enables the system to build itself progressively:

1. Human builds foundation (message bus, memory, first agent)
2. Developer Agent helps build more agents
3. Agent system becomes increasingly autonomous
4. Eventually: full self-improvement capability

## Usage

### Creating an Agent

```typescript
import { DeveloperAgent } from '@mirror/agents';
import { createMessageBus } from '@mirror/message-bus';
import { createMemorySystem } from '@mirror/memory';
import { createLLMGateway } from '@mirror/agents';

// Initialize infrastructure
const messageBus = await createMessageBus({ redisUrl: process.env.REDIS_URL });
const memory = createMemorySystem({ databaseUrl: process.env.DATABASE_URL, openaiApiKey: process.env.OPENAI_API_KEY });
const llm = createLLMGateway({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY
});

// Create agent
const developer = new DeveloperAgent();

// Initialize with context
await developer.initialize({
  workflowId: 'workflow-123',
  threadId: 'thread-456',
  messageBus,
  memory,
  llm
});

// Use the agent
const result = await developer.process({
  type: 'IMPLEMENT_FEATURE',
  requirement: 'Add endpoint for player progress tracking',
  context: {
    existingCode: '// current API code...',
    constraints: ['Must be RESTful', 'Must include authentication']
  }
});

console.log('Generated files:', result.files);
console.log('Explanation:', result.explanation);
```

### Claude backend: Anthropic API or AWS Bedrock

`LLMGateway` calls Claude through one of two backends, selected by
`claudeBackend` (or the `CLAUDE_BACKEND` env var, read by `LLM_CONFIG` in
`config.ts`):

- **`'anthropic'`** (default) — calls the Anthropic API directly using
  `anthropicApiKey` (`ANTHROPIC_API_KEY`).
- **`'bedrock'`** — calls the same Claude models via AWS Bedrock, using AWS
  credentials instead of an Anthropic API key. By default this uses the
  standard AWS credential provider chain (env vars, `~/.aws/credentials`,
  or an IAM role); pass `bedrock: { region, accessKeyId, secretAccessKey,
  sessionToken }` to `createLLMGateway` only if you need to override that.

```typescript
const llm = createLLMGateway({
  claudeBackend: 'bedrock', // or process.env.CLAUDE_BACKEND
  // anthropicApiKey is not needed for the bedrock backend
  openaiApiKey: process.env.OPENAI_API_KEY
});
```

**Model IDs are NOT interchangeable between backends.** The direct API's
`claude-sonnet-5` is a different string than its Bedrock equivalent (e.g.
`us.anthropic.claude-sonnet-5`, or another cross-region inference-profile ID
depending on account/region). When using `bedrock`, set `ANTHROPIC_MODEL` /
`ANTHROPIC_REVIEW_MODEL` / any `<AGENT>_MODEL` override to the Bedrock ID for
your account and region — look these up in the AWS Bedrock console rather
than guessing.

Everything else — adaptive thinking, prompt caching (`cache_control`), retry/
truncation handling, token usage accounting — works the same way on both
backends, since `AnthropicBedrock.messages.create()` accepts the same request
shape and returns the same response shape as the direct client for the
non-streaming calls this gateway makes. See
`docs/decisions/004-aws-bedrock-alternative-backend.md` for the full
rationale and caveats.

### Developer Agent Capabilities

The Developer Agent can:

**Write New Agents**:
```typescript
await developer.process({
  type: 'WRITE_AGENT',
  agentSpec: {
    id: 'STORY_ARCHITECT',
    name: 'River',
    role: 'Story Structure Designer',
    mission: 'Create engaging episode outlines',
    expertise: ['Story structure', 'Choice architecture', 'Pacing'],
    responsibilities: [
      'Design episode outlines',
      'Create choice points',
      'Map traits to choices'
    ]
  }
});
```

**Implement Features**:
```typescript
await developer.process({
  type: 'IMPLEMENT_FEATURE',
  requirement: 'Add semantic search to memory system',
  context: {
    existingCode: readFileSync('packages/memory/src/index.ts', 'utf-8'),
    constraints: ['Use pgvector', 'Support threshold filtering']
  }
});
```

**Fix Bugs**:
```typescript
await developer.process({
  type: 'FIX_BUG',
  requirement: 'Agent messages not persisting to database',
  context: {
    existingCode: buggyCode,
    relatedFiles: ['message-bus/src/index.ts']
  }
});
```

**Refactor Code**:
```typescript
await developer.process({
  type: 'REFACTOR',
  requirement: 'Extract common validation logic',
  context: { existingCode: currentCode }
});
```

**Review Code**:
```typescript
await developer.process({
  type: 'REVIEW_CODE',
  context: { existingCode: prCode }
});
```

## Agent Communication

Agents communicate via the message bus:

```typescript
// Request work from another agent
await agent.request('STORY_ARCHITECT', {
  action: 'CREATE_EPISODE',
  world: 'NEW_SCHOOL',
  episode: 3
});

// Challenge another agent's output
await agent.challenge(
  'STORY_ARCHITECT',
  originalMessageId,
  { issue: 'Plot hole in scene 3' },
  'The character motivation contradicts earlier scenes'
);

// Approve work
await agent.approve('DIALOGUE_WRITER', messageId);
```

## Agent Memory

Agents can remember context and learn:

```typescript
// Store in memory
await agent.remember('successful_pattern', {
  type: 'character_arc',
  pattern: 'reluctant_hero',
  success_rate: 0.85
});

// Recall from memory
const pattern = await agent.recall('successful_pattern');

// Semantic search
const similar = await agent.search('character development patterns');
```

## LLM Integration

All agents have access to LLMs:

```typescript
const response = await agent.callLLM(
  systemPrompt, // Agent's role and context
  userPrompt,   // Specific task
  {
    model: 'claude-sonnet-4.5',
    temperature: 0.3,
    maxTokens: 4096
  }
);
```

## Creating Custom Agents

Extend `BaseAgent` to create new agents:

```typescript
import { BaseAgent, AgentConfig } from '@mirror/agents';

interface MyAgentInput {
  task: string;
  context?: any;
}

interface MyAgentOutput {
  result: string;
  confidence: number;
}

export class MyAgent extends BaseAgent {
  constructor() {
    super({
      id: 'MY_AGENT',
      name: 'My Agent Name',
      role: 'What this agent does',
      model: 'claude-sonnet-4.5',
      temperature: 0.3,
      maxTokens: 4096
    });
  }

  protected async execute(input: MyAgentInput): Promise<MyAgentOutput> {
    // 1. Understand the input
    // 2. Retrieve relevant context from memory
    const context = await this.recall('relevant_context');

    // 3. Call LLM with system and user prompts
    const systemPrompt = `You are ${this.config.name}...`;
    const userPrompt = `Task: ${input.task}`;
    const response = await this.callLLM(systemPrompt, userPrompt);

    // 4. Store results in memory
    await this.remember('last_result', response);

    // 5. Return structured output
    return {
      result: response,
      confidence: 0.9
    };
  }
}
```

## Testing

```bash
npm run test
```

## Building

```bash
npm run build
```

## Philosophy

Agents in this system are:
- **Autonomous**: Make decisions without human approval
- **Collaborative**: Work together via message passing
- **Learning**: Improve from feedback and patterns
- **Specialized**: Each has specific expertise
- **Accountable**: All decisions logged and traceable

## Next Steps

Phase 0 (Bootstrap): ✅
- Message bus, memory, LLM gateway, base agent, Developer Agent

Phase 1 (Core Agents):
- Story Architect
- Character Designer
- Dialogue Writer
- Creative Director

Phase 2 (Quality Council):
- Child Psychologist
- Game Designer
- Ethics Reviewer
- QA Reviewer

Phase 3 (Production):
- Publisher
- Analytics Agent
- Monitoring Agent

---

**The Developer Agent is the seed. Watch it grow.** 🌱
