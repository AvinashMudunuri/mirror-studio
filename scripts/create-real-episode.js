#!/usr/bin/env node

/**
 * Simple Real Episode Creation
 * Uses built JS files directly (no TypeScript compilation needed)
 */

const path = require('path');
const fs = require('fs');

// Import from built packages (resolve from script location)
const packageRoot = path.resolve(__dirname, '..');
const agentsPath = path.join(packageRoot, 'packages', 'agents', 'dist', 'index.js');

const { 
  StoryArchitectAgent,
  CharacterDesignerAgent,
  DialogueWriterAgent,
  CreativeDirectorAgent,
  createLLMGateway
} = require(agentsPath);

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
    })
  ]);
  
  console.log('✅ Story Architect (River) ready');
  console.log('✅ Character Designer (Kai) ready');
  console.log('✅ Dialogue Writer (Echo) ready');
  console.log('✅ Creative Director (Aria) ready\n');
  
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
    
    // Pick the first scene as a sample
    const firstScene = storyResult.episodeOutline.scenes[0];
    
    const dialogueResult = await dialogueWriter.process({
      type: 'WRITE_SCENE',
      writeScene: {
        scene: firstScene,
        characters: [protagonistResult.character],
        worldContext: {
          name: TEST_WORLD.name,
          setting: TEST_WORLD.setting,
          tone: TEST_WORLD.tone
        },
        previousSceneSummary: 'Episode opening - protagonist arrives at new school',
        emotionalTarget: firstScene.emotionalBeat
      }
    });
    
    const dialogueDuration = ((Date.now() - dialogueStartTime) / 1000).toFixed(1);
    
    console.log(`✅ Dialogue created! (${dialogueDuration}s)`);
    console.log(`   Scene: ${firstScene.title}`);
    console.log(`   Lines: ${dialogueResult.sceneDialogue?.lines?.length || 0}`);
    console.log(`   Atmosphere: ${dialogueResult.sceneDialogue?.atmosphere || 'N/A'}\n`);
    
    saveToFile('03-dialogue.json', dialogueResult);
    console.log('   💾 Saved: output/real-episode/03-dialogue.json\n');
    
    // Step 5: Creative Director - Review Episode
    console.log('✨ Step 5: Creative Director - Final Review\n');
    console.log('   🔄 Calling Claude API for creative review...\n');
    console.log('   ⏳ This may take 30-60 seconds...\n');
    
    const reviewStartTime = Date.now();
    
    const reviewResult = await creativeDirector.process({
      type: 'REVIEW_EPISODE',
      episodeReview: {
        outline: storyResult.episodeOutline,
        characters: [protagonistResult.character],
        sampleDialogue: dialogueResult.sceneDialogue,
        world: TEST_WORLD,
        reviewFocus: ['emotional_resonance', 'world_consistency', 'character_authenticity']
      }
    });
    
    const reviewDuration = ((Date.now() - reviewStartTime) / 1000).toFixed(1);
    
    console.log(`✅ Creative review complete! (${reviewDuration}s)`);
    console.log(`   Overall Assessment: ${reviewResult.feedback?.overallAssessment || 'N/A'}`);
    console.log(`   Strengths: ${reviewResult.feedback?.strengths?.length || 0}`);
    console.log(`   Improvements: ${reviewResult.feedback?.improvements?.length || 0}`);
    console.log(`   Approved: ${reviewResult.decision?.approved ? 'YES ✅' : 'NO ❌'}\n`);
    
    saveToFile('04-creative-review.json', reviewResult);
    console.log('   💾 Saved: output/real-episode/04-creative-review.json\n');
    
    // Final Summary
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('✨ FULL EPISODE PIPELINE COMPLETE!\n');
    console.log('📦 Output Files:\n');
    console.log('   1. Story Outline (Story Architect → Claude)');
    console.log('   2. Protagonist Profile (Character Designer → Claude)');
    console.log('   3. Scene Dialogue (Dialogue Writer → Claude)');
    console.log('   4. Creative Review (Creative Director → Claude)\n');
    console.log(`   📁 Location: ${OUTPUT_DIR}\n`);
    console.log('⏱️  Total Time:\n');
    console.log(`   Story: ${duration}s`);
    console.log(`   Character: ${charDuration}s`);
    console.log(`   Dialogue: ${dialogueDuration}s`);
    console.log(`   Review: ${reviewDuration}s`);
    console.log(`   Total: ${totalDuration}s (${(totalDuration / 60).toFixed(1)} minutes)\n`);
    console.log('🎯 Full AI Studio Pipeline:\n');
    console.log('   ✅ Story structure designed');
    console.log('   ✅ Characters created with depth');
    console.log('   ✅ Authentic dialogue written');
    console.log('   ✅ Quality assured by Creative Director\n');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('🎉 Success! All 4 Phase 1 agents working with Claude 5!\n');
    
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
