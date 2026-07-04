/**
 * Phase 1: Build Story Architect Agent using Developer Agent
 * 
 * This script demonstrates AI building AI:
 * - Developer Agent (built in Phase 0) generates Story Architect
 * - Story Architect will then create episode outlines
 * 
 * Prerequisites:
 * - Docker containers running (PostgreSQL + Redis)
 * - API keys configured in .env
 * - Phase 0 complete
 */

import { DeveloperAgent } from '../packages/agents/src/developer-agent';
import { createMessageBus } from '../packages/message-bus/src';
import { createMemorySystem } from '../packages/memory/src';
import { createLLMGateway } from '../packages/agents/src/llm-gateway';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🚀 Phase 1: Building Story Architect Agent\n');
  
  // Check prerequisites
  console.log('Checking prerequisites...');
  
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    console.error('❌ Error: No API keys found in environment');
    console.error('   Please add ANTHROPIC_API_KEY or OPENAI_API_KEY to your .env file');
    process.exit(1);
  }
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL not found');
    console.error('   Please ensure Docker is running: docker-compose up -d');
    process.exit(1);
  }
  
  console.log('✅ Prerequisites checked\n');
  
  // Initialize infrastructure
  console.log('Initializing infrastructure...');
  
  const messageBus = await createMessageBus({
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
  });
  
  const memory = createMemorySystem({
    databaseUrl: process.env.DATABASE_URL!,
    openaiApiKey: process.env.OPENAI_API_KEY
  });
  
  const llm = createLLMGateway({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    defaultProvider: 'claude',
    defaultModel: 'claude-sonnet-4.5'
  });
  
  console.log('✅ Infrastructure initialized\n');
  
  // Create Developer Agent
  console.log('Creating Developer Agent...');
  
  const developer = new DeveloperAgent();
  
  await developer.initialize({
    workflowId: uuidv4(),
    threadId: uuidv4(),
    messageBus,
    memory,
    llm
  });
  
  console.log('✅ Developer Agent ready\n');
  
  // Load Story Architect specification
  console.log('Loading Story Architect specification...');
  
  const specPath = path.join(__dirname, '../docs/specs/story-architect-spec.md');
  const spec = fs.readFileSync(specPath, 'utf-8');
  
  console.log('✅ Specification loaded\n');
  
  // Ask Developer Agent to build Story Architect
  console.log('🤖 Developer Agent: Building Story Architect...');
  console.log('   (This may take 1-2 minutes)\n');
  
  const startTime = Date.now();
  
  const result = await developer.process({
    type: 'WRITE_AGENT',
    agentSpec: {
      id: 'STORY_ARCHITECT',
      name: 'River',
      role: 'Lead Story Designer',
      mission: 'Design emotionally engaging story structures that create meaningful choices and support educational goals invisibly',
      expertise: [
        'Story structure',
        'Choice architecture',
        'Branching narrative design',
        'Pacing',
        'Conflict escalation',
        'Emotional arc mapping',
        'Trait-to-choice mapping'
      ],
      responsibilities: [
        'Create episode outlines with scene-by-scene breakdown',
        'Design choice points that feel natural and meaningful',
        'Map story beats to trait-development opportunities',
        'Ensure replayability through divergent paths',
        'Balance educational goals with engagement',
        'Collaborate with Character Designer on character arcs'
      ]
    }
  });
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log(`✅ Story Architect generated in ${duration}s\n`);
  
  // Save generated code
  console.log('Saving generated code...');
  
  if (result.files && result.files.length > 0) {
    for (const file of result.files) {
      const outputPath = path.join(__dirname, '..', file.path);
      const outputDir = path.dirname(outputPath);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Write file
      fs.writeFileSync(outputPath, file.content, 'utf-8');
      console.log(`   ✅ ${file.path}`);
    }
  }
  
  console.log('\n📝 Explanation:');
  console.log(result.explanation);
  
  if (result.dependencies && result.dependencies.length > 0) {
    console.log('\n📦 Dependencies needed:');
    console.log(`   ${result.dependencies.join(', ')}`);
  }
  
  if (result.nextSteps && result.nextSteps.length > 0) {
    console.log('\n✨ Next steps:');
    result.nextSteps.forEach((step, i) => {
      console.log(`   ${i + 1}. ${step}`);
    });
  }
  
  // Cleanup
  await developer.shutdown();
  await messageBus.disconnect();
  await memory.close();
  
  console.log('\n✅ Phase 1 Step 1 Complete: Story Architect generated!');
  console.log('\nNext: Review the generated code and test it.');
}

// Run
main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
