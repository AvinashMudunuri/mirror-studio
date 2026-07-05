# Phase 1: Building Content Agents - Instructions

## What We're Doing

Using the **Developer Agent** (AI that writes code) to build the **Story Architect Agent** (AI that creates story outlines).

**This is AI building AI!** 🤖→🤖

---

## Prerequisites

Before running the build script, ensure:

### 1. Docker Running ✅
```bash
docker-compose ps
```
Should show `mirror-postgres` and `mirror-redis` as "Up"

### 2. API Keys Configured ⚠️
```bash
# Check if keys exist
cat .env | grep API_KEY
```

If not set, add them:
```bash
# Edit .env
nano .env

# Add these lines:
ANTHROPIC_API_KEY=sk-ant-your-key-here
OPENAI_API_KEY=sk-your-key-here
```

**Where to get keys:**
- Anthropic (Claude): https://console.anthropic.com/
- OpenAI (GPT): https://platform.openai.com/api-keys

### 3. Dev Server Running ✅
```bash
npm run dev
```
Should show "Found 0 errors. Watching for file changes."

---

## How to Build Story Architect

### Step 1: Install script dependencies
```bash
npm install uuid @types/uuid tsx
```

### Step 2: Run the build script
```bash
npx tsx scripts/build-story-architect.ts
```

**What happens:**
1. ✅ Check prerequisites (API keys, Docker)
2. ✅ Initialize infrastructure (Message Bus, Memory, LLM Gateway)
3. ✅ Create Developer Agent
4. ✅ Load Story Architect specification
5. 🤖 **Developer Agent generates Story Architect code** (1-2 minutes)
6. ✅ Save generated code to `packages/agents/src/story-architect.ts`
7. ✅ Display explanation and next steps

### Step 3: Review generated code
```bash
# View the generated Story Architect
cat packages/agents/src/story-architect.ts
```

### Step 4: Test the Story Architect
```bash
# Build to check for TypeScript errors
npm run build

# If successful, the Story Architect is ready!
```

---

## Expected Output

```
🚀 Phase 1: Building Story Architect Agent

Checking prerequisites...
✅ Prerequisites checked

Initializing infrastructure...
✅ Infrastructure initialized

Creating Developer Agent...
✅ Developer Agent ready

Loading Story Architect specification...
✅ Specification loaded

🤖 Developer Agent: Building Story Architect...
   (This may take 1-2 minutes)

✅ Story Architect generated in 45.3s

Saving generated code...
   ✅ packages/agents/src/story-architect.ts

📝 Explanation:
[Developer Agent explains what it built]

✨ Next steps:
   1. Review generated code
   2. Test implementation
   3. Commit changes
```

---

## What Gets Generated

The Developer Agent will create:

**File**: `packages/agents/src/story-architect.ts`

**Contains**:
- `StoryArchitectAgent` class extending `BaseAgent`
- `StoryArchitectInput` interface
- `StoryArchitectOutput` interface
- Complete system prompt
- `execute()` method with story generation logic
- Helper methods for:
  - Scene generation
  - Choice point design
  - Branch logic
  - Trait mapping
  - Emotional arc design

---

## If Something Goes Wrong

### Error: "No API keys found"
- Add `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` to `.env`
- Restart the dev server

### Error: "DATABASE_URL not found"
- Check Docker: `docker-compose ps`
- Start if needed: `docker-compose up -d`

### Error: "Cannot find module"
- Install dependencies: `npm install`
- Rebuild packages: `npm run build`

### Generated code has TypeScript errors
- Review the errors
- Either:
  - Fix manually
  - Ask Developer Agent to refine
  - Re-run with clearer specification

---

## After Generation

### Review Checklist

- [ ] TypeScript compiles without errors
- [ ] Input/Output schemas match specification
- [ ] System prompt is comprehensive
- [ ] execute() method has clear logic
- [ ] Helper methods are well-structured
- [ ] Code follows our standards (from Constitution)

### Testing

```typescript
// Example test (manual for now)
const storyArchitect = new StoryArchitectAgent();
await storyArchitect.initialize({ workflowId, threadId, messageBus, memory, llm });

const outline = await storyArchitect.process({
  type: 'NEW_EPISODE',
  brief: {
    world: 'NEW_SCHOOL',
    season: 'Season 1',
    episodeNumber: 3,
    themes: ['Belonging', 'Integrity'],
    targetTraits: ['EMPATHY', 'CONFIDENCE'],
    characters: [/* ... */]
  }
});

console.log('Generated outline:', outline);
```

### Integration

Once validated:
1. Export from `packages/agents/src/index.ts`
2. Add to agent registry
3. Update documentation
4. Commit to git

---

## Next Agents

After Story Architect:
1. **Character Designer** (Kai) - Similar process
2. **Dialogue Writer** (Echo) - Similar process
3. **Creative Director** (Aria) - Similar process

---

## The Meta-Loop

**Phase 0**: Human builds Developer Agent  
**Phase 1**: Developer Agent builds Story Architect  
**Phase 2**: Developer Agent builds more agents  
**Phase 3**: Story Architect creates content  
**Phase N**: System self-improves

**We're building the bootstrap!** 🚀

---

## Cost Estimate

**Per agent generation:**
- Input tokens: ~5,000 (specification)
- Output tokens: ~3,000 (generated code)
- Cost: ~$0.10-0.30 per agent (Claude Sonnet 4.5)

**Total for 4 agents:** ~$0.40-1.20

Very affordable for the capability gained!

---

## Questions?

If you encounter issues or have questions about the generated code:
1. Check the Developer Agent's explanation
2. Review the specification
3. Re-run with more detailed spec
4. Manually refine if needed

**Remember**: Developer Agent accelerates development, but human oversight remains important in Phase 1.

---

**Ready to build? Run the script!** 🚀

```bash
npx tsx scripts/build-story-architect.ts
```
