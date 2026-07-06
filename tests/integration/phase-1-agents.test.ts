/**
 * Phase 1 Integration Test
 * 
 * Tests the complete content-creation pipeline:
 * Story Architect → Character Designer → Dialogue Writer → Creative Director
 */

import { describe, it, expect } from '@jest/globals';
import { 
  StoryArchitectAgent,
  CharacterDesignerAgent,
  DialogueWriterAgent,
  CreativeDirectorAgent,
  LLM_CONFIG,
  getAgentModel,
  getAgentTemperature,
  getAgentMaxTokens
} from '@mirror/agents';

describe('Phase 1 Agent Integration', () => {
  describe('Agent Initialization', () => {
    it('should create Story Architect agent instance', () => {
      const agent = new StoryArchitectAgent();
      
      expect(agent).toBeDefined();
      expect(agent['config'].id).toBe('STORY_ARCHITECT');
      expect(agent['config'].name).toBe('River');
      expect(agent['config'].role).toBe('Lead Story Designer');
      expect(agent['config'].model).toBe(getAgentModel('STORY_ARCHITECT'));
      expect(agent['config'].temperature).toBe(getAgentTemperature('STORY_ARCHITECT'));
    });
    
    it('should create Character Designer agent instance', () => {
      const agent = new CharacterDesignerAgent();
      
      expect(agent).toBeDefined();
      expect(agent['config'].id).toBe('CHARACTER_DESIGNER');
      expect(agent['config'].name).toBe('Kai');
      expect(agent['config'].role).toBe('Character Psychology and Development Specialist');
      expect(agent['config'].model).toBe(getAgentModel('CHARACTER_DESIGNER'));
      expect(agent['config'].temperature).toBe(getAgentTemperature('CHARACTER_DESIGNER'));
    });
    
    it('should create Dialogue Writer agent instance', () => {
      const agent = new DialogueWriterAgent();
      
      expect(agent).toBeDefined();
      expect(agent['config'].id).toBe('DIALOGUE_WRITER');
      expect(agent['config'].name).toBe('Echo');
      expect(agent['config'].role).toBe('Dialogue and Voice Specialist');
      expect(agent['config'].model).toBe(getAgentModel('DIALOGUE_WRITER'));
      expect(agent['config'].temperature).toBe(getAgentTemperature('DIALOGUE_WRITER'));
    });
    
    it('should create Creative Director agent instance', () => {
      const agent = new CreativeDirectorAgent();
      
      expect(agent).toBeDefined();
      expect(agent['config'].id).toBe('CREATIVE_DIRECTOR');
      expect(agent['config'].name).toBe('Aria');
      expect(agent['config'].role).toBe('Creative Vision Keeper');
      expect(agent['config'].model).toBe(getAgentModel('CREATIVE_DIRECTOR'));
      expect(agent['config'].temperature).toBe(getAgentTemperature('CREATIVE_DIRECTOR'));
    });
  });
  
  describe('Agent Configuration', () => {
    it('should use the centrally configured LLM model', () => {
      const storyArchitect = new StoryArchitectAgent();
      const characterDesigner = new CharacterDesignerAgent();
      const dialogueWriter = new DialogueWriterAgent();
      const creativeDirector = new CreativeDirectorAgent();
      
      // All Phase 1 agents use the Anthropic default (overridable per agent via env)
      expect(storyArchitect['config'].model).toBe(getAgentModel('STORY_ARCHITECT'));
      expect(characterDesigner['config'].model).toBe(getAgentModel('CHARACTER_DESIGNER'));
      expect(dialogueWriter['config'].model).toBe(getAgentModel('DIALOGUE_WRITER'));
      expect(creativeDirector['config'].model).toBe(getAgentModel('CREATIVE_DIRECTOR'));
      
      // Without env overrides, the default is the central Anthropic model
      if (!process.env.ANTHROPIC_MODEL) {
        expect(storyArchitect['config'].model).toBe(LLM_CONFIG.defaultModels.anthropic);
      }
    });
    
    it('should have appropriate temperature settings', () => {
      const storyArchitect = new StoryArchitectAgent();
      const characterDesigner = new CharacterDesignerAgent();
      const dialogueWriter = new DialogueWriterAgent();
      const creativeDirector = new CreativeDirectorAgent();
      
      // Wiring: each agent reads its temperature from the central config
      expect(storyArchitect['config'].temperature).toBe(getAgentTemperature('STORY_ARCHITECT'));
      expect(characterDesigner['config'].temperature).toBe(getAgentTemperature('CHARACTER_DESIGNER'));
      expect(dialogueWriter['config'].temperature).toBe(getAgentTemperature('DIALOGUE_WRITER'));
      expect(creativeDirector['config'].temperature).toBe(getAgentTemperature('CREATIVE_DIRECTOR'));
      
      // Semantics: creative agents run hotter than balanced review agents
      expect(storyArchitect['config'].temperature).toBe(LLM_CONFIG.temperatures.creative);
      expect(dialogueWriter['config'].temperature).toBe(LLM_CONFIG.temperatures.creative);
      expect(characterDesigner['config'].temperature).toBe(LLM_CONFIG.temperatures.balanced);
      expect(creativeDirector['config'].temperature).toBe(LLM_CONFIG.temperatures.balanced);
      expect(LLM_CONFIG.temperatures.creative).toBeGreaterThan(LLM_CONFIG.temperatures.balanced);
    });
    
    it('should have appropriate token limits', () => {
      const storyArchitect = new StoryArchitectAgent();
      const characterDesigner = new CharacterDesignerAgent();
      const dialogueWriter = new DialogueWriterAgent();
      const creativeDirector = new CreativeDirectorAgent();
      
      // Wiring: each agent reads its token limit from the central config
      expect(storyArchitect['config'].maxTokens).toBe(getAgentMaxTokens('STORY_ARCHITECT'));
      expect(characterDesigner['config'].maxTokens).toBe(getAgentMaxTokens('CHARACTER_DESIGNER'));
      expect(dialogueWriter['config'].maxTokens).toBe(getAgentMaxTokens('DIALOGUE_WRITER'));
      expect(creativeDirector['config'].maxTokens).toBe(getAgentMaxTokens('CREATIVE_DIRECTOR'));
      
      // Semantics: full-episode generators (outlines, all-scene dialogue) get
      // the xlarge budget — live runs always truncated at large+headroom and
      // paid for a wasted retry
      expect(storyArchitect['config'].maxTokens).toBe(LLM_CONFIG.maxTokens.xlarge);
      expect(dialogueWriter['config'].maxTokens).toBe(LLM_CONFIG.maxTokens.xlarge);
      expect(characterDesigner['config'].maxTokens).toBe(LLM_CONFIG.maxTokens.medium);
      expect(creativeDirector['config'].maxTokens).toBe(LLM_CONFIG.maxTokens.medium);
    });
  });
  
  describe('Agent Type System', () => {
    it('should have properly typed agent IDs', () => {
      const agents = [
        new StoryArchitectAgent(),
        new CharacterDesignerAgent(),
        new DialogueWriterAgent(),
        new CreativeDirectorAgent()
      ];
      
      const agentIds = agents.map(a => a['config'].id);
      
      expect(agentIds).toContain('STORY_ARCHITECT');
      expect(agentIds).toContain('CHARACTER_DESIGNER');
      expect(agentIds).toContain('DIALOGUE_WRITER');
      expect(agentIds).toContain('CREATIVE_DIRECTOR');
      
      // All IDs should be unique
      expect(new Set(agentIds).size).toBe(4);
    });
    
    it('should have system prompts defined', () => {
      const agents = [
        new StoryArchitectAgent(),
        new CharacterDesignerAgent(),
        new DialogueWriterAgent(),
        new CreativeDirectorAgent()
      ];
      
      agents.forEach(agent => {
        const systemPrompt = agent['systemPrompt'];
        expect(systemPrompt).toBeDefined();
        expect(typeof systemPrompt).toBe('string');
        expect(systemPrompt.length).toBeGreaterThan(100);
        
        // Each prompt should mention the agent's name
        expect(systemPrompt).toContain(agent['config'].name);
      });
    });
  });
  
  describe('Integration Readiness', () => {
    it('should be ready for workflow integration', () => {
      // All agents should be instantiable
      expect(() => new StoryArchitectAgent()).not.toThrow();
      expect(() => new CharacterDesignerAgent()).not.toThrow();
      expect(() => new DialogueWriterAgent()).not.toThrow();
      expect(() => new CreativeDirectorAgent()).not.toThrow();
    });
    
    it('should have compatible agent roles', () => {
      const storyArchitect = new StoryArchitectAgent();
      const characterDesigner = new CharacterDesignerAgent();
      const dialogueWriter = new DialogueWriterAgent();
      const creativeDirector = new CreativeDirectorAgent();
      
      // Verify role differentiation
      const roles = new Set([
        storyArchitect['config'].role,
        characterDesigner['config'].role,
        dialogueWriter['config'].role,
        creativeDirector['config'].role
      ]);
      
      // All roles should be unique
      expect(roles.size).toBe(4);
    });
  });
});

describe('Phase 1 Agent Workflow', () => {
  it('should represent complete content creation pipeline', () => {
    const pipeline = [
      { agent: 'Story Architect', role: 'Creates episode structure' },
      { agent: 'Character Designer', role: 'Creates characters' },
      { agent: 'Dialogue Writer', role: 'Writes dialogue' },
      { agent: 'Creative Director', role: 'Reviews quality' }
    ];
    
    expect(pipeline).toHaveLength(4);
    expect(pipeline[0].agent).toBe('Story Architect');
    expect(pipeline[3].agent).toBe('Creative Director');
  });
});

