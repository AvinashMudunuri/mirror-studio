#!/usr/bin/env node

/**
 * Real Episode Creation Pipeline
 *
 * Sequential agent pipeline (no Docker required):
 *   Story Architect → Character Designer (protagonist + full NPC roster)
 *   → Dialogue Writer → 5 reviewers → bounded revision loop.
 *
 * Reviewer verdicts drive revisions: story-level feedback goes to the
 * Story Architect's REVISION_REQUEST input, dialogue-level feedback to the
 * Dialogue Writer's REVISE_DIALOGUE input, then only the previously failing
 * reviewers re-review. Bounded by MAX_REVISION_ITERATIONS.
 */

const path = require('path');
const fs = require('fs');

const {
  collectSupportingCharacterIds,
  describeAppearances,
  activeRoster,
  failingReviewers,
  collectRevisionFeedback,
  mergeSceneDialogue,
  mergeChoiceDialogue,
  mergeBranchDialogue
} = require('./lib/pipeline-helpers');

// Import from built packages (resolve from script location)
const packageRoot = path.resolve(__dirname, '..');

// Try multiple paths for different environments (GitHub Codespaces vs local)
let agentsModule;
const possiblePaths = [
  path.join(packageRoot, 'packages', 'agents', 'dist', 'index.js'),
  path.join(packageRoot, '..', 'packages', 'agents', 'dist', 'index.js')
];

// Try require.resolve as last resort
try {
  possiblePaths.push(require.resolve('@mirror/agents'));
} catch (e) {
  // @mirror/agents not in node_modules, skip
}

for (const tryPath of possiblePaths) {
  try {
    if (fs.existsSync(tryPath)) {
      agentsModule = require(tryPath);
      console.log(`✅ Loaded agents from: ${tryPath}\n`);
      break;
    }
  } catch (err) {
    console.error(`   Failed to load ${tryPath}: ${err.message}`);
    // Try next path
  }
}

if (!agentsModule) {
  console.error('❌ Error: Could not load @mirror/agents package');
  console.error('   Tried paths:');
  possiblePaths.forEach(p => {
    const exists = fs.existsSync(p);
    console.error(`   - ${p} ${exists ? '(exists)' : '(not found)'}`);
  });
  console.error('\n💡 Tip: Run "npm run build" first to compile TypeScript files.\n');
  process.exit(1);
}

const {
  StoryArchitectAgent,
  CharacterDesignerAgent,
  DialogueWriterAgent,
  CreativeDirectorAgent,
  QAReviewerAgent,
  ChildPsychologistAgent,
  GameDesignerAgent,
  EthicsReviewerAgent,
  createLLMGateway
} = agentsModule;

const { v4: uuidv4 } = require('uuid');

// ============================================================================
// Configuration
// ============================================================================

const EPISODE_BRIEF = {
  world: 'New School',
  worldId: 'NEW_SCHOOL',
  season: 'Season 1: First Year',
  episodeNumber: 1,
  title: 'First Day',
  themes: ['Belonging', 'Authenticity', 'First Impressions'],
  targetTraits: ['CONFIDENCE', 'EMPATHY', 'ADAPTABILITY'],
  synopsis: 'Alex starts their first day at a new middle school after moving to a new city. They must navigate unfamiliar hallways, make new friends, and decide how much of their true self to show.'
};

const TEST_WORLD = {
  id: 'NEW_SCHOOL',
  name: 'New School',
  description: 'A contemporary middle school setting where students navigate friendships, identity, and growing up',
  setting: 'Contemporary middle school in a diverse urban community',
  tone: 'Grounded realism with moments of humor and warmth',
  themes: ['Belonging', 'Authenticity', 'Friendship', 'Identity'],
  targetAge: [11, 14],
  seasons: ['Season 1: First Year']
};

/** How many revise → re-review rounds to attempt before accepting the result. */
const MAX_REVISION_ITERATIONS = 2;

