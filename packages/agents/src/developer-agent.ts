import { BaseAgent, AgentConfig } from './base-agent-v2';

/**
 * Developer Agent - First AI agent that writes code
 * 
 * Mission: Build and maintain the platform infrastructure
 * 
 * Capabilities:
 * - Read existing code
 * - Write new code files
 * - Understand requirements
 * - Generate implementations
 * - Follow coding standards
 * - Write tests
 * 
 * This is the bootstrap agent - it helps build the rest of the system!
 */

const DEVELOPER_SYSTEM_PROMPT = `You are a Senior Software Engineer working on Project MIRROR Studio.

Your role: Build high-quality, maintainable code for the AI agent platform.

TECHNICAL CONTEXT:
- **Language**: TypeScript 5.7
- **Runtime**: Node.js 20
- **Stack**: PostgreSQL, Redis, Express, React
- **Architecture**: Monorepo with Turbo
- **Patterns**: Agent-based, event-driven, message-passing

CODING STANDARDS:
1. **Type Safety**: Use TypeScript strictly, no 'any' without reason
2. **Error Handling**: Always handle errors gracefully
3. **Documentation**: Clear comments explaining WHY, not what
4. **Testing**: Write tests for all public APIs
5. **Async/Await**: Use async/await, not callbacks
6. **Naming**: Clear, descriptive names (no abbreviations)
7. **Single Responsibility**: Each function does one thing well
8. **DRY**: Don't repeat yourself - extract common logic

AGENT PRINCIPLES (from Constitution):
- Story first - educational content hidden in narrative
- No judgment or labels - growth-focused language
- Safety first - protect children
- Autonomous agents - minimal human intervention
- Learning system - agents improve over time

YOUR WORKFLOW:
1. **Understand** the requirement deeply
2. **Plan** the implementation (consider edge cases)
3. **Code** with clarity and correctness
4. **Test** your implementation mentally
5. **Document** key decisions

RESPONSE FORMAT:
When writing code, provide:
1. **File Path**: Where this code should live
2. **Implementation**: The actual code
3. **Explanation**: Brief description of key decisions
4. **Dependencies**: Any new packages needed
5. **Tests**: How to verify it works

Be professional, thorough, and autonomous. You're building a system that helps teenagers grow.`;

interface DeveloperInput {
  type: 'IMPLEMENT_FEATURE' | 'FIX_BUG' | 'WRITE_AGENT' | 'REFACTOR' | 'REVIEW_CODE';
  
  requirement?: string;
  context?: {
    existingCode?: string;
    relatedFiles?: string[];
    constraints?: string[];
  };
  
  // For writing agents
  agentSpec?: {
    id: string;
    name: string;
    role: string;
    mission: string;
    expertise: string[];
    responsibilities: string[];
  };
}

interface DeveloperOutput {
  files: Array<{
    path: string;
    content: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE';
  }>;
  dependencies?: string[];
  explanation: string;
  tests?: string;
  nextSteps?: string[];
}

export class DeveloperAgent extends BaseAgent {
  constructor() {
    super({
      id: 'BACKEND_DEVELOPER',
      name: 'Dev',
      role: 'Backend Developer',
      model: 'claude-sonnet-5', // Best for code generation
      temperature: 0.2, // Lower for more deterministic code
      maxTokens: 8192 // Longer for code generation
    });
  }
  
  protected async execute(input: DeveloperInput): Promise<DeveloperOutput> {
    console.log(`[Developer] Working on ${input.type}`);
    
    switch (input.type) {
      case 'WRITE_AGENT':
        return await this.writeAgent(input.agentSpec!);
      
      case 'IMPLEMENT_FEATURE':
        return await this.implementFeature(input.requirement!, input.context);
      
      case 'FIX_BUG':
        return await this.fixBug(input.requirement!, input.context);
      
      case 'REFACTOR':
        return await this.refactor(input.requirement!, input.context);
      
      case 'REVIEW_CODE':
        return await this.reviewCode(input.context!.existingCode!);
      
      default:
        throw new Error(`Unknown developer task: ${input.type}`);
    }
  }
  
  /**
   * Write a new agent class
   */
  private async writeAgent(spec: DeveloperInput['agentSpec']): Promise<DeveloperOutput> {
    const userPrompt = `
I need you to implement a new AI agent for our system.

AGENT SPECIFICATION:
Name: ${spec!.name}
ID: ${spec!.id}
Role: ${spec!.role}
Mission: ${spec!.mission}

Expertise: ${spec!.expertise.join(', ')}

Responsibilities:
${spec!.responsibilities.map(r => `- ${r}`).join('\n')}

TASK:
Create a complete TypeScript class for this agent that:

1. Extends BaseAgent
2. Implements the execute() method with the agent's logic
3. Defines clear Input and Output interfaces
4. Includes a comprehensive system prompt
5. Handles the agent's specific responsibilities
6. Follows our coding standards

Please provide:
- The complete TypeScript file
- Where it should be saved
- Any dependencies needed
- Brief explanation of design decisions

Be thorough and professional. This agent will run autonomously.
`.trim();

    const response = await this.callLLM(DEVELOPER_SYSTEM_PROMPT, userPrompt);
    
    // Parse the response (in production, we'd use structured output)
    const output = this.parseCodeResponse(response);
    
    // Store in memory for review
    await this.remember(`agent_implementation:${spec!.id}`, output);
    
    return output;
  }
  
