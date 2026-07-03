# @mirror/schemas

Core type definitions and schemas for Project MIRROR Studio.

## Overview

This package contains all TypeScript types and Zod schemas used across the platform:

- **Agent Types**: Message formats, agent IDs, communication protocols
- **Story Types**: Episodes, scenes, dialogue, choices, worlds
- **Character Types**: Character profiles, relationships, personality
- **Trait Types**: Emotional intelligence traits and mappings
- **Player Types**: Player profiles, progress, achievements
- **Analytics Types**: Engagement metrics, performance data
- **Memory Types**: Memory scopes and entries for agent learning
- **Workflow Types**: Orchestration and state management

## Usage

```typescript
import { 
  Episode, 
  Character, 
  AgentMessage,
  TraitProfile 
} from '@mirror/schemas';

// Validate data against schema
import { EpisodeSchema } from '@mirror/schemas';

const result = EpisodeSchema.safeParse(episodeData);
if (result.success) {
  const episode: Episode = result.data;
}
```

## Schema Philosophy

1. **Type Safety**: All data structures validated at runtime with Zod
2. **Documentation**: Schemas serve as living documentation
3. **Consistency**: Single source of truth for data structures
4. **Validation**: Built-in validation ensures data integrity

## Key Schemas

### Episode Schema
Complete episode structure including scenes, choices, dialogue, and metadata.

### Character Schema
Full character profile with personality, background, relationships, and voice guidelines.

### Agent Message Schema
Inter-agent communication format with priority, payload, and threading.

### Trait Profile Schema
Player's emotional intelligence profile tracking growth over time.

## Building

```bash
npm run build
```

## Development

```bash
npm run dev  # Watch mode
```