/**
 * Hard token budget for the whole run (input + output, all calls).
 * When exhausted, the pipeline stops instead of spending further and the
 * manifest records BUDGET_EXCEEDED. Override with MAX_RUN_TOKENS; set to
 * 0 to disable the bound. Default sized from live runs: a full run with
 * 2 revision iterations used roughly 400-600k tokens.
 */
const MAX_RUN_TOKENS = process.env.MAX_RUN_TOKENS !== undefined
  ? parseInt(process.env.MAX_RUN_TOKENS, 10)
  : 800000;

/**
 * Reviewers to skip, comma-separated manifest keys
 * (e.g. SKIP_REVIEWERS=childPsychologist,gameDesigner,ethicsReviewer for
 * cheap dev runs — those three have passed every live run so far).
 * Skipped reviewers are recorded as SKIPPED in the manifest and never
 * gate the revision loop.
 */
const SKIP_REVIEWERS = (process.env.SKIP_REVIEWERS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// ============================================================================
// Output Location
// ============================================================================
// Each run writes to its own folder so runs never overwrite each other:
//   output/episodes/episode-01-first-day/run-2026-07-06_06-03-45/*.json

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const RUN_STARTED_AT = new Date();
const runStamp = RUN_STARTED_AT.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
const episodeFolder = `episode-${String(EPISODE_BRIEF.episodeNumber).padStart(2, '0')}-${slugify(EPISODE_BRIEF.title)}`;
const OUTPUT_DIR = path.join(__dirname, '..', 'output', 'episodes', episodeFolder, `run-${runStamp}`);
const OUTPUT_DIR_RELATIVE = path.relative(path.join(__dirname, '..'), OUTPUT_DIR);

const savedFiles = [];

function saveToFile(filename, data) {
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  savedFiles.push(filename);
  console.log(`   💾 Saved: ${path.join(OUTPUT_DIR_RELATIVE, filename)}\n`);
}

// ============================================================================
// Mock Infrastructure (No Docker Required)
// ============================================================================

const mockMessageBus = {
  publish: async () => {},
  subscribe: async () => {},
  disconnect: async () => {}
};

const mockMemory = {
  store: async () => {},
  retrieve: async () => null,
  search: async () => [],
  disconnect: async () => {}
};

// ============================================================================
// Agents (initialized in main)
// ============================================================================

const agents = {
  storyArchitect: new StoryArchitectAgent(),
  characterDesigner: new CharacterDesignerAgent(),
  dialogueWriter: new DialogueWriterAgent(),
  creativeDirector: new CreativeDirectorAgent(),
  qaReviewer: new QAReviewerAgent(),
  childPsychologist: new ChildPsychologistAgent(),
  gameDesigner: new GameDesignerAgent(),
  ethicsReviewer: new EthicsReviewerAgent()
};

// ============================================================================
// Pipeline Steps
// ============================================================================

function worldBrief() {
  return `${TEST_WORLD.name} — ${TEST_WORLD.description}. Setting: ${TEST_WORLD.setting}. Tone: ${TEST_WORLD.tone}. Target age: ${TEST_WORLD.targetAge.join('-')}.`;
}

async function generateProtagonist(outline) {
  // NPC ids come from the outline (e.g. "maya", "jordan"). A protagonist
  // whose first name matches one of them reads as the same person to
  // reviewers — QA flagged exactly this collision on a live run.
  const npcIds = collectSupportingCharacterIds(outline);
  const requirements = [
    `This character is the player character of the episode "${outline.title}": ${outline.synopsis}`,
    'Relatable to 11-14 year olds (CRITICAL)',
    'Navigating a new school environment (HIGH)',
    `Their arc must support the episode themes: ${outline.themes.join(', ')}`
  ];
  if (npcIds.length > 0) {
    requirements.push(
      `Their first name must NOT resemble any of these existing supporting-character ids: ${npcIds.join(', ')}`
    );
  }

  const result = await agents.characterDesigner.process({
    type: 'NEW_CHARACTER',
    newCharacter: {
      world: worldBrief(),
      role: 'PROTAGONIST',
      requirements,
      relationshipContext: []
    }
  });
  // Scenes and dialogue reference the protagonist as "player" (the Story
  // Architect is instructed to use that id) — force the profile to match
  // so reviewers see a consistent roster.
  result.character.id = 'player';
  return result;
}

/**
 * Generate a Character Designer profile for every supporting character the
 * outline references but the roster doesn't have yet. Returns the new
 * profiles (full designer outputs, character ids forced to the outline ids).
 */
async function generateMissingSupportingCharacters(outline, roster) {
  const known = new Set(roster.map(c => c.id));
  const missing = collectSupportingCharacterIds(outline).filter(id => !known.has(id));
  const results = [];

  for (const characterId of missing) {
    const appearances = describeAppearances(outline, characterId);
    console.log(`   🔄 Designing supporting character "${characterId}" (${appearances.length} scene(s))...`);
    const startTime = Date.now();

    const result = await agents.characterDesigner.process({
      type: 'NEW_CHARACTER',
      newCharacter: {
        world: worldBrief(),
        role: `SUPPORTING character referenced as "${characterId}" in the episode "${outline.title}"`,
        requirements: [
          `Episode synopsis: ${outline.synopsis}`,
          `They appear in these scenes:\n${appearances.map(a => `  - ${a}`).join('\n') || '  - (scene list unavailable)'}`,
          'Age-appropriate for a middle-school story (students 11-14, adults where the role demands it)',
          'Must feel like a real person, not a plot device'
        ],
        relationshipContext: roster.concat(results.map(r => r.character))
      }
    });

    // The outline's scene lists and dialogue reference this exact id.
    result.character.id = characterId;
    results.push(result);
    console.log(`   ✅ ${result.character.name} [${characterId}] created (${((Date.now() - startTime) / 1000).toFixed(1)}s)\n`);
  }

  return results;
}

async function writeFullDialogue(outline, roster) {
  return await agents.dialogueWriter.process({
    type: 'WRITE_DIALOGUE',
    writeRequest: {
      episodeOutline: outline,
      characters: roster,
      scenes: outline.scenes,
      emotionalBeats: outline.emotionalArc || [],
      choicePoints: outline.choicePoints
    }
  });
}

function buildEpisodeForReview(outline, dialogueResult, roster) {
  // Reviewers evaluate what they are given — an empty scenes/choices array
  // makes QA fail the episode and turns safety reviews into synopsis-only
  // guesses.
  const scenesWithDialogue = (outline.scenes || []).map(scene => ({
    ...scene,
    dialogue: dialogueResult.dialogue?.find(d => d.sceneId === scene.id)?.lines || []
  }));

  return {
    id: `ep-${EPISODE_BRIEF.episodeNumber}`,
    worldId: TEST_WORLD.id,
    seasonId: 'season-1',
    episodeNumber: EPISODE_BRIEF.episodeNumber,
    title: outline.title,
    synopsis: outline.synopsis,
    scenes: scenesWithDialogue,
    choices: outline.choicePoints || [],
    choiceDialogue: dialogueResult.choiceDialogue || [],
    branchDialogue: dialogueResult.branchDialogue || [],
    outcomes: outline.branches || [],
    emotionalArc: outline.emotionalArc || [],
    themes: outline.themes,
    educationalGoals: outline.educationalGoals || [],
    targetTraits: outline.targetTraits.map(t => ({ traitId: t, changeAmount: 1 })),
    targetAge: TEST_WORLD.targetAge,
    characters: roster.map(c => c.id),
    estimatedPlayTime: outline.estimatedPlayTime,
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// ============================================================================
// Reviewers
// ============================================================================

const REVIEWERS = {
  creativeDirector: {
    label: 'Creative Director',
    run: (episode, roster) => agents.creativeDirector.process({
      type: 'EPISODE_REVIEW',
      episodeReview: { episode, worldContext: TEST_WORLD, previousEpisodes: [] }
    }),
    verdict: r => r.decision
  },
  qaReviewer: {
    label: 'QA Reviewer',
    run: (episode, roster) => agents.qaReviewer.process({
      type: 'REVIEW_EPISODE',
      episodeReview: { episode, characters: roster, world: TEST_WORLD, previousEpisodes: [] }
    }),
    verdict: r => r.status
  },
  childPsychologist: {
    label: 'Child Psychologist',
    run: (episode, roster) => agents.childPsychologist.process({
      type: 'REVIEW_EPISODE',
      episodeReview: { episode, characters: roster, world: TEST_WORLD }
    }),
    verdict: r => r.status
  },
  gameDesigner: {
    label: 'Game Designer',
    run: (episode, roster) => agents.gameDesigner.process({
      type: 'REVIEW_EPISODE',
      episodeReview: { episode, characters: roster, world: TEST_WORLD }
    }),
    verdict: r => r.status
  },
  ethicsReviewer: {
    label: 'Ethics Reviewer',
    run: (episode, roster) => agents.ethicsReviewer.process({
      type: 'REVIEW_EPISODE',
      episodeReview: { episode, characters: roster, world: TEST_WORLD }
    }),
    verdict: r => r.status
  }
};

const REVIEW_FILES = {
  creativeDirector: 'creative-review.json',
  qaReviewer: 'qa-review.json',
  childPsychologist: 'psych-review.json',
  gameDesigner: 'game-review.json',
  ethicsReviewer: 'ethics-review.json'
};

// Initial-pass files keep the numbered convention from earlier runs
// (e.g. 05-qa-review.json); revision-pass files live under revision-N/.
const INITIAL_REVIEW_FILES = {
  creativeDirector: '04-creative-review.json',
  qaReviewer: '05-qa-review.json',
  childPsychologist: '06-psych-review.json',
  gameDesigner: '07-game-review.json',
  ethicsReviewer: '08-ethics-review.json'
};

async function runReviewers(keys, episode, roster, filenameFor) {
  const results = {};
  for (const key of keys) {
    const reviewer = REVIEWERS[key];
    console.log(`   🔎 ${reviewer.label} reviewing...`);
    const startTime = Date.now();
    const result = await reviewer.run(episode, roster);
    results[key] = result;
    console.log(`   ✅ ${reviewer.label}: ${reviewer.verdict(result)} (${((Date.now() - startTime) / 1000).toFixed(1)}s)\n`);
    saveToFile(filenameFor(key), result);
  }
  return results;
}

function verdicts(reviews) {
  const out = {};
  for (const [key, reviewer] of Object.entries(REVIEWERS)) {
    if (SKIP_REVIEWERS.includes(key)) out[key] = 'SKIPPED';
    else if (reviews[key] !== undefined) out[key] = reviewer.verdict(reviews[key]);
  }
  return out;
}

/** Reviewer keys that actually run this pipeline (honors SKIP_REVIEWERS). */
function enabledReviewerKeys() {
  return Object.keys(REVIEWERS).filter(key => !SKIP_REVIEWERS.includes(key));
}

function usageSummary(llm) {
  const u = llm.getUsageStats();
  return {
    calls: u.calls,
    inputTokens: u.inputTokens,
    outputTokens: u.outputTokens,
    totalTokens: u.totalTokens,
    budget: MAX_RUN_TOKENS > 0 ? MAX_RUN_TOKENS : null,
    byModel: u.byModel
  };
}

function printUsage(llm) {
  const u = llm.getUsageStats();
  console.log(`   🔢 Token usage: ${u.totalTokens.toLocaleString()} total (${u.inputTokens.toLocaleString()} in / ${u.outputTokens.toLocaleString()} out, ${u.calls} calls)`);
  for (const [model, m] of Object.entries(u.byModel)) {
    console.log(`      ${model}: ${m.calls} calls, ${(m.inputTokens + m.outputTokens).toLocaleString()} tokens`);
  }
  if (MAX_RUN_TOKENS > 0) {
    console.log(`      Budget: ${((u.totalTokens / MAX_RUN_TOKENS) * 100).toFixed(1)}% of ${MAX_RUN_TOKENS.toLocaleString()} used`);
  }
}

// ============================================================================
// Main Workflow
// ============================================================================

async function main() {
  console.log('🎬 REAL EPISODE CREATION WITH CLAUDE\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Step 0: Check API Key
  console.log('📋 Step 0: Checking Prerequisites\n');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: ANTHROPIC_API_KEY not set!\n');
    console.error('   Please set your Claude API key:');
    console.error('   export ANTHROPIC_API_KEY="sk-ant-your-key-here"\n');
    console.error('   Then run this script again.\n');
    process.exit(1);
  }

  console.log('✅ Claude API key found');
  console.log(`   Key: ${apiKey.substring(0, 10)}...${apiKey.slice(-4)}\n`);
  console.log('⚡ Running in SIMPLIFIED mode (no Docker required)\n');
  console.log(`📁 Output folder for this run:\n   ${OUTPUT_DIR_RELATIVE}\n`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const workflowId = uuidv4();
  const threadId = uuidv4();

  console.log(`   Workflow ID: ${workflowId.substring(0, 8)}...`);
  console.log(`   Thread ID: ${threadId.substring(0, 8)}...\n`);

  const llm = createLLMGateway({
    anthropicApiKey: apiKey,
    defaultProvider: 'claude',
    maxTotalTokens: MAX_RUN_TOKENS > 0 ? MAX_RUN_TOKENS : undefined
  });
  console.log('✅ LLM Gateway ready');
  console.log(`   Token budget: ${MAX_RUN_TOKENS > 0 ? MAX_RUN_TOKENS.toLocaleString() + ' tokens (MAX_RUN_TOKENS)' : 'unlimited'}`);
  if (SKIP_REVIEWERS.length > 0) {
    console.log(`   Skipping reviewers: ${SKIP_REVIEWERS.join(', ')} (SKIP_REVIEWERS)`);
  }
  console.log('');

  // Step 1: Initialize Agents
  console.log('🤖 Step 1: Initializing Agents\n');

  await Promise.all(
    Object.values(agents).map(agent =>
      agent.initialize({ workflowId, threadId, messageBus: mockMessageBus, memory: mockMemory, llm })
    )
  );

  console.log('✅ Story Architect (River) ready');
  console.log('✅ Character Designer (Kai) ready');
  console.log('✅ Dialogue Writer (Echo) ready');
  console.log('✅ Creative Director (Aria) ready');
  console.log('✅ QA Reviewer (Alex) ready');
  console.log('✅ Child Psychologist (Dr. Sam) ready');
  console.log('✅ Game Designer (Jordan) ready');
  console.log('✅ Ethics Reviewer (Riley) ready\n');

  console.log('═══════════════════════════════════════════════════════════\n');

  const startTime = Date.now();
  const revisionHistory = [];

  try {
    // Step 2: Story Architect - Episode Outline
    console.log('📖 Step 2: Story Architect - Creating Episode Outline\n');
    console.log(`   Episode: "${EPISODE_BRIEF.title}"`);
    console.log(`   Synopsis: ${EPISODE_BRIEF.synopsis}\n`);
    console.log('   🔄 Calling Claude API to generate story structure...\n');

    const storyStart = Date.now();
    const storyResult = await agents.storyArchitect.process({
      type: 'NEW_EPISODE',
      brief: {
        world: EPISODE_BRIEF.world,
        season: EPISODE_BRIEF.season,
        episodeNumber: EPISODE_BRIEF.episodeNumber,
        themes: EPISODE_BRIEF.themes,
        targetTraits: EPISODE_BRIEF.targetTraits,
        characters: []
      }
    });
    let outline = storyResult.episodeOutline;

    console.log(`✅ Episode outline created! (${((Date.now() - storyStart) / 1000).toFixed(1)}s)`);
    console.log(`   Title: ${outline.title}`);
    console.log(`   Scenes: ${outline.scenes.length}`);
    console.log(`   Choice Points: ${outline.choicePoints.length}`);
    console.log(`   Branches: ${outline.branches?.length || 0}\n`);

    saveToFile('01-story-outline.json', storyResult);

    // Step 3: Character Designer - Protagonist
    console.log('👥 Step 3: Character Designer - Creating Protagonist\n');
    console.log('   🔄 Calling Claude API to design the protagonist...\n');

    const charStart = Date.now();
    const protagonistResult = await generateProtagonist(outline);

    console.log(`✅ Protagonist created! (${((Date.now() - charStart) / 1000).toFixed(1)}s)`);
    console.log(`   Name: ${protagonistResult.character?.name} [id: player]`);
    console.log(`   Age: ${protagonistResult.character?.age}`);
    console.log(`   Core Traits: ${protagonistResult.character?.personality.coreTraits.join(', ')}\n`);

    saveToFile('02-protagonist.json', protagonistResult);

    // Step 4: Character Designer - Supporting Cast (NPC roster)
    console.log('👥 Step 4: Character Designer - Creating Supporting Cast\n');

    // `roster` is every character generated during the run; `cast` is the
    // subset the CURRENT outline references (revisions can write characters
    // out of the story — declaring them anyway makes QA flag phantoms).
    let roster = [protagonistResult.character];
    const supportingResults = await generateMissingSupportingCharacters(outline, roster);
    roster = roster.concat(supportingResults.map(r => r.character));
    let cast = activeRoster(outline, roster);

    console.log(`✅ Roster complete: ${roster.map(c => `${c.name} [${c.id}]`).join(', ')}\n`);
    saveToFile('02-supporting-characters.json', supportingResults);

    // Step 5: Dialogue Writer
    console.log('💬 Step 5: Dialogue Writer - Creating Scene Dialogue\n');
    console.log('   🔄 Calling Claude API to write dialogue...\n');

    const dialogueStart = Date.now();
    let dialogueResult = await writeFullDialogue(outline, cast);

    console.log(`✅ Dialogue created! (${((Date.now() - dialogueStart) / 1000).toFixed(1)}s)`);
    console.log(`   Scenes with dialogue: ${dialogueResult.dialogue?.length || 0}`);
    console.log(`   Total lines: ${dialogueResult.dialogue?.reduce((sum, scene) => sum + (scene.lines?.length || 0), 0) || 0}\n`);

    saveToFile('03-dialogue.json', dialogueResult);

    // Step 6: Full review board
    console.log('🔎 Step 6: Review Board (5 reviewers)\n');

    let episodeForReview = buildEpisodeForReview(outline, dialogueResult, cast);
    let reviews = await runReviewers(
      enabledReviewerKeys(),
      episodeForReview,
      cast,
      key => INITIAL_REVIEW_FILES[key]
    );

    console.log('   📊 Initial verdicts:', JSON.stringify(verdicts(reviews)), '\n');

    // Step 7: Revision loop — bounded, feedback-routed
    let iteration = 0;
    while (failingReviewers(reviews).length > 0 && iteration < MAX_REVISION_ITERATIONS) {
      iteration += 1;
      const failing = failingReviewers(reviews);
      const feedback = collectRevisionFeedback(reviews);

      console.log('═══════════════════════════════════════════════════════════\n');
      console.log(`🔁 Step 7.${iteration}: Revision Iteration ${iteration}/${MAX_REVISION_ITERATIONS}\n`);
      console.log(`   Failing reviewers: ${failing.join(', ')}`);
      console.log(`   Story feedback items: ${feedback.story.length}`);
      console.log(`   Dialogue feedback items: ${feedback.dialogue.length}\n`);

      const prefix = `revision-${iteration}/`;
      saveToFile(`${prefix}feedback.json`, { failing, feedback });

      const actions = [];

      if (feedback.story.length > 0) {
        // Story-level problems: revise the outline, then rewrite dialogue
        // against the revised outline (scene structure may have changed).
        console.log('   📖 Story Architect revising outline (REVISION_REQUEST)...\n');
        const revisionStart = Date.now();
        const revisedStory = await agents.storyArchitect.process({
          type: 'REVISION_REQUEST',
          revisionRequest: {
            currentDraft: outline,
            feedback: feedback.story,
            constraints: [
              'Keep the same protagonist (referenced as "player")',
              `Keep the episode themes: ${EPISODE_BRIEF.themes.join(', ')}`,
              'Prefer keeping existing scene/character ids stable unless a fix requires changing them'
            ]
          }
        });
        outline = revisedStory.episodeOutline;
        actions.push('story-revision');
        console.log(`   ✅ Outline revised (${((Date.now() - revisionStart) / 1000).toFixed(1)}s)\n`);
        saveToFile(`${prefix}story-outline.json`, revisedStory);

        // The revised outline may reference new characters — and may have
        // written previously generated ones out of the story.
        const newSupporting = await generateMissingSupportingCharacters(outline, roster);
        if (newSupporting.length > 0) {
          roster = roster.concat(newSupporting.map(r => r.character));
          actions.push('roster-extension');
          saveToFile(`${prefix}supporting-characters.json`, newSupporting);
        }
        cast = activeRoster(outline, roster);

        console.log('   💬 Dialogue Writer rewriting dialogue for revised outline...\n');
        const rewriteStart = Date.now();
        dialogueResult = await writeFullDialogue(outline, cast);
        actions.push('dialogue-rewrite');
        console.log(`   ✅ Dialogue rewritten (${((Date.now() - rewriteStart) / 1000).toFixed(1)}s)\n`);
        saveToFile(`${prefix}dialogue.json`, dialogueResult);
      } else if (feedback.dialogue.length > 0) {
        // Dialogue-only problems: targeted revision, merge over previous.
        console.log('   💬 Dialogue Writer revising dialogue (REVISE_DIALOGUE)...\n');
        const reviseStart = Date.now();
        const revisedDialogue = await agents.dialogueWriter.process({
          type: 'REVISE_DIALOGUE',
          revisionRequest: {
            currentDialogue: dialogueResult.dialogue,
            feedback: feedback.dialogue
          }
        });
        dialogueResult = {
          ...dialogueResult,
          dialogue: mergeSceneDialogue(dialogueResult.dialogue, revisedDialogue.dialogue),
          choiceDialogue: mergeChoiceDialogue(dialogueResult.choiceDialogue, revisedDialogue.choiceDialogue),
          branchDialogue: mergeBranchDialogue(dialogueResult.branchDialogue, revisedDialogue.branchDialogue)
        };
        actions.push('dialogue-revision');
        console.log(`   ✅ Dialogue revised (${((Date.now() - reviseStart) / 1000).toFixed(1)}s)\n`);
        saveToFile(`${prefix}dialogue.json`, dialogueResult);
      } else {
        // Failing verdicts but no actionable feedback — nothing to route.
        console.log('   ⚠️ Reviewers failed the episode but produced no actionable feedback items; stopping revision loop.\n');
        revisionHistory.push({ iteration, failingBefore: failing, actions: [], verdictsAfter: verdicts(reviews) });
        break;
      }

      // Re-review with only the reviewers that were failing.
      console.log(`   🔎 Re-running ${failing.length} failing reviewer(s)...\n`);
      episodeForReview = buildEpisodeForReview(outline, dialogueResult, cast);
      const newReviews = await runReviewers(failing, episodeForReview, cast, key => `${prefix}${REVIEW_FILES[key]}`);
      reviews = { ...reviews, ...newReviews };

      revisionHistory.push({
        iteration,
        failingBefore: failing,
        actions,
        storyFeedbackCount: feedback.story.length,
        dialogueFeedbackCount: feedback.dialogue.length,
        verdictsAfter: verdicts(reviews)
      });

      console.log(`   📊 Verdicts after iteration ${iteration}:`, JSON.stringify(verdicts(reviews)), '\n');
    }

    const stillFailing = failingReviewers(reviews);
    const finalStatus = stillFailing.length === 0 ? 'APPROVED' : 'NEEDS_HUMAN_REVIEW';

    // Run manifest: what was generated, with what verdicts, and how revisions went
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

    const manifest = {
      episode: {
        number: EPISODE_BRIEF.episodeNumber,
        title: outline.title,
        world: TEST_WORLD.id
      },
      run: {
        workflowId,
        threadId,
        startedAt: RUN_STARTED_AT.toISOString(),
        completedAt: new Date().toISOString(),
        totalSeconds: parseFloat(totalDuration),
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
        reviewModel: process.env.ANTHROPIC_REVIEW_MODEL || 'claude-haiku-4-5-20251001',
        skippedReviewers: SKIP_REVIEWERS,
        usage: usageSummary(llm)
      },
      roster: roster.map(c => ({
        id: c.id,
        name: c.name,
        role: c.storyRole,
        active: cast.some(a => a.id === c.id)
      })),
      finalStatus,
      verdicts: verdicts(reviews),
      revisions: revisionHistory,
      files: savedFiles.concat('manifest.json')
    };
    saveToFile('manifest.json', manifest);

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('✨ FULL EPISODE PIPELINE COMPLETE!\n');
    console.log(`   📁 Location: ${OUTPUT_DIR_RELATIVE}\n`);
    console.log(`   Final status: ${finalStatus}`);
    console.log(`   Final verdicts: ${JSON.stringify(verdicts(reviews))}`);
    console.log(`   Revision iterations used: ${revisionHistory.length}/${MAX_REVISION_ITERATIONS}`);
    if (stillFailing.length > 0) {
      console.log(`   ⚠️ Still failing after revisions: ${stillFailing.join(', ')} — human review needed`);
    }
    console.log(`   ⏱️ Total: ${totalDuration}s (${(totalDuration / 60).toFixed(1)} minutes)`);
    printUsage(llm);
    console.log('');
  } catch (error) {
    console.error('\n❌ Error during episode creation:\n');
    if (error.name === 'TokenBudgetExceededError') {
      console.error(`   ${error.message}\n`);
      // Preserve what the run produced so the spend isn't wasted.
      saveToFile('manifest.json', {
        episode: { number: EPISODE_BRIEF.episodeNumber, world: TEST_WORLD.id },
        run: {
          workflowId,
          threadId,
          startedAt: RUN_STARTED_AT.toISOString(),
          abortedAt: new Date().toISOString(),
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
          reviewModel: process.env.ANTHROPIC_REVIEW_MODEL || 'claude-haiku-4-5-20251001',
          skippedReviewers: SKIP_REVIEWERS,
          usage: usageSummary(llm)
        },
        finalStatus: 'BUDGET_EXCEEDED',
        revisions: revisionHistory,
        files: savedFiles.concat('manifest.json')
      });
      printUsage(llm);
    } else if (error.message?.includes('401')) {
      console.error('   Invalid API key. Please check your ANTHROPIC_API_KEY.\n');
    } else if (error.message?.includes('429')) {
      console.error('   Rate limit exceeded. Please wait a moment and try again.\n');
    } else if (error.message?.includes('insufficient_quota')) {
      console.error('   API quota exceeded. Check your Claude account credits.\n');
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

// ============================================================================
// Execute
// ============================================================================

main().catch((error) => {
  console.error('\n❌ Unexpected error:\n');
  console.error(error);
  process.exit(1);
});
