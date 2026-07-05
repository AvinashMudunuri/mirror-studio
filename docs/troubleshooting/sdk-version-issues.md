# SDK Version Issues - Resolved

## Problem
Getting `404 NOT FOUND` errors for all Claude models, even older ones like `claude-3-opus-20240229`.

## Root Cause
**Outdated Anthropic SDK** - The old SDK version didn't support newer Claude 4/5 models introduced in 2025-2026.

## Solution
Upgraded `@anthropic-ai/sdk` from an older version to `^0.32.1` (or latest).

```bash
cd packages/agents
npm install @anthropic-ai/sdk@latest
```

## How to Prevent
1. **Always check SDK version** when model names fail
2. **Use dynamic model detection** - The `npm run test:models` script now calls `client.models.list()` to fetch available models
3. **Keep SDK updated** - The `^` prefix in package.json will auto-update to compatible versions

## Available Models (as of July 2026)
Current API key has access to:
- `claude-sonnet-5` ⭐ (recommended - latest, most capable)
- `claude-fable-5`
- `claude-opus-4-8`
- `claude-opus-4-7`
- `claude-sonnet-4-6`
- `claude-opus-4-6`
- `claude-opus-4-5-20251101`
- `claude-haiku-4-5-20251001`
- `claude-sonnet-4-5-20250929`
- `claude-opus-4-1-20250805` (deprecated, EOL Aug 5, 2026)

## Current Configuration
All agents now use: **`claude-sonnet-5`**

## Testing
Run `npm run test:models` to dynamically check which models your API key can access.
