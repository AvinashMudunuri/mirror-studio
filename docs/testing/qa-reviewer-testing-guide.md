# QA Reviewer Testing Guide

## What Was Built

The **QA Reviewer agent (Alex)** has been fully implemented and integrated into the episode creation pipeline. This is the first Phase 2 validation agent!

### Features Implemented

1. **Full QA Reviewer Agent** (`packages/agents/src/qa-reviewer.ts`)
   - Schema validation (required fields, data types)
   - ID consistency checking (unique IDs, valid references)
   - Branching logic validation (no dead ends, reachable scenes)
   - Character consistency checks (names, pronouns)
   - Trait mechanics validation (reasonable changes, proper mapping)
   - Completeness checks (all required content present)
   - Metadata accuracy validation

2. **Configuration** (`packages/agents/src/config.ts`)
   - Added `QA_REVIEWER` with temperature=0.2 (deterministic validation)
   - Uses `claude-sonnet-5` model
   - Medium token limit (4096 tokens)

3. **Pipeline Integration** (`scripts/create-real-episode.js`)
   - QA Reviewer runs as Step 6 (after Creative Director)
   - Displays errors, warnings, and check summary
   - Saves results to `output/real-episode/05-qa-review.json`

## How to Test

### Prerequisites
- Your Anthropic API key
- Episodes generated from Phase 1 agents

### Test Command

```bash
export ANTHROPIC_API_KEY="your-api-key-here"
npm run real:episode
```

### Expected Output

The script will run 5 agents in sequence:

1. **Story Architect** → Creates episode outline (~84s)
2. **Character Designer** → Creates protagonist (~32s)
3. **Dialogue Writer** → Writes scene dialogue (~92s)
4. **Creative Director** → Reviews for creative quality (~23s)
5. **QA Reviewer** → Validates technical quality (~10-20s)

### QA Reviewer Output Format

```
🔍 Step 6: QA Reviewer - Technical Quality Check

   Status: PASS or FAIL
   Errors: 0-N blocking issues
   Warnings: 0-N concerns
   Checks: X/Y passed

   ❌ Issues found: (if any)
      • [BLOCKER] Description of issue
        Location: exact.path.to.issue
        Fix: How to fix it

   💾 Saved: output/real-episode/05-qa-review.json
```

## Test Scenarios

### Scenario 1: Clean Episode (Expected: PASS)
Run the default script with `npm run real:episode`. The QA Reviewer should find minimal issues since the Phase 1 agents generate well-structured content.

**Expected result**: `Status: PASS` with 0 errors, possibly some style warnings

### Scenario 2: Broken Episode (Expected: FAIL)
Create a test episode with known issues:

```javascript
// In create-real-episode.js, add intentional errors:
const brokenEpisode = {
  // Missing required field 'id'
  worldId: 'TEST',
  // Invalid status enum
  status: 'INVALID_STATUS',
  // Reference to non-existent character
  scenes: [{
    id: 'scene-1',
    characters: ['non-existent-character']
  }]
};
```

**Expected result**: `Status: FAIL` with multiple errors:
- `[BLOCKER] Missing required field: id`
- `[BLOCKER] Invalid enum value for status`
- `[BLOCKER] Character reference not found: non-existent-character`

### Scenario 3: Character Review
Test character validation separately (requires modifying script to call `REVIEW_CHARACTER` task).

### Scenario 4: World Review
Test world validation (requires modifying script to call `REVIEW_WORLD` task).

## Validation Categories

The QA Reviewer checks 7 main categories:

1. **Schema Compliance** - Required fields, data types, enum values
2. **ID Integrity** - Unique IDs, valid references
3. **Branching Logic** - Reachable scenes, valid paths
4. **Character Consistency** - Names, pronouns, references
5. **Trait Mechanics** - Reasonable changes, proper mapping
6. **Completeness** - All required content present
7. **Metadata Accuracy** - Play time, episode numbers

## Output Files

After running `npm run real:episode`, check:

```
output/real-episode/
├── 01-story-outline.json      (Story Architect)
├── 02-protagonist.json        (Character Designer)
├── 03-dialogue.json           (Dialogue Writer)
├── 04-creative-review.json    (Creative Director)
└── 05-qa-review.json          (QA Reviewer) ← NEW!
```

### Sample `05-qa-review.json`:

```json
{
  "status": "PASS",
  "errors": [],
  "warnings": [
    {
      "category": "BEST_PRACTICE",
      "message": "Scene duration seems short",
      "location": "scenes[0].duration",
      "suggestion": "Consider 2-3 minutes for opening scene"
    }
  ],
  "summary": {
    "totalChecks": 47,
    "passedChecks": 47,
    "failedChecks": 0,
    "warningCount": 1
  },
  "recommendations": [
    "Consider adding more variety to trait changes"
  ]
}
```

## Known Limitations

1. **LLM-based validation**: Some checks depend on Claude's interpretation, so results may vary slightly between runs
2. **Simplified episode structure**: Current test uses a minimal episode object; full validation requires complete episode data
3. **No automated fixes**: QA Reviewer identifies issues but doesn't automatically fix them (that's for future iterations)

## Next Steps

After successful testing:

1. **Create more test cases** with intentional errors
2. **Add unit tests** for specific validation rules
3. **Implement automated fixes** for common issues (optional enhancement)
4. **Add rule-based validation** for deterministic checks (complement LLM validation)

## Troubleshooting

### Issue: "ANTHROPIC_API_KEY not set"
**Fix**: Export your API key before running the script

### Issue: "No JSON found in response"
**Cause**: LLM returned only thinking blocks or malformed JSON  
**Fix**: Check logs for full response, consider adjusting prompt

### Issue: "Status: FAIL" on clean episodes
**Cause**: QA Reviewer may be too strict or found actual issues  
**Fix**: Review the error messages - they might be catching real problems!

## Success Criteria

✅ **Minimum (Must Have)**:
- [x] QA Reviewer agent implemented
- [x] Integrated into pipeline
- [ ] Successfully runs with API key
- [ ] Catches schema violations
- [ ] Catches ID inconsistencies
- [ ] Provides actionable error messages

🎯 **Target (Should Have)**:
- [ ] Zero false positives on clean episodes
- [ ] Catches 95%+ of real issues
- [ ] Review completes in < 15 seconds
- [ ] Clear, helpful error messages

🌟 **Stretch (Nice to Have)**:
- [ ] Automated fix suggestions applied
- [ ] Rule-based validation for speed
- [ ] Custom validation rules per world
- [ ] VS Code extension integration

## Questions to Answer During Testing

1. **Accuracy**: Does it catch all the issues you expect?
2. **False positives**: Does it flag valid content as errors?
3. **Performance**: How long does validation take?
4. **Clarity**: Are error messages clear and actionable?
5. **Usefulness**: Does it improve content quality?

---

**Status**: ✅ Implementation Complete | 🧪 Testing Required | 📝 Documentation Complete

**Next Agent**: After QA Reviewer testing passes, we can build the next Phase 2 agent (Child Psychologist, Game Designer, or Ethics Reviewer).