  /**
   * Implement a new feature
   */
  private async implementFeature(
    requirement: string,
    context?: DeveloperInput['context']
  ): Promise<DeveloperOutput> {
    const contextInfo = context ? `
EXISTING CODE:
${context.existingCode || 'None'}

RELATED FILES:
${context.relatedFiles?.join('\n') || 'None'}

CONSTRAINTS:
${context.constraints?.join('\n') || 'None'}
` : '';

    const userPrompt = `
FEATURE REQUIREMENT:
${requirement}

${contextInfo}

TASK:
Implement this feature following our standards.

Provide:
1. Complete implementation (all files needed)
2. Where each file should be saved
3. Any new dependencies
4. How to test it
5. Key design decisions

Be complete and production-ready.
`.trim();

    const response = await this.callLLM(DEVELOPER_SYSTEM_PROMPT, userPrompt);
    
    return this.parseCodeResponse(response);
  }
  
  /**
   * Fix a bug
   */
  private async fixBug(
    bugDescription: string,
    context?: DeveloperInput['context']
  ): Promise<DeveloperOutput> {
    const userPrompt = `
BUG REPORT:
${bugDescription}

EXISTING CODE:
${context?.existingCode || 'Not provided'}

TASK:
1. Identify the root cause
2. Fix the bug
3. Prevent similar bugs
4. Add tests to verify the fix

Provide the fixed code and explanation.
`.trim();

    const response = await this.callLLM(DEVELOPER_SYSTEM_PROMPT, userPrompt);
    
    return this.parseCodeResponse(response);
  }
  
  /**
   * Refactor code
   */
  private async refactor(
    refactorGoal: string,
    context?: DeveloperInput['context']
  ): Promise<DeveloperOutput> {
    const userPrompt = `
REFACTORING GOAL:
${refactorGoal}

CURRENT CODE:
${context?.existingCode || 'Not provided'}

TASK:
Refactor this code to be:
- Cleaner
- More maintainable
- Better structured
- Following best practices

Preserve behavior while improving quality.
`.trim();

    const response = await this.callLLM(DEVELOPER_SYSTEM_PROMPT, userPrompt);
    
    return this.parseCodeResponse(response);
  }
  
  /**
   * Review code
   */
  private async reviewCode(code: string): Promise<DeveloperOutput> {
    const userPrompt = `
CODE TO REVIEW:
${code}

TASK:
Review this code for:
1. Correctness
2. Code quality
3. Security issues
4. Performance concerns
5. Maintainability
6. Alignment with our standards

Provide:
- Issues found (if any)
- Suggested improvements
- Overall assessment

Be thorough but constructive.
`.trim();

    const response = await this.callLLM(DEVELOPER_SYSTEM_PROMPT, userPrompt);
    
    return {
      files: [],
      explanation: response,
      nextSteps: ['Address review comments', 'Resubmit for approval']
    };
  }
  
  /**
   * Parse LLM response into structured output
   * 
   * In production, we'd use structured output or better parsing.
   * For now, this is a simplified version.
   */
  private parseCodeResponse(response: string): DeveloperOutput {
    // This is a simplified parser
    // In production, we'd use proper structured output from the LLM
    
    const files: DeveloperOutput['files'] = [];
    const dependencies: string[] = [];
    
    // Extract code blocks (simplified - look for ```typescript blocks)
    const codeBlockRegex = /```(?:typescript|ts)?\n([\s\S]*?)```/g;
    let match;
    let blockIndex = 0;
    
    while ((match = codeBlockRegex.exec(response)) !== null) {
      files.push({
        path: `generated/file-${blockIndex}.ts`, // Would be extracted from response
        content: match[1],
        operation: 'CREATE'
      });
      blockIndex++;
    }
    
    // Extract dependencies (look for "npm install" or "dependencies:")
    const depsRegex = /(?:npm install|dependencies:|needs?:)\s*([a-z0-9@\-\/,\s]+)/gi;
    while ((match = depsRegex.exec(response)) !== null) {
      const deps = match[1].split(/[,\s]+/).filter(d => d.trim());
      dependencies.push(...deps);
    }
    
    return {
      files,
      dependencies: dependencies.length > 0 ? dependencies : undefined,
      explanation: response,
      nextSteps: ['Review generated code', 'Test implementation', 'Commit changes']
    };
  }
}
