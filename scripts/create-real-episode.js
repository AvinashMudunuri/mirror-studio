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
  mergeBranchDialogue,
  unreadableResult,
  reusedCharacterResult,
  findReusableCharacter
} = require('./lib/pipeline-helpers');
const { compileScreenplay } = require('./lib/compile-screenplay');
const { buildEpisodeRow, persistEpisode } = require('./lib/persist-episode');
const { loadPreviousEpisodes, loadPreviousCast } = require('./lib/load-previous-episodes');

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
  createLLMGateway,
  ReviewParseError
} = agentsModule;

const { v4: uuidv4 } = require('uuid');

// ============================================================================
// Configuration
// ============================================================================

/**
 * One brief per episode number. `EPISODE_NUMBER` (env, default 1) selects
 * which one this run generates — this is what makes "episode 2" possible.
 * Continuity with earlier episodes is NOT hardcoded here: it comes from
 * `loadPreviousEpisodes()` reading whatever actually got APPROVED for
 * earlier episode numbers (Postgres or committed run folders), so these
 * briefs only need to set up the NEW episode's premise.
 */
const EPISODE_BRIEFS = {
  1: {
    world: 'New School',
    worldId: 'NEW_SCHOOL',
    season: 'Season 1: First Year',
    episodeNumber: 1,
    title: 'First Day',
    themes: ['Belonging', 'Authenticity', 'First Impressions'],
    targetTraits: ['CONFIDENCE', 'EMPATHY', 'ADAPTABILITY'],
    synopsis: 'Alex starts their first day at a new middle school after moving to a new city. They must navigate unfamiliar hallways, make new friends, and decide how much of their true self to show.'
  },
  2: {
    world: 'New School',
    worldId: 'NEW_SCHOOL',
    season: 'Season 1: First Year',
    episodeNumber: 2,
    title: 'The Group Project',
    themes: ['Peer Pressure', 'Honesty', 'Teamwork'],
    targetTraits: ['INTEGRITY', 'COMMUNICATION', 'JUDGMENT'],
    synopsis: 'A few weeks into the new school, the protagonist is placed in a group project with classmates from different friend circles. When a groupmate pushes to cut corners so the group finishes early, the protagonist has to decide whether to speak up, go along, or find another way — continuing to figure out who they want to be now that the nerves of the first day have worn off.'
  }
};

const EPISODE_NUMBER = parseInt(process.env.EPISODE_NUMBER || '1', 10);
const EPISODE_BRIEF = EPISODE_BRIEFS[EPISODE_NUMBER];
if (!EPISODE_BRIEF) {
  console.error(`❌ Error: no episode brief defined for EPISODE_NUMBER=${EPISODE_NUMBER}.`);
  console.error(`   Defined episode numbers: ${Object.keys(EPISODE_BRIEFS).join(', ')}\n`);
  process.exit(1);
}

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
// Infrastructure
// ============================================================================
// No message bus: this pipeline orchestrates agents by direct calls
// (docs/decisions/001-message-bus-out-of-runtime.md).
//
// Memory/persistence: when DATABASE_URL is set, agent memory goes to
// Postgres and the finished episode is upserted into the episodes table.
// Without it, memory is a no-op mock and the filesystem run folder is the
// only output. Either way the run folder stays the source of truth.

const DATABASE_URL = process.env.DATABASE_URL;

const mockMemory = {
  store: async () => {},
  retrieve: async () => null,
  search: async () => [],
  disconnect: async () => {}
};

/**
 * Memory must never kill a run: generation is the product, memory is
 * infrastructure. A mid-run DB hiccup degrades to warnings.
 */
function resilientMemory(memory) {
  const guard = (name, fallback) => async (...args) => {
    try {
      return await memory[name](...args);
    } catch (error) {
      console.warn(`   ⚠️ memory.${name} failed (continuing without): ${error.message}`);
      return fallback;
    }
  };
  return {
    store: guard('store', undefined),
    retrieve: guard('retrieve', null),
    search: guard('search', [])
  };
}

function createRunMemory() {
  if (!DATABASE_URL) return { memory: mockMemory, label: 'mock (set DATABASE_URL for Postgres)' };
  try {
    const { createMemorySystem } = require('@mirror/memory');
    const memorySystem = createMemorySystem({ databaseUrl: DATABASE_URL });
    return { memory: resilientMemory(memorySystem), label: 'Postgres', close: () => memorySystem.close() };
  } catch (error) {
    console.warn(`   ⚠️ Could not initialize Postgres memory (${error.message}); using mock`);
    return { memory: mockMemory, label: 'mock (Postgres init failed)' };
  }
}

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

