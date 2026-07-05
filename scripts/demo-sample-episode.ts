/**
 * Sample Episode Creation - Demo Mode
 * 
 * Demonstrates the full Phase 1 content-creation pipeline with mock data.
 * This version runs without requiring infrastructure or API keys.
 * 
 * For the real version with LLM calls, use: npm run sample:episode
 */

import { 
  StoryArchitectAgent,
  CharacterDesignerAgent,
  DialogueWriterAgent,
  CreativeDirectorAgent
} from '@mirror/agents';
import type { World } from '@mirror/schemas';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Configuration
// ============================================================================

const OUTPUT_DIR = path.join(__dirname, '../output/demo-episode');

const EPISODE_BRIEF = {
  world: 'New School',
  worldId: 'NEW_SCHOOL' as const,
  season: 'Season 1: First Year',
  episodeNumber: 1,
  title: 'First Day',
  themes: ['Belonging', 'Authenticity', 'First Impressions'],
  targetTraits: ['CONFIDENCE', 'EMPATHY', 'ADAPTABILITY'] as const,
  synopsis: 'Alex starts their first day at a new middle school. They must navigate unfamiliar hallways, make new friends, and decide how much of their true self to show.'
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
// Mock Data (Simulating LLM Responses)
// ============================================================================

const MOCK_STORY_OUTLINE = {
  episodeOutline: {
    title: 'First Day',
    synopsis: 'Alex navigates their first day at Jefferson Middle School after moving from another city.',
    themes: ['Belonging', 'Authenticity', 'First Impressions'],
    targetTraits: ['CONFIDENCE', 'EMPATHY', 'ADAPTABILITY'],
    scenes: [
      {
        id: 'scene-1',
        title: 'Arrival',
        location: 'School Entrance',
        characters: ['alex'],
        duration: 2,
        description: 'Alex arrives at the school, feeling nervous',
        emotionalBeat: 'Anxiety and hope'
      },
      {
        id: 'scene-2',
        title: 'Lost in Hallways',
        location: 'School Hallway',
        characters: ['alex', 'jordan'],
        duration: 3,
        description: 'Alex gets lost trying to find their homeroom',
        emotionalBeat: 'Embarrassment turning to relief'
      },
      {
        id: 'scene-3',
        title: 'Lunch Table Decision',
        location: 'Cafeteria',
        characters: ['alex', 'jordan', 'casey'],
        duration: 4,
        description: 'Alex must choose where to sit at lunch',
        emotionalBeat: 'Social anxiety and decision pressure'
      }
    ],
    choicePoints: [
      {
        id: 'choice-1',
        scene: 'scene-2',
        prompt: 'Jordan offers to help you find your class. How do you respond?',
        options: [
          { id: 'opt-1a', text: 'Accept gratefully' },
          { id: 'opt-1b', text: 'Politely decline, try alone' }
        ]
      },
      {
        id: 'choice-2',
        scene: 'scene-3',
        prompt: 'Where do you sit at lunch?',
        options: [
          { id: 'opt-2a', text: 'With Jordan at their table' },
          { id: 'opt-2b', text: 'Alone to observe' }
        ]
      }
    ],
    branches: [
      {
        id: 'branch-friendly',
        name: 'Opening Up',
        triggeredBy: ['opt-1a', 'opt-2a'],
        description: 'Alex makes friends quickly',
        outcome: 'Strong initial friendship with Jordan'
      },
      {
        id: 'branch-cautious',
        name: 'Taking It Slow',
        triggeredBy: ['opt-1b', 'opt-2b'],
        description: 'Alex observes before committing',
        outcome: 'Slower friendship development but careful choices'
      }
    ],
    emotionalArc: [
      { scene: 'scene-1', emotion: 'Nervous', intensity: 7, description: 'First day jitters' },
      { scene: 'scene-2', emotion: 'Relieved', intensity: 5, description: 'Help arrives' },
      { scene: 'scene-3', emotion: 'Hopeful', intensity: 6, description: 'Potential friendship' }
    ],
    characterArcs: [
      {
        characterId: 'alex',
        startState: 'Nervous outsider',
        endState: 'Cautiously hopeful',
        keyMoments: ['scene-1', 'scene-2', 'scene-3']
      }
    ],
    traitMapping: [],
    relationshipDynamics: [],
    replayHooks: ['Try different lunch choices', 'See alternate friendship paths'],
    estimatedPlayTime: 12,
    educationalGoals: ['Practice social courage', 'Learn to ask for help'],
    conversationStarters: ['What was your first day at a new school like?']
  },
  designNotes: 'Focus on relatable first-day anxiety with hopeful outcome'
};

const MOCK_PROTAGONIST = {
  character: {
    id: 'alex-001',
    name: 'Alex Chen',
    age: 12,
    pronouns: 'they/them',
    appearance: {
      brief: 'East Asian, medium height, glasses',
      distinctiveFeatures: ['Star-patterned backpack', 'Graphic novel keychain']
    },
    personality: {
      coreTraits: ['Thoughtful', 'Creative', 'Observant'],
      bigFiveProfile: {
        openness: 75,
        conscientiousness: 60,
        extraversion: 45,
        agreeableness: 70,
        neuroticism: 55
      },
      mannerisms: ['Adjusts glasses when nervous', 'Doodles when thinking'],
      speechPatterns: ['Thoughtful pauses', 'Uses "like" and "kinda"'],
      emotionalTendencies: 'Processes internally before expressing'
    },
    background: {
      family: 'Two parents, older sister away at college',
      interests: ['Graphic novels', 'Drawing', 'Video games'],
      strengths: ['Creative', 'Empathetic', 'Good listener'],
      struggles: ['Social anxiety', 'Fear of judgment'],
      secrets: ['Writes and draws their own comic series']
    },
    goals: {
      conscious: ['Make friends', 'Fit in'],
      unconscious: ['Be accepted for who they are', 'Find their people']
    },
    relationships: {},
    voiceGuidelines: {
      vocabularyLevel: 'Age-appropriate 12-year-old',
      sentenceComplexity: 'Simple to moderate',
      emotionalExpressiveness: 'Reserved but genuine',
      examples: ['Um, hi?', 'That\'s actually pretty cool.', 'I guess I could try...']
    },
    storyRole: 'Protagonist - relatable middle schooler',
    worldId: 'NEW_SCHOOL'
  },
  designNotes: 'Relatable protagonist for 11-14 age group'
};

const MOCK_SUPPORTING = {
  character: {
    id: 'jordan-001',
    name: 'Jordan Park',
    age: 13,
    pronouns: 'she/her',
    appearance: {
      brief: 'Korean American, athletic build, always smiling',
      distinctiveFeatures: ['Soccer team jacket', 'Colorful friendship bracelets']
    },
    personality: {
      coreTraits: ['Outgoing', 'Welcoming', 'Energetic'],
      bigFiveProfile: {
        openness: 80,
        conscientiousness: 65,
        extraversion: 85,
        agreeableness: 80,
        neuroticism: 30
      },
      mannerisms: ['Waves enthusiastically', 'Laughs easily'],
      speechPatterns: ['Upbeat tone', 'Uses encouraging language'],
      emotionalTendencies: 'Openly expressive and warm'
    },
    background: {
      family: 'Large extended family, two younger siblings',
      interests: ['Soccer', 'Making friends', 'Organizing events'],
      strengths: ['Social connector', 'Empathetic', 'Natural leader'],
      struggles: ['Sometimes too eager', 'Doesn\'t always read the room'],
      secrets: []
    },
    goals: {
      conscious: ['Be a good friend', 'Make everyone feel welcome'],
      unconscious: ['Be needed', 'Avoid being alone']
    },
    relationships: {},
    voiceGuidelines: {
      vocabularyLevel: 'Age-appropriate 13-year-old',
      sentenceComplexity: 'Enthusiastic and flowing',
      emotionalExpressiveness: 'Very open and warm',
      examples: ['Hey! You look lost, need help?', 'Oh my god, that\'s so cool!', 'Come sit with us!']
    },
    storyRole: 'Supporting - welcoming friend',
    worldId: 'NEW_SCHOOL'
  },
  designNotes: 'Warm, welcoming character to help protagonist feel comfortable'
};

const MOCK_DIALOGUE = {
  dialogue: [
    {
      sceneId: 'scene-1',
      lines: [
        {
          id: 'line-1',
          character: 'NARRATOR',
          text: 'Your heart is pounding as you stand in front of Jefferson Middle School.',
          emotion: 'ANXIOUS'
        },
        {
          id: 'line-2',
          character: 'INTERNAL',
          text: 'Okay. Deep breath. You can do this.',
          emotion: 'ANXIOUS'
        }
      ]
    },
    {
      sceneId: 'scene-2',
      lines: [
        {
          id: 'line-3',
          character: 'jordan-001',
          text: 'Hey! You look lost. First day?',
          emotion: 'HAPPY'
        },
        {
          id: 'line-4',
          character: 'alex-001',
          text: 'Um, yeah. I can\'t find room 214.',
          emotion: 'NERVOUS'
        },
        {
          id: 'line-5',
          character: 'jordan-001',
          text: 'Oh, I know where that is! Want me to show you?',
          emotion: 'HAPPY'
        }
      ]
    }
  ],
  choiceDialogue: [
    {
      choiceId: 'choice-1',
      options: [
        { id: 'opt-1a', text: 'That would be amazing, thank you!' },
        { id: 'opt-1b', text: 'Thanks, but I think I can find it.' }
      ],
      responseDialogue: {
        'opt-1a': [
          {
            id: 'resp-1a-1',
            character: 'jordan-001',
            text: 'Awesome! I\'m Jordan, by the way.',
            emotion: 'HAPPY'
          }
        ],
        'opt-1b': [
          {
            id: 'resp-1b-1',
            character: 'jordan-001',
            text: 'Oh, okay! Good luck!',
            emotion: 'NEUTRAL'
          }
        ]
      }
    }
  ],
  voiceNotes: 'Dialogue maintains authentic 11-14 year old voice with appropriate nervousness and warmth'
};

const MOCK_CREATIVE_REVIEW = {
  decision: 'APPROVED',
  creativeNotes: 'Strong first episode that captures the universal first-day anxiety while remaining hopeful. The choices feel natural and the emotional beats are earned.',
  specificFeedback: {
    story: [
      'Pacing is appropriate for target age',
      'Choice points feel organic to the situation',
      'Good balance of tension and hope'
    ],
    character: [
      'Alex is immediately relatable',
      'Jordan provides warmth without being unrealistic',
      'Character voices are distinct and age-appropriate'
    ],
    dialogue: [
      'Natural teen speech patterns',
      'Good use of internal monologue',
      'Dialogue advances both plot and character'
    ],
    tone: [
      'Strikes right balance between realistic and hopeful',
      'Emotionally resonant for target audience'
    ]
  },
  inspirationReferences: [],
  revisionPriority: 'LOW'
};

// ============================================================================
// Demo Workflow
// ============================================================================

async function main() {
  console.log('🎬 SAMPLE EPISODE CREATION - DEMO MODE\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('⚡ Running in DEMO mode (no API calls or infrastructure required)\n');
  console.log('   This demonstrates the workflow with mock data.');
  console.log('   For real LLM-powered creation, use: npm run sample:episode\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Step 1: Initialize Agents (Show configuration)
  console.log('🤖 Step 1: Agent Configuration\n');
  
  const storyArchitect = new StoryArchitectAgent();
  const characterDesigner = new CharacterDesignerAgent();
  const dialogueWriter = new DialogueWriterAgent();
  const creativeDirector = new CreativeDirectorAgent();
  
  console.log('✅ Story Architect (River)');
  console.log(`   Role: ${storyArchitect['config'].role}`);
  console.log(`   Model: ${storyArchitect['config'].model}`);
  console.log(`   Temperature: ${storyArchitect['config'].temperature}\n`);
  
  console.log('✅ Character Designer (Kai)');
  console.log(`   Role: ${characterDesigner['config'].role}`);
  console.log(`   Model: ${characterDesigner['config'].model}`);
  console.log(`   Temperature: ${characterDesigner['config'].temperature}\n`);
  
  console.log('✅ Dialogue Writer (Echo)');
  console.log(`   Role: ${dialogueWriter['config'].role}`);
  console.log(`   Model: ${dialogueWriter['config'].model}`);
  console.log(`   Temperature: ${dialogueWriter['config'].temperature}\n`);
  
  console.log('✅ Creative Director (Aria)');
  console.log(`   Role: ${creativeDirector['config'].role}`);
  console.log(`   Model: ${creativeDirector['config'].model}`);
  console.log(`   Temperature: ${creativeDirector['config'].temperature}\n`);
  
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Step 2: Story Architect
  console.log('📖 Step 2: Story Architect - Episode Outline\n');
  console.log(`   Episode: "${EPISODE_BRIEF.title}"`);
  console.log(`   Synopsis: ${EPISODE_BRIEF.synopsis}\n`);
  console.log('   📝 Creating episode structure with scenes and choices...\n');
  
  const storyResult = MOCK_STORY_OUTLINE;
  
  console.log('✅ Episode outline created!');
  console.log(`   Title: ${storyResult.episodeOutline.title}`);
  console.log(`   Scenes: ${storyResult.episodeOutline.scenes.length}`);
  console.log(`   Choice Points: ${storyResult.episodeOutline.choicePoints.length}`);
  console.log(`   Branches: ${storyResult.episodeOutline.branches.length}`);
  console.log(`   Estimated Play Time: ${storyResult.episodeOutline.estimatedPlayTime} minutes\n`);
  
  saveToFile('01-story-outline.json', storyResult);
  console.log('   💾 Saved: output/demo-episode/01-story-outline.json\n');
  
  // Step 3: Character Designer - Protagonist
  console.log('👥 Step 3: Character Designer - Creating Characters\n');
  console.log('   📝 Designing protagonist with psychological depth...\n');
  
  const protagonistResult = MOCK_PROTAGONIST;
  
  console.log('✅ Protagonist created!');
  console.log(`   Name: ${protagonistResult.character.name}`);
  console.log(`   Age: ${protagonistResult.character.age}`);
  console.log(`   Pronouns: ${protagonistResult.character.pronouns}`);
  console.log(`   Personality: ${protagonistResult.character.personality.coreTraits.join(', ')}`);
  console.log(`   Role: ${protagonistResult.character.storyRole}\n`);
  
  saveToFile('02-protagonist.json', protagonistResult);
  console.log('   💾 Saved: output/demo-episode/02-protagonist.json\n');
  
  // Step 4: Character Designer - Supporting Character
  console.log('   📝 Designing supporting character...\n');
  
  const supportingResult = MOCK_SUPPORTING;
  
  console.log('✅ Supporting character created!');
  console.log(`   Name: ${supportingResult.character.name}`);
  console.log(`   Age: ${supportingResult.character.age}`);
  console.log(`   Pronouns: ${supportingResult.character.pronouns}`);
  console.log(`   Personality: ${supportingResult.character.personality.coreTraits.join(', ')}`);
  console.log(`   Role: ${supportingResult.character.storyRole}\n`);
  
  saveToFile('03-supporting-character.json', supportingResult);
  console.log('   💾 Saved: output/demo-episode/03-supporting-character.json\n');
  
  // Step 5: Dialogue Writer
  console.log('💬 Step 5: Dialogue Writer - Writing Dialogue\n');
  console.log('   📝 Writing authentic teen dialogue with character voices...\n');
  
  const dialogueResult = MOCK_DIALOGUE;
  
  console.log('✅ Dialogue written!');
  console.log(`   Total scenes: ${dialogueResult.dialogue.length}`);
  console.log(`   Choice dialogue sets: ${dialogueResult.choiceDialogue.length}`);
  console.log(`   Voice notes: ${dialogueResult.voiceNotes}\n`);
  
  saveToFile('04-dialogue.json', dialogueResult);
  console.log('   💾 Saved: output/demo-episode/04-dialogue.json\n');
  
  // Step 6: Creative Director
  console.log('🎨 Step 6: Creative Director - Quality Review\n');
  console.log('   📝 Evaluating creative quality and consistency...\n');
  
  const reviewResult = MOCK_CREATIVE_REVIEW;
  
  console.log('✅ Creative review complete!');
  console.log(`   Decision: ${reviewResult.decision}`);
  console.log(`   Priority: ${reviewResult.revisionPriority}`);
  console.log(`\n   Creative Notes:\n   ${reviewResult.creativeNotes}\n`);
  
  if (reviewResult.specificFeedback.story) {
    console.log('   Story Feedback:');
    reviewResult.specificFeedback.story.forEach(note => console.log(`   ✓ ${note}`));
    console.log();
  }
  
  saveToFile('05-creative-review.json', reviewResult);
  console.log('   💾 Saved: output/demo-episode/05-creative-review.json\n');
  
  // Final Summary
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('✨ DEMO EPISODE CREATION COMPLETE!\n');
  console.log('📦 Output Files:\n');
  console.log('   1. Story Outline (Story Architect)');
  console.log('   2. Protagonist Profile (Character Designer)');
  console.log('   3. Supporting Character Profile (Character Designer)');
  console.log('   4. Complete Dialogue (Dialogue Writer)');
  console.log('   5. Creative Review (Creative Director)\n');
  console.log(`   📁 Location: ${OUTPUT_DIR}\n`);
  console.log('🔗 Content Pipeline Verified:\n');
  console.log('   Story Architect → Character Designer → Dialogue Writer → Creative Director ✅\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('💡 Next Steps:\n');
  console.log('   • Review generated files in output/demo-episode/');
  console.log('   • Run with real LLMs: npm run sample:episode');
  console.log('   • Start Docker infrastructure for full integration\n');
  console.log('🎉 All Phase 1 agents demonstrated successfully!\n');
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
  console.error('\n❌ Error during demo:\n');
  console.error(error);
  process.exit(1);
});
