import { AgentId, AgentMessage, MessageType, MessagePriority } from '@mirror/schemas';
import { v4 as uuidv4 } from 'uuid';

/**
 * Base Agent class that all specialized agents inherit from
 * Provides core functionality for:
 * - Message handling
 * - Memory access
 * - Communication
 * - State management
 */

export interface AgentConfig {
  id: AgentId;
  name: string;
  role: string;
  model?: string; // AI model to use (e.g., 'claude-sonnet-4', 'gpt-4')
  temperature?: number;
  maxTokens?: number;
}

export interface AgentContext {
  workflowId: string;
  threadId: string;
  memory?: any; // Memory service
  messageQueue?: any; // Message queue service
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected context?: AgentContext;
  
  constructor(config: AgentConfig) {
    this.config = config;
  }
  
  /**
   * Initialize agent with context (workflow, memory, etc.)
   */
  async initialize(context: AgentContext): Promise<void> {
    this.context = context;
    await this.onInitialize();
  }
  
  /**
   * Override to perform initialization logic
   */
  protected async onInitialize(): Promise<void> {
    // Default: no-op
  }
  
  /**
   * Main entry point for agent processing
   */
  async process(input: any): Promise<any> {
    this.validateContext();
    
    // Store input in memory
    await this.remember('last_input', input);
    
    // Execute agent-specific logic
    const output = await this.execute(input);
    
    // Store output in memory
    await this.remember('last_output', output);
    
    return output;
  }
  
  /**
   * Abstract method - each agent implements their specific logic
   */
  protected abstract execute(input: any): Promise<any>;
  
  /**
   * Send a message to another agent or broadcast
   */
  protected async sendMessage(
    to: AgentId | AgentId[],
    type: MessageType,
    content: any,
    options?: {
      priority?: MessagePriority;
      requiresResponse?: boolean;
      replyTo?: string;
      expiresAt?: Date;
    }
  ): Promise<AgentMessage> {
    this.validateContext();
    
    const message: AgentMessage = {
      id: uuidv4(),
      type,
      from: this.config.id,
      to,
      threadId: this.context!.threadId,
      workflowId: this.context!.workflowId,
      timestamp: new Date().toISOString(),
      priority: options?.priority || 'NORMAL',
      payload: {
        content
      },
      replyTo: options?.replyTo,
      requiresResponse: options?.requiresResponse || false,
      expiresAt: options?.expiresAt?.toISOString()
    };
    
    // Send via message queue
    if (this.context?.messageQueue) {
      await this.context.messageQueue.publish(message);
    }
    
    return message;
  }
  
  /**
   * Request input from another agent
   */
  protected async request(
    to: AgentId,
    content: any,
    priority: MessagePriority = 'NORMAL'
  ): Promise<string> {
    const message = await this.sendMessage(to, 'REQUEST', content, {
      priority,
      requiresResponse: true
    });
    
    return message.id;
  }
  
  /**
   * Respond to a message
   */
  protected async respond(
    to: AgentId,
    replyTo: string,
    content: any
  ): Promise<void> {
    await this.sendMessage(to, 'RESPONSE', content, {
      replyTo
    });
  }
  
  /**
   * Challenge another agent's output
   */
  protected async challenge(
    to: AgentId,
    replyTo: string,
    content: any,
    reasoning: string
  ): Promise<void> {
    await this.sendMessage(to, 'CHALLENGE', {
      content,
      reasoning,
      challenger: this.config.id
    }, {
      replyTo,
      priority: 'HIGH'
    });
  }
  
  /**
   * Approve another agent's output
   */
  protected async approve(
    to: AgentId,
    replyTo: string,
    content?: any
  ): Promise<void> {
    await this.sendMessage(to, 'APPROVAL', content || {}, {
      replyTo
    });
  }
  
  /**
   * Reject another agent's output
   */
  protected async reject(
    to: AgentId,
    replyTo: string,
    reasoning: string,
    suggestions?: string[]
  ): Promise<void> {
    await this.sendMessage(to, 'REJECTION', {
      reasoning,
      suggestions
    }, {
      replyTo,
      priority: 'HIGH'
    });
  }
  
  /**
   * Store information in agent's memory
   */
  protected async remember(key: string, value: any, ttl?: number): Promise<void> {
    if (this.context?.memory) {
      await this.context.memory.store(
        `agent:${this.config.id}:${key}`,
        value,
        { ttl }
      );
    }
  }
  
  /**
   * Retrieve information from agent's memory
   */
  protected async recall<T = any>(key: string): Promise<T | null> {
    if (this.context?.memory) {
      return await this.context.memory.retrieve(`agent:${this.config.id}:${key}`);
    }
    return null;
  }
  
  /**
   * Search memory semantically
   */
  protected async search(query: string, limit: number = 10): Promise<any[]> {
    if (this.context?.memory) {
      return await this.context.memory.search(
        query,
        `agent:${this.config.id}`,
        limit
      );
    }
    return [];
  }
  
  /**
   * Call AI model with prompt
   */
  protected async callLLM(
    systemPrompt: string,
    userPrompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      stopSequences?: string[];
    }
  ): Promise<string> {
    // This will be implemented with actual LLM clients
    // For now, return placeholder
    throw new Error('LLM integration not yet implemented');
  }
  
  /**
   * Validate that agent has required context
   */
  private validateContext(): void {
    if (!this.context) {
      throw new Error(`Agent ${this.config.id} not initialized with context`);
    }
  }
  
  /**
   * Get agent info
   */
  getInfo() {
    return {
      id: this.config.id,
      name: this.config.name,
      role: this.config.role
    };
  }
}
