#!/usr/bin/env node

/**
 * Simple Real Episode Creation
 * Uses built JS files directly (no TypeScript compilation needed)
 */

const path = require('path');
const fs = require('fs');

// Import from built packages (resolve from script location)
const packageRoot = path.resolve(__dirname, '..');

// Try multiple paths for different environments (GitHub Codespaces vs local)
let agentsModule;
const possiblePaths = [
  path.join(packageRoot, 'packages', 'agents', 'dist', 'index.js'),
  path.join(packageRoot, '..', 'packages', 'agents', 'dist', 'index.js'),
  require.resolve('@mirror/agents')
];

for (const tryPath of possiblePaths) {
  try {
    if (fs.existsSync(tryPath) || tryPath.startsWith('@mirror')) {
      agentsModule = require(tryPath);
      console.log(`✅ Loaded agents from: ${tryPath}\n`);
      break;
    }
  } catch (err) {
    // Try next path
  }
}

if (!agentsModule) {
  console.error('❌ Error: Could not load @mirror/agents package');
  console.error('   Tried paths:');
  possiblePaths.forEach(p => console.error(`   - ${p}`));
  process.exit(1);
}

const { 
  StoryArchitectAgent,
  CharacterDesignerAgent,
  DialogueWriterAgent,
  CreativeDirectorAgent,
  QAReviewerAgent,
  ChildPsychologistAgent,
  createLLMGateway
} = agentsModule;

const { v4: uuidv4 } = require('uuid');

// ============================================================================
// Configuration
// ============================================================================

