# Phase 1: Core Content Agents

**Status**: 🚧 In Progress  
**Started**: July 4, 2026  
**Goal**: Build autonomous content-creation agents using Developer Agent

---

## Overview

Use the **Developer Agent** (built in Phase 0) to help build the content-creation agents. This demonstrates the meta-capability: AI building AI.

---

## Agents to Build (Priority Order)

### 1. Story Architect (River) - 🚧 In Progress
**Priority**: HIGHEST (foundation for all episodes)

**Mission**: Design emotionally engaging story structures with meaningful choices

**Key Responsibilities**:
- Create episode outlines with scene-by-scene breakdown
- Design choice points that feel natural
- Map story beats to trait-development opportunities
- Ensure replayability through divergent paths
- Balance educational goals with engagement

**Input**: Episode brief (world, themes, characters, target traits)  
**Output**: Complete episode outline with scenes, choices, branches

**SLA**: 6 hours for new episode, 3 hours for revision

---

### 2. Character Designer (Kai)
**Priority**: HIGH (needed for Story Architect output)

**Mission**: Create authentic, memorable characters

**Key Responsibilities**:
- Design character profiles with depth
- Maintain character consistency
- Create relationship dynamics
- Design character arcs
- Ensure diverse representation

---

### 3. Dialogue Writer (Echo)
**Priority**: HIGH (converts outlines to playable content)

**Mission**: Write authentic teen dialogue

**Key Responsibilities**:
- Write all dialogue for episodes
- Ensure distinct character voices
- Layer subtext into conversations
- Make choices feel natural
- Maintain voice consistency

---

### 4. Creative Director (Aria)
**Priority**: MEDIUM (quality oversight)

**Mission**: Maintain creative excellence

**Key Responsibilities**:
- Define creative direction per season
- Ensure tonal consistency
- Review all creative output
- Challenge derivative work
- Maintain world bibles

---

## Implementation Approach

### For Each Agent:

**Step 1: Extract Specification**
- Pull from AI Studio Handbook
- Define Input/Output schemas
- Write system prompt
- Document responsibilities

**Step 2: Generate Implementation (Developer Agent)**
```typescript
await developerAgent.process({
  type: 'WRITE_AGENT',
  agentSpec: {
    id: 'STORY_ARCHITECT',
    name: 'River',
    role: 'Story Structure Designer',
    mission: '...',
    expertise: ['...'],
    responsibilities: ['...']
  }
});
```

**Step 3: Review & Refine**
- Check TypeScript quality
- Verify logic correctness
- Test with sample input
- Iterate if needed

**Step 4: Integrate & Test**
- Add to package exports
- Create test workflow
- Verify message passing
- Check memory integration

**Step 5: Validate End-to-End**
- Run agent in workflow
- Check output quality
- Verify LLM integration

---

## Success Criteria

Phase 1 is complete when:
- [ ] All 4 agents implemented
- [ ] All agents compile without errors
- [ ] Can generate episode outline end-to-end
- [ ] CEO → Story Architect → Character Designer → Dialogue Writer workflow works
- [ ] Output is structured JSON
- [ ] Quality meets Handbook standards

---

## Deliverable

**Working Content Pipeline**:
```
CEO Agent
  ↓ (assigns episode task)
Story Architect
  ↓ (creates outline)
Character Designer
  ↓ (designs characters)
Dialogue Writer
  ↓ (writes dialogue)
Creative Director
  ↓ (reviews quality)
CEO Agent
  ↓ (final approval)
Publisher
  ↓ (deploys to production)
```

**Result**: First complete episode outline generated autonomously

---

## Timeline

**Week 1** (Days 1-4):
- Day 1: Story Architect specification & generation
- Day 2: Story Architect testing & refinement
- Day 3: Character Designer specification & generation
- Day 4: Character Designer testing & refinement

**Week 2** (Days 5-7):
- Day 5: Dialogue Writer specification & generation
- Day 6: Creative Director specification & generation
- Day 7: End-to-end workflow integration & testing

**Total**: 1 week (7 days)

---

## Current Progress

### Story Architect (River) - Day 1

**Status**: Extracting specification from Handbook

**Next Steps**:
1. Create detailed agent specification
2. Use Developer Agent to generate implementation
3. Review generated code
4. Test with sample input
5. Iterate until quality acceptable

---

## Notes

- Developer Agent accelerates development significantly
- Each agent takes ~1 day vs. ~3 days if written manually
- Quality of generated code depends on specification clarity
- Iteration is expected and normal
- Human oversight remains important in Phase 1

---

**Let's build!** 🚀