/**
 * @param {object} outline - current episode's outline
 * @param {object|null} existingProtagonist - protagonist profile carried
 *   over from a previous episode (loadPreviousCast(), the "player" entry),
 *   if any. Reusing it verbatim is what makes "episode 2" actually the same
 *   person as episode 1's, instead of a different character who happens
 *   to be called "player" — Character Designer previously invented a
 *   brand new protagonist every single run regardless of continuity.
 */
async function generateProtagonist(outline, existingProtagonist) {
  if (existingProtagonist) {
    console.log(`   ♻️  Continuity: reusing protagonist "${existingProtagonist.name}" from a previous episode (no Character Designer call)`);
    return reusedCharacterResult(existingProtagonist, 'player');
  }

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
 *
 * @param {object} outline
 * @param {object[]} roster - characters already generated this run
 * @param {object[]} [previousCast] - full cast of the most recent previous
 *   episode (loadPreviousCast()). If the CURRENT outline happens to
 *   reference an id that character used, reuse their exact profile
 *   instead of designing someone new with the same id — same continuity
 *   principle as the protagonist, just opportunistic instead of
 *   unconditional (only triggers when the Story Architect actually
 *   brought that id back, which the brief.characters continuity hint in
 *   main() makes more likely but never guarantees).
 */
async function generateMissingSupportingCharacters(outline, roster, previousCast) {
  const known = new Set(roster.map(c => c.id));
  const missing = collectSupportingCharacterIds(outline).filter(id => !known.has(id));
  const results = [];

  for (const characterId of missing) {
    const reusable = findReusableCharacter(characterId, previousCast);
    if (reusable) {
      console.log(`   ♻️  Continuity: reusing supporting character "${characterId}" (${reusable.name}) from a previous episode (no Character Designer call)`);
      results.push(reusedCharacterResult(reusable, characterId));
      continue;
    }

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
  //
  // Each scene also gets an explicit derived "transition" object. The
  // choice→scene linkage only lives on the choice side (choice.scene), and
  // the review model repeatedly misread scenes with a choice attached as
  // dead ends ("defaultNextScene: null but no choice attached").
  const choicesByScene = new Map(
    (outline.choicePoints || []).map(cp => [cp.scene, cp])
  );
  const scenesWithDialogue = (outline.scenes || []).map(scene => {
    const choice = choicesByScene.get(scene.id);
    const transition = choice
      ? { type: 'choice', choiceId: choice.id, nextScenes: (choice.options || []).map(o => o.nextScene) }
      : { type: 'default', nextScene: scene.defaultNextScene };
    // A choice-scene transitions via `transition` above, not
    // `defaultNextScene` — but the outline usually still carries a
    // leftover `defaultNextScene` field (often null) on those scenes, and
    // reviewers repeatedly misread its mere presence as "two transition
    // mechanisms defined simultaneously" (a false BLOCKER/CRITICAL seen
    // 6 times in a single live QA review). Drop it here so the only
    // transition mechanism reviewers ever see for a choice-scene is the
    // authoritative one.
    const { defaultNextScene, ...sceneWithoutDefaultNextScene } = scene;
    return {
      ...(choice ? sceneWithoutDefaultNextScene : scene),
      transition,
      dialogue: dialogueResult.dialogue?.find(d => d.sceneId === scene.id)?.lines || []
    };
  });

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
    // `characters: roster` matches what the other 4 reviewers receive —
    // needed so the shared, cacheable review context this reviewer builds
    // is byte-identical to theirs (see buildSharedReviewContext).
    // `previousEpisodes` feeds its continuity/tone checks directly
    // (EpisodeReference[]: id/title/synopsis/themes — the exact shape
    // loadPreviousEpisodes() already produces).
    run: (episode, roster, previousEpisodes) => agents.creativeDirector.process({
      type: 'EPISODE_REVIEW',
      episodeReview: { episode, worldContext: TEST_WORLD, previousEpisodes: previousEpisodes || [], characters: roster }
    }),
    verdict: r => r.decision,
    verdictField: 'decision'
  },
  qaReviewer: {
    label: 'QA Reviewer',
    // QA's prompt only ever reads previousEpisodes.length (continuity
    // *count*, not content) — the lighter {id,title,synopsis,themes}
    // shape from loadPreviousEpisodes() is fine even though the type
    // declares Episode[].
    run: (episode, roster, previousEpisodes) => agents.qaReviewer.process({
      type: 'REVIEW_EPISODE',
      episodeReview: { episode, characters: roster, world: TEST_WORLD, previousEpisodes: previousEpisodes || [] }
    }),
    verdict: r => r.status,
    verdictField: 'status'
  },
  childPsychologist: {
    label: 'Child Psychologist',
    run: (episode, roster) => agents.childPsychologist.process({
      type: 'REVIEW_EPISODE',
      episodeReview: { episode, characters: roster, world: TEST_WORLD }
    }),
    verdict: r => r.status,
    verdictField: 'status'
  },
  gameDesigner: {
    label: 'Game Designer',
    run: (episode, roster) => agents.gameDesigner.process({
      type: 'REVIEW_EPISODE',
      episodeReview: { episode, characters: roster, world: TEST_WORLD }
    }),
    verdict: r => r.status,
    verdictField: 'status'
  },
  ethicsReviewer: {
    label: 'Ethics Reviewer',
    run: (episode, roster) => agents.ethicsReviewer.process({
      type: 'REVIEW_EPISODE',
      episodeReview: { episode, characters: roster, world: TEST_WORLD }
    }),
    verdict: r => r.status,
    verdictField: 'status'
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

async function runReviewers(keys, episode, roster, filenameFor, previousEpisodes) {
  const results = {};
  for (const key of keys) {
    const reviewer = REVIEWERS[key];
    console.log(`   🔎 ${reviewer.label} reviewing...`);
    const startTime = Date.now();
    let result;
    try {
      result = await reviewer.run(episode, roster, previousEpisodes);
    } catch (error) {
      // A reviewer whose response can't be parsed throws ReviewParseError
      // (deliberate — a fabricated review is worse than a crash, see
      // packages/agents/src/errors.ts). Mark it UNREADABLE and keep going
      // instead of losing every token this run has spent so far; any
      // other error (network, auth, budget) still propagates and crashes.
      if (!(error instanceof ReviewParseError)) throw error;
      console.warn(`   ⚠️ ${reviewer.label} returned an unreadable response — marking UNREADABLE and continuing (raw response saved, run will need human review): ${error.message}`);
      result = unreadableResult(reviewer.verdictField, error);
    }
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
    cacheCreationInputTokens: u.cacheCreationInputTokens,
    cacheReadInputTokens: u.cacheReadInputTokens,
    budget: MAX_RUN_TOKENS > 0 ? MAX_RUN_TOKENS : null,
    byModel: u.byModel
  };
}

function printUsage(llm) {
  const u = llm.getUsageStats();
  console.log(`   🔢 Token usage: ${u.totalTokens.toLocaleString()} total (${u.inputTokens.toLocaleString()} in / ${u.outputTokens.toLocaleString()} out, ${u.calls} calls)`);
  if (u.cacheCreationInputTokens > 0 || u.cacheReadInputTokens > 0) {
    console.log(`      Prompt cache: ${u.cacheCreationInputTokens.toLocaleString()} tokens written, ${u.cacheReadInputTokens.toLocaleString()} tokens read (read is billed at ~10% of input price)`);
  }
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

  const runMemory = createRunMemory();
  console.log(`   Agent memory: ${runMemory.label}`);
  console.log(`   Episode persistence: ${DATABASE_URL ? 'Postgres (episodes table)' : 'filesystem only'}`);
  console.log('');

  // Step 1: Initialize Agents
  console.log('🤖 Step 1: Initializing Agents\n');

  await Promise.all(
    Object.values(agents).map(agent =>
      agent.initialize({ workflowId, threadId, memory: runMemory.memory, llm })
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

    const episodesRootForContinuity = path.join(__dirname, '..', 'output', 'episodes');
    const { episodes: previousEpisodes, source: previousEpisodesSource } = await loadPreviousEpisodes({
      databaseUrl: DATABASE_URL,
      worldId: TEST_WORLD.id,
      beforeEpisodeNumber: EPISODE_BRIEF.episodeNumber,
      episodesRoot: episodesRootForContinuity
    });
    if (previousEpisodes.length > 0) {
      console.log(`   📚 Continuity: ${previousEpisodes.length} previous episode(s) loaded from ${previousEpisodesSource} — ${previousEpisodes.map(e => `"${e.title}"`).join(', ')}\n`);
    }

    const { cast: previousCast, source: previousCastSource } = await loadPreviousCast({
      databaseUrl: DATABASE_URL,
      worldId: TEST_WORLD.id,
      beforeEpisodeNumber: EPISODE_BRIEF.episodeNumber,
      episodesRoot: episodesRootForContinuity
    });
    const previousProtagonist = previousCast.find(c => c.id === 'player') || null;
    if (previousProtagonist) {
      console.log(`   👤 Continuity: protagonist "${previousProtagonist.name}" carries over from ${previousCastSource} (Story Architect informed, Character Designer skipped)\n`);
    }
    const previousNpcCount = previousCast.filter(c => c.id !== 'player').length;
    if (previousNpcCount > 0) {
      console.log(`   👥 Continuity: ${previousNpcCount} supporting character(s) from a previous episode are available to bring back if the outline references their id\n`);
    }

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
        // The full previous cast (if any) is given to the Story Architect
        // BEFORE the outline is written: the protagonist is always
        // referenced as "player" (mandatory continuity), and any
        // supporting character MAY be brought back by reusing their id
        // (optional — see the AVAILABLE CHARACTERS instructions in
        // buildContext()). Either way, scene descriptions and dialogue
        // use established names/traits from the start instead of a
        // generic placeholder some later step has to reconcile.
        characters: previousCast,
        previousEpisodes
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
    const protagonistResult = await generateProtagonist(outline, previousProtagonist);

    console.log(previousProtagonist
      ? `✅ Protagonist carried over (${((Date.now() - charStart) / 1000).toFixed(1)}s)`
      : `✅ Protagonist created! (${((Date.now() - charStart) / 1000).toFixed(1)}s)`);
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
    const supportingResults = await generateMissingSupportingCharacters(outline, roster, previousCast);
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
      key => INITIAL_REVIEW_FILES[key],
      previousEpisodes
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
        const newSupporting = await generateMissingSupportingCharacters(outline, roster, previousCast);
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
      const newReviews = await runReviewers(failing, episodeForReview, cast, key => `${prefix}${REVIEW_FILES[key]}`, previousEpisodes);
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
        previousEpisodes: previousEpisodes.map(e => ({ id: e.id, title: e.title })),
        previousEpisodesSource: previousEpisodes.length > 0 ? previousEpisodesSource : null,
        previousProtagonist: previousProtagonist ? { name: previousProtagonist.name, source: previousCastSource } : null,
        // Any id in the final cast that also appears in previousCast was
        // necessarily reused, not designed fresh — findReusableCharacter()
        // only ever returns a match for ids the current outline shares
        // with the previous episode's cast, and a match always wins over
        // generating a new character with that id.
        reusedSupportingCharacters: cast
          .filter(c => c.id !== 'player' && previousCast.some(pc => pc.id === c.id))
          .map(c => ({ id: c.id, name: c.name })),
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
      files: savedFiles.concat(['manifest.json', 'episode-script.md'])
    };
    saveToFile('manifest.json', manifest);

    // Bind the script: one human-readable screenplay of the final content.
    // Stamped FINAL — LOCKED only when the board approved it.
    const screenplay = compileScreenplay({ outline, cast, dialogueResult, manifest });
    const screenplayPath = path.join(OUTPUT_DIR, 'episode-script.md');
    fs.writeFileSync(screenplayPath, screenplay, 'utf-8');
    console.log(`   📜 Bound script: ${path.join(OUTPUT_DIR_RELATIVE, 'episode-script.md')} (${finalStatus === 'APPROVED' ? 'FINAL — LOCKED' : 'DRAFT'})\n`);

    // Persist the episode to Postgres (best effort — the run folder is the
    // source of truth, and scripts/persist-run.js can backfill later, so a
    // DB failure at the very end must not fail a completed run).
    if (DATABASE_URL) {
      try {
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: DATABASE_URL });
        try {
          const row = buildEpisodeRow({ outline, cast, dialogueResult, manifest, runFolder: OUTPUT_DIR_RELATIVE });
          const persisted = await persistEpisode(pool, row);
          console.log(`   💾 Persisted to Postgres: episode ${persisted.episodeId} (status ${persisted.status})\n`);
        } finally {
          await pool.end();
        }
      } catch (error) {
        console.warn(`   ⚠️ Postgres persistence failed (run folder is intact; backfill with "npm run persist:run"): ${error.message}\n`);
      }
    }
    if (runMemory.close) {
      await runMemory.close().catch(() => {});
    }

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
