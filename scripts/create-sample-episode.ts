/**
 * Sample Episode Creation Workflow
 * 
 * Demonstrates the full Phase 1 content-creation pipeline:
 * Story Architect → Character Designer → Dialogue Writer → Creative Director
 * 
 * Creates a complete episode using all 4 agents.
 */

import { 
  StoryArchitectAgent,
  CharacterDesignerAgent,
  DialogueWriterAgent,
  CreativeDirectorAgent
} from '@mirror/agents';
import { createMessageBus } from '@mirror/message-bus';
import { createMemorySystem } from '@mirror/memory';
import { createLLMGateway } from '@mirror/agents';
import { v4 as uuidv4 } from 'uuid';
import type { World, Character } from '@mirror/schemas';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Configuration
// ============================================================================

const OUTPUT_DIR = path.join(__dirname, '../output/sample-episode');

const EPISODE_BRIEF = {
  world: 'New School',
  worldId: 'NEW_SCHOOL' as const,
  season: 'Season 1: First Year',
  episodeNumber: 1,
  title: 'First Day',
  themes: ['Belonging', 'Authenticity', 'First Impressions'],
  targetTraits: ['CONFIDENCE', 'EMPATHY', 'ADAPTABILITY'] as const,
  synopsis: 'Alex starts their first day at a new middle school after moving to a new city. They must navigate unfamiliar hallways, make new friends, and decide how much of their true self to show.'
};

const TEST_WORLD: World = {
  id: 'NEW_SCHOOL',
  name: 'New School',
  description: 'A contemporary middle school setting where students navigate friendships, identity, and growing up',
  themes: ['Belonging', 'Authenticity', 'Friendship', 'Identity'],
  targetAge: [11, 14] as [number, number],
  seasons: ['Season 1: First Year']
};

// ============================================================================
// Main Workflow
// ============================================================================