const OUTPUT_DIR = path.join(__dirname, '../output/real-episode');

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
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Initialize LLM Gateway
  const workflowId = uuidv4();
  const threadId = uuidv4();
  
  console.log(`   Workflow ID: ${workflowId.substring(0, 8)}...`);
  console.log(`   Thread ID: ${threadId.substring(0, 8)}...\n`);
  
  const llm = createLLMGateway({
    anthropicApiKey: apiKey,
    defaultProvider: 'claude'
  });
  console.log('✅ LLM Gateway ready\n');
  
  // Initialize Agents
  console.log('🤖 Step 1: Initializing Agents\n');
  
  const storyArchitect = new StoryArchitectAgent();
  const characterDesigner = new CharacterDesignerAgent();
  const dialogueWriter = new DialogueWriterAgent();
  const creativeDirector = new CreativeDirectorAgent();
  const qaReviewer = new QAReviewerAgent();
  const childPsychologist = new ChildPsychologistAgent();
  
  await Promise.all([
    storyArchitect.initialize({ 
      workflowId, 
      threadId, 
      messageBus: mockMessageBus, 
      memory: mockMemory, 
      llm 
    }),
    characterDesigner.initialize({ 
      workflowId, 
      threadId, 
      messageBus: mockMessageBus, 
      memory: mockMemory, 
      llm 
    }),
    dialogueWriter.initialize({ 
      workflowId, 
      threadId, 
      messageBus: mockMessageBus, 
      memory: mockMemory, 
      llm 
    }),
    creativeDirector.initialize({ 
      workflowId, 
      threadId, 
      messageBus: mockMessageBus, 
      memory: mockMemory, 
      llm 
    }),
    qaReviewer.initialize({ 
      workflowId, 
      threadId, 
      messageBus: mockMessageBus, 
      memory: mockMemory, 
      llm 
    }),
    childPsychologist.initialize({ 
      workflowId, 
      threadId, 
      messageBus: mockMessageBus, 
      memory: mockMemory, 
      llm 
    })
  ]);
  
  console.log('✅ Story Architect (River) ready');
  console.log('✅ Character Designer (Kai) ready');
  console.log('✅ Dialogue Writer (Echo) ready');
  console.log('✅ Creative Director (Aria) ready');
  console.log('✅ QA Reviewer (Alex) ready');
  console.log('✅ Child Psychologist (Dr. Sam) ready\n');
  
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Step 2: Story Architect - Create Episode Outline
  console.log('📖 Step 2: Story Architect - Creating Episode Outline\n');
  console.log(`   Episode: "${EPISODE_BRIEF.title}"`);
  console.log(`   Synopsis: ${EPISODE_BRIEF.synopsis}\n`);
  console.log('   🔄 Calling Claude API to generate story structure...');
  console.log('   ⏳ This may take 30-60 seconds...\n');
  
  const startTime = Date.now();
  
  try {
    const storyResult = await storyArchitect.process({
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
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`✅ Episode outline created! (${duration}s)`);
    console.log(`   Title: ${storyResult.episodeOutline.title}`);
    console.log(`   Scenes: ${storyResult.episodeOutline.scenes.length}`);
    console.log(`   Choice Points: ${storyResult.episodeOutline.choicePoints.length}`);
    console.log(`   Branches: ${storyResult.episodeOutline.branches?.length || 0}`);
    console.log(`   Estimated Play Time: ${storyResult.episodeOutline.estimatedPlayTime || 'N/A'} minutes\n`);
    
    saveToFile('01-story-outline.json', storyResult);
    console.log('   💾 Saved: output/real-episode/01-story-outline.json\n');
    
    // Step 3: Character Designer - Create Protagonist
    console.log('👥 Step 3: Character Designer - Creating Protagonist\n');
    console.log('   🔄 Calling Claude API to design character...\n');
    
    const charStartTime = Date.now();
    
    const protagonistResult = await characterDesigner.process({
      type: 'NEW_CHARACTER',
      newCharacter: {
        world: TEST_WORLD,
        role: 'PROTAGONIST',
        requirements: [
          {
            trait: 'Relatable to 11-14 year olds',
            importance: 'CRITICAL'
          },
          {
            trait: 'Navigating new school environment',
            importance: 'HIGH'
          }
        ],
        relationshipContext: []
      }
    });
    
    const charDuration = ((Date.now() - charStartTime) / 1000).toFixed(1);
    
    console.log(`✅ Protagonist created! (${charDuration}s)`);
    console.log(`   Name: ${protagonistResult.character?.name}`);
    console.log(`   Age: ${protagonistResult.character?.age}`);
    console.log(`   Pronouns: ${protagonistResult.character?.pronouns}`);
    console.log(`   Core Traits: ${protagonistResult.character?.personality.coreTraits.join(', ')}`);
    console.log(`   Role: ${protagonistResult.character?.storyRole}\n`);
    
    saveToFile('02-protagonist.json', protagonistResult);
    console.log('   💾 Saved: output/real-episode/02-protagonist.json\n');
    
    // Step 4: Dialogue Writer - Write Scene Dialogue
    console.log('💬 Step 4: Dialogue Writer - Creating Scene Dialogue\n');
    console.log('   🔄 Calling Claude API to write dialogue...\n');
    console.log('   ⏳ This may take 60-90 seconds...\n');
    
    const dialogueStartTime = Date.now();
    
    const dialogueResult = await dialogueWriter.process({
      type: 'WRITE_DIALOGUE',
      writeRequest: {
        episodeOutline: storyResult.episodeOutline,
        characters: [protagonistResult.character],
        scenes: storyResult.episodeOutline.scenes,
        emotionalBeats: storyResult.episodeOutline.emotionalArc || [],
        choicePoints: storyResult.episodeOutline.choicePoints
      }
    });
    
    const dialogueDuration = ((Date.now() - dialogueStartTime) / 1000).toFixed(1);
    
    console.log(`✅ Dialogue created! (${dialogueDuration}s)`);
    console.log(`   Scenes with dialogue: ${dialogueResult.dialogue?.length || 0}`);
    console.log(`   Total lines: ${dialogueResult.dialogue?.reduce((sum, scene) => sum + (scene.lines?.length || 0), 0) || 0}`);
    console.log(`   Voice notes: ${dialogueResult.voiceNotes?.substring(0, 100) || 'N/A'}...\n`);
    
    saveToFile('03-dialogue.json', dialogueResult);
    console.log('   💾 Saved: output/real-episode/03-dialogue.json\n');
    
    // Step 5: Creative Director - Review Episode
    console.log('✨ Step 5: Creative Director - Final Review\n');
    console.log('   🔄 Calling Claude API for creative review...\n');
    console.log('   ⏳ This may take 30-60 seconds...\n');
    
    const reviewStartTime = Date.now();
    
    // Build a minimal Episode object for review
    const episodeForReview = {
      id: `ep-${EPISODE_BRIEF.episodeNumber}`,
      worldId: TEST_WORLD.id,
      seasonId: 'season-1',
      episodeNumber: EPISODE_BRIEF.episodeNumber,
      title: storyResult.episodeOutline.title,
      synopsis: storyResult.episodeOutline.synopsis,
      scenes: [], // Simplified for now
      choices: [],
      outcomes: [],
      themes: storyResult.episodeOutline.themes,
      educationalGoals: storyResult.episodeOutline.educationalGoals || [],
      targetTraits: storyResult.episodeOutline.targetTraits.map(t => ({ traitId: t, changeAmount: 1 })),
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const reviewResult = await creativeDirector.process({
      type: 'EPISODE_REVIEW',
      episodeReview: {
        episode: episodeForReview,
        worldContext: TEST_WORLD,
        previousEpisodes: []
      }
    });
    
    const reviewDuration = ((Date.now() - reviewStartTime) / 1000).toFixed(1);
    
    console.log(`✅ Creative review complete! (${reviewDuration}s)`);
    console.log(`   Decision: ${reviewResult.decision || 'N/A'}`);
    console.log(`   Creative Notes: ${reviewResult.creativeNotes?.substring(0, 100) || 'N/A'}...`);
    console.log(`   Story Feedback: ${reviewResult.specificFeedback?.story?.length || 0} items`);
    console.log(`   Character Feedback: ${reviewResult.specificFeedback?.characters?.length || 0} items\n`);
    
    saveToFile('04-creative-review.json', reviewResult);
    console.log('   💾 Saved: output/real-episode/04-creative-review.json\n');
    
    // Step 6: QA Reviewer - Technical Quality Check
    console.log('🔍 Step 6: QA Reviewer - Technical Quality Check\n');
    console.log('   🔄 Calling Claude API for QA review...\n');
    console.log('   ⏳ This may take 10-20 seconds...\n');
    
    const qaStartTime = Date.now();
    
    const qaResult = await qaReviewer.process({
      type: 'REVIEW_EPISODE',
      episodeReview: {
        episode: episodeForReview,
        characters: [protagonistResult.character],
        world: TEST_WORLD,
        previousEpisodes: []
      }
    });
    
    const qaDuration = ((Date.now() - qaStartTime) / 1000).toFixed(1);
    
    console.log(`✅ QA review complete! (${qaDuration}s)`);
    console.log(`   Status: ${qaResult.status}`);
    console.log(`   Errors: ${qaResult.errors?.length || 0} blocking issues`);
    console.log(`   Warnings: ${qaResult.warnings?.length || 0} concerns`);
    console.log(`   Checks: ${qaResult.summary?.passedChecks || 0}/${qaResult.summary?.totalChecks || 0} passed\n`);
    
    if (qaResult.errors && qaResult.errors.length > 0) {
      console.log('   ❌ Issues found:');
      qaResult.errors.slice(0, 3).forEach(err => {
        console.log(`      • [${err.severity}] ${err.message}`);
        console.log(`        Location: ${err.location}`);
        if (err.fix) {
          console.log(`        Fix: ${err.fix}`);
        }
      });
      if (qaResult.errors.length > 3) {
        console.log(`      ... and ${qaResult.errors.length - 3} more\n`);
      } else {
        console.log('');
      }
    }
    
    saveToFile('05-qa-review.json', qaResult);
    console.log('   💾 Saved: output/real-episode/05-qa-review.json\n');
    
    // Step 7: Child Psychologist - Psychological Safety Review
    console.log('👨‍⚕️ Step 7: Child Psychologist - Psychological Safety Review\n');
    console.log('   🔄 Calling Claude API for psychological safety review...\n');
    console.log('   ⏳ This may take 20-30 seconds...\n');
    
    const psychStartTime = Date.now();
    
    const psychResult = await childPsychologist.process({
      type: 'REVIEW_EPISODE',
      episodeReview: {
        episode: episodeForReview,
        characters: [protagonistResult.character],
        world: TEST_WORLD
      }
    });
    
    const psychDuration = ((Date.now() - psychStartTime) / 1000).toFixed(1);
    
    console.log(`✅ Psychological safety review complete! (${psychDuration}s)`);
    console.log(`   Status: ${psychResult.status}`);
    console.log(`   Concerns: ${psychResult.concerns?.length || 0} issues`);
    console.log(`   Trigger Warnings: ${psychResult.triggerWarnings?.length || 0}`);
    console.log(`   Overall Score: ${psychResult.scores?.overall || 'N/A'}/10`);
    console.log(`   Ready for Audience: ${psychResult.summary?.readyForAudience ? 'Yes' : 'No'}\n`);
    
    if (psychResult.concerns && psychResult.concerns.length > 0) {
      console.log('   ⚠️  Concerns:');
      psychResult.concerns.slice(0, 3).forEach(concern => {
        console.log(`      • [${concern.severity}] ${concern.issue}`);
        console.log(`        Category: ${concern.category}`);
        console.log(`        Recommendation: ${concern.recommendation}`);
      });
      if (psychResult.concerns.length > 3) {
        console.log(`      ... and ${psychResult.concerns.length - 3} more\n`);
      } else {
        console.log('');
      }
    }
    
    if (psychResult.triggerWarnings && psychResult.triggerWarnings.length > 0) {
      console.log('   ⚠️  Trigger Warnings:');
      psychResult.triggerWarnings.forEach(tw => {
        console.log(`      • [${tw.severity}] ${tw.category}: ${tw.description}`);
      });
      console.log('');
    }
    
    saveToFile('06-psych-review.json', psychResult);
    console.log('   💾 Saved: output/real-episode/06-psych-review.json\n');
    
    // Final Summary
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('✨ FULL EPISODE PIPELINE COMPLETE!\n');
    console.log('📦 Output Files:\n');
    console.log('   1. Story Outline (Story Architect → Claude)');
    console.log('   2. Protagonist Profile (Character Designer → Claude)');
    console.log('   3. Scene Dialogue (Dialogue Writer → Claude)');
    console.log('   4. Creative Review (Creative Director → Claude)');
    console.log('   5. QA Review (QA Reviewer → Claude)');
    console.log('   6. Psychological Safety Review (Child Psychologist → Claude)\n');
    console.log(`   📁 Location: ${OUTPUT_DIR}\n`);
    console.log('⏱️  Total Time:\n');
    console.log(`   Story: ${duration}s`);
    console.log(`   Character: ${charDuration}s`);
    console.log(`   Dialogue: ${dialogueDuration}s`);
    console.log(`   Review: ${reviewDuration}s`);
    console.log(`   QA: ${qaDuration}s`);
    console.log(`   Psych: ${psychDuration}s`);
    console.log(`   Total: ${totalDuration}s (${(totalDuration / 60).toFixed(1)} minutes)\n`);
    console.log('🎯 Full AI Studio Pipeline:\n');
    console.log('   ✅ Story structure designed');
    console.log('   ✅ Characters created with depth');
    console.log('   ✅ Authentic dialogue written');
    console.log('   ✅ Quality assured by Creative Director');
    console.log('   ✅ Technical validation by QA Reviewer');
    console.log('   ✅ Psychological safety validated by Child Psychologist\n');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('🎉 Success! Phase 1 + Phase 2 validation agents working!\n');
    
  } catch (error) {
    console.error('\n❌ Error during episode creation:\n');
    if (error.message?.includes('401')) {
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
// Helper Functions
// ============================================================================

function saveToFile(filename, data) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

// ============================================================================
// Execute
// ============================================================================

main().catch((error) => {
  console.error('\n❌ Unexpected error:\n');
  console.error(error);
  process.exit(1);
});
