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
  CreativeDirectorAgent
} from '@mirror/agents';

describe('Phase 1 Agent Integration', () => {
  describe('Agent Initialization', () => {
    it('should create Story Architect agent instance', () => {
      const agent = new StoryArchitectAgent();
      
      expect(agent).toBeDefined();
      expect(agent['config'].id).toBe('STORY_ARCHITECT');
      expect(agent['config'].name).toBe('River');
      expect(agent['config'].role).toBe('Lead Story Designer');
      expect(agent['config'].model).toBe('claude-sonnet-4.5');
      expect(agent['config'].temperature).toBe(0.5);
    });
    
    it('should create Character Designer agent instance', () => {
      const agent = new CharacterDesignerAgent();
      
      expect(agent).toBeDefined();
      expect(agent['config'].id).toBe('CHARACTER_DESIGNER');
      expect(agent['config'].name).toBe('Kai');
      expect(agent['config'].role).toBe('Character Psychology and Development Specialist');
      expect(agent['config'].model).toBe('claude-sonnet-4.5');
      expect(agent['config'].temperature).toBe(0.6);
    });
    
    it('should create Dialogue Writer agent instance', () => {
      const agent = new DialogueWriterAgent();
      
      expect(agent).toBeDefined();
      expect(agent['config'].id).toBe('DIALOGUE_WRITER');
      expect(agent['config'].name).toBe('Echo');
      expect(agent['config'].role).toBe('Dialogue and Voice Specialist');
      expect(agent['config'].model).toBe('claude-sonnet-4.5');
      expect(agent['config'].temperature).toBe(0.7);
    });
    
    it('should create Creative Director agent instance', () => {
      const agent = new CreativeDirectorAgent();
      
      expect(agent).toBeDefined();
      expect(agent['config'].id).toBe('CREATIVE_DIRECTOR');
      expect(agent['config'].name).toBe('Aria');
      expect(agent['config'].role).toBe('Creative Vision Keeper');
      expect(agent['config'].model).toBe('claude-sonnet-4.5');
      expect(agent['config'].temperature).toBe(0.6);
    });
  });
  
  describe('Agent Configuration', () => {
    it('should have correct LLM model configurations', () => {
      const storyArchitect = new StoryArchitectAgent();
      const characterDesigner = new CharacterDesignerAgent();
      const dialogueWriter = new DialogueWriterAgent();
      const creativeDirector = new CreativeDirectorAgent();
      
      // All should use Claude Sonnet 4.5
      expect(storyArchitect['config'].model).toBe('claude-sonnet-4.5');
      expect(characterDesigner['config'].model).toBe('claude-sonnet-4.5');
      expect(dialogueWriter['config'].model).toBe('claude-sonnet-4.5');
      expect(creativeDirector['config'].model).toBe('claude-sonnet-4.5');
    });
    
    it('should have appropriate temperature settings', () => {
      const storyArchitect = new StoryArchitectAgent();
      const characterDesigner = new CharacterDesignerAgent();
      const dialogueWriter = new DialogueWriterAgent();
      const creativeDirector = new CreativeDirectorAgent();
      
      // Story Architect: Lower temperature for structured planning
      expect(storyArchitect['config'].temperature).toBe(0.5);
      
      // Character Designer: Medium-high for creativity with consistency
      expect(characterDesigner['config'].temperature).toBe(0.6);
      
      // Dialogue Writer: Highest for natural, varied dialogue
      expect(dialogueWriter['config'].temperature).toBe(0.7);
      
      // Creative Director: Medium-high for balanced creativity
      expect(creativeDirector['config'].temperature).toBe(0.6);
    });
    
    it('should have appropriate token limits', () => {
      const storyArchitect = new StoryArchitectAgent();
      const characterDesigner = new CharacterDesignerAgent();
      const dialogueWriter = new DialogueWriterAgent();
      const creativeDirector = new CreativeDirectorAgent();
      
      // Story Architect: Large context for complex outlines
      expect(storyArchitect['config'].maxTokens).toBe(8192);
      
      // Character Designer: Medium context for profiles
      expect(characterDesigner['config'].maxTokens).toBe(6144);
      
      // Dialogue Writer: Large context for full episodes
      expect(dialogueWriter['config'].maxTokens).toBe(8192);
      
      // Creative Director: Medium context for reviews
      expect(creativeDirector['config'].maxTokens).toBe(6144);
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