async function main() {
  console.log('🎬 SAMPLE EPISODE CREATION WORKFLOW\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Step 0: Prerequisites
  console.log('📋 Step 0: Checking Prerequisites\n');
  
  const hasApiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
  if (!hasApiKey) {
    console.error('❌ Error: No LLM API key found!');
    console.error('   Set ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable.\n');
    console.error('   Example:');
    console.error('   export ANTHROPIC_API_KEY="your-key-here"\n');
    process.exit(1);
  }
  
  console.log('✅ API key found');
  console.log(`   Provider: ${process.env.ANTHROPIC_API_KEY ? 'Claude (Anthropic)' : 'GPT (OpenAI)'}\n`);
  
  // Step 1: Initialize Infrastructure
  console.log('🔧 Step 1: Initializing Infrastructure\n');
  
  const workflowId = uuidv4();
  const threadId = uuidv4();
  
  console.log(`   Workflow ID: ${workflowId}`);
  console.log(`   Thread ID: ${threadId}\n`);
  
  const messageBus = await createMessageBus({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  });
  console.log('✅ Message Bus connected');
  
  const memory = await createMemorySystem({
    postgres: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'mirror_studio',
      user: process.env.POSTGRES_USER || 'mirror_user',
      password: process.env.POSTGRES_PASSWORD || 'mirror_pass'
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    }
  });
  console.log('✅ Memory System connected');
  
  const llm = createLLMGateway({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    defaultProvider: process.env.ANTHROPIC_API_KEY ? 'claude' : 'gpt'
  });
  console.log('✅ LLM Gateway ready\n');
  
  // Step 2: Initialize Agents
  console.log('🤖 Step 2: Initializing Agents\n');
  
  const storyArchitect = new StoryArchitectAgent();
  const characterDesigner = new CharacterDesignerAgent();
  const dialogueWriter = new DialogueWriterAgent();
  const creativeDirector = new CreativeDirectorAgent();
  
  await Promise.all([
    storyArchitect.initialize({ workflowId, threadId, messageBus, memory, llm }),
    characterDesigner.initialize({ workflowId, threadId, messageBus, memory, llm }),
    dialogueWriter.initialize({ workflowId, threadId, messageBus, memory, llm }),
    creativeDirector.initialize({ workflowId, threadId, messageBus, memory, llm })
  ]);
  
  console.log('✅ Story Architect (River) ready');
  console.log('✅ Character Designer (Kai) ready');
  console.log('✅ Dialogue Writer (Echo) ready');
  console.log('✅ Creative Director (Aria) ready\n');
  
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Step 3: Story Architect - Create Episode Outline
  console.log('📖 Step 3: Story Architect - Creating Episode Outline\n');
  console.log(`   Episode: "${EPISODE_BRIEF.title}"`);
  console.log(`   Synopsis: ${EPISODE_BRIEF.synopsis}\n`);
  console.log('   ⏳ This may take 30-60 seconds...\n');
  
  const storyResult = await storyArchitect.process({
    type: 'NEW_EPISODE',
    brief: {
      world: EPISODE_BRIEF.world,
      season: EPISODE_BRIEF.season,
      episodeNumber: EPISODE_BRIEF.episodeNumber,
      themes: EPISODE_BRIEF.themes,
      targetTraits: EPISODE_BRIEF.targetTraits,
      characters: [] // Will be populated by Character Designer
    }
  });
  
  console.log('✅ Episode outline created!');
  console.log(`   Title: ${storyResult.episodeOutline.title}`);
  console.log(`   Scenes: ${storyResult.episodeOutline.scenes.length}`);
  console.log(`   Choice Points: ${storyResult.episodeOutline.choicePoints.length}`);
  console.log(`   Branches: ${storyResult.episodeOutline.branches.length}`);
  console.log(`   Estimated Play Time: ${storyResult.episodeOutline.estimatedPlayTime} minutes\n`);
  
  // Save outline
  saveToFile('01-story-outline.json', storyResult);
  console.log('   💾 Saved: output/sample-episode/01-story-outline.json\n');
  
  // Step 4: Character Designer - Create Characters
  console.log('👥 Step 4: Character Designer - Creating Characters\n');
  console.log('   ⏳ Creating protagonist and supporting characters...\n');
  
  // Create protagonist
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
  
  console.log('✅ Protagonist created!');
  console.log(`   Name: ${protagonistResult.character?.name}`);
  console.log(`   Age: ${protagonistResult.character?.age}`);
  console.log(`   Pronouns: ${protagonistResult.character?.pronouns}`);
  console.log(`   Role: ${protagonistResult.character?.storyRole}\n`);
  
  saveToFile('02-protagonist.json', protagonistResult);
  console.log('   💾 Saved: output/sample-episode/02-protagonist.json\n');
  
  // Create supporting character
  const supportingResult = await characterDesigner.process({
    type: 'NEW_CHARACTER',
    newCharacter: {
      world: TEST_WORLD,
      role: 'SUPPORTING',
      requirements: [
        {
          trait: 'Friendly and welcoming',
          importance: 'HIGH'
        },
        {
          trait: 'Helps protagonist feel comfortable',
          importance: 'MEDIUM'
        }
      ],
      relationshipContext: protagonistResult.character ? [protagonistResult.character] : []
    }
  });
  
  console.log('✅ Supporting character created!');
  console.log(`   Name: ${supportingResult.character?.name}`);
  console.log(`   Age: ${supportingResult.character?.age}`);
  console.log(`   Pronouns: ${supportingResult.character?.pronouns}`);
  console.log(`   Role: ${supportingResult.character?.storyRole}\n`);
  
  saveToFile('03-supporting-character.json', supportingResult);
  console.log('   💾 Saved: output/sample-episode/03-supporting-character.json\n');
  
  // Step 5: Dialogue Writer - Write Dialogue
  console.log('💬 Step 5: Dialogue Writer - Writing Episode Dialogue\n');
  console.log('   ⏳ Writing authentic teen dialogue...\n');
  
  const characters: Character[] = [
    protagonistResult.character!,
    supportingResult.character!
  ];
  
  const dialogueResult = await dialogueWriter.process({
    type: 'WRITE_DIALOGUE',
    writeRequest: {
      episodeOutline: storyResult.episodeOutline,
      characters: characters,
      scenes: storyResult.episodeOutline.scenes,
      emotionalBeats: storyResult.episodeOutline.emotionalArc,
      choicePoints: storyResult.episodeOutline.choicePoints
    }
  });
  
  console.log('✅ Dialogue written!');
  console.log(`   Total scenes: ${dialogueResult.dialogue.length}`);
  console.log(`   Choice dialogue sets: ${dialogueResult.choiceDialogue.length}`);
  console.log(`   Voice notes: ${dialogueResult.voiceNotes}\n`);
  
  saveToFile('04-dialogue.json', dialogueResult);
  console.log('   💾 Saved: output/sample-episode/04-dialogue.json\n');
  
  // Step 6: Creative Director - Review Episode
  console.log('🎨 Step 6: Creative Director - Reviewing Episode\n');
  console.log('   ⏳ Evaluating creative quality...\n');
  
  const mockEpisode = {
    id: uuidv4(),
    worldId: EPISODE_BRIEF.worldId,
    seasonId: uuidv4(),
    episodeNumber: EPISODE_BRIEF.episodeNumber,
    title: storyResult.episodeOutline.title,
    synopsis: storyResult.episodeOutline.synopsis,
    themes: EPISODE_BRIEF.themes,
    targetTraits: EPISODE_BRIEF.targetTraits,
    targetAge: [11, 14] as [number, number],
    scenes: [],
    characters: characters.map(c => c.id),
    estimatedPlayTime: storyResult.episodeOutline.estimatedPlayTime,
    metadata: {
      createdBy: ['STORY_ARCHITECT', 'CHARACTER_DESIGNER', 'DIALOGUE_WRITER'] as const,
      createdAt: new Date().toISOString(),
      version: 1,
      status: 'DRAFT' as const
    }
  };
  
  const reviewResult = await creativeDirector.process({
    type: 'EPISODE_REVIEW',
    episodeReview: {
      episode: mockEpisode,
      worldContext: TEST_WORLD,
      previousEpisodes: []
    }
  });
  
  console.log('✅ Creative review complete!');
  console.log(`   Decision: ${reviewResult.decision}`);
  console.log(`   Priority: ${reviewResult.revisionPriority}`);
  console.log(`\n   Creative Notes:\n   ${reviewResult.creativeNotes}\n`);
  
  if (reviewResult.specificFeedback.story && reviewResult.specificFeedback.story.length > 0) {
    console.log('   Story Feedback:');
    reviewResult.specificFeedback.story.forEach(note => console.log(`   - ${note}`));
    console.log();
  }
  
  saveToFile('05-creative-review.json', reviewResult);
  console.log('   💾 Saved: output/sample-episode/05-creative-review.json\n');
  
  // Final Summary
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('✨ EPISODE CREATION COMPLETE!\n');
  console.log('📦 Output Files:\n');
  console.log('   1. Story Outline (from Story Architect)');
  console.log('   2. Protagonist Profile (from Character Designer)');
  console.log('   3. Supporting Character Profile (from Character Designer)');
  console.log('   4. Complete Dialogue (from Dialogue Writer)');
  console.log('   5. Creative Review (from Creative Director)\n');
  console.log(`   Location: ${OUTPUT_DIR}\n`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Cleanup
  await messageBus.disconnect();
  await memory.disconnect();
  
  console.log('🎉 Success! All Phase 1 agents working together.\n');
}

// ============================================================================
// Helper Functions
// ============================================================================

function saveToFile(filename: string, data: any): void {
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
  console.error('\n❌ Error during episode creation:\n');
  console.error(error);
  process.exit(1);
});
