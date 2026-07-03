import { AgentId, AgentMessage, MessageType, MessagePriority } from '@mirror/schemas';
import { MessageBus } from '@mirror/message-bus';
import { MemorySystem } from '@mirror/memory';
import { LLMGateway, LLMCallOptions } from './llm-gateway';
import { v4 as uuidv4 } from 'uuid';

/**
 * Base Agent class - Complete integration with all systems
 * 
 * All specialized agents inherit from this class.
 * Provides:
 * - Message handling (via MessageBus)
 * - Memory operations (via MemorySystem)
 * - LLM integration (via LLMGateway)
 * - Context management
 * - State tracking
 */

export interface AgentConfig {
  id: AgentId;
  name: string;
  role: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentContext {
  workflowId: string;
  threadId: string;
  messageBus: MessageBus;
  memory: MemorySystem;
  llm: LLMGateway;
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected context?: AgentContext;
  private initialized: boolean = false;
  
  constructor(config: AgentConfig) {
    this.config = config;
  }
  
  /**
   * Initialize agent with context (workflow, memory, etc.)
   */
  async initialize(context: AgentContext): Promise<void> {
    this.context = context;
    
    // Subscribe to messages
    await context.messageBus.subscribe(
      this.config.id,
      this.handleMessage.bind(this)
    );
    
    // Perform agent-specific initialization
    await this.onInitialize();
    
    this.initialized = true;
    console.log(`[${this.config.id}] Initialized and ready`);
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
    
    console.log(`[${this.config.id}] Processing input`);
    
    // Store input in memory
    await this.remember('last_input', input);
    
    // Execute agent-specific logic
    const startTime = Date.now();
    const output = await this.execute(input);
    const duration = Date.now() - startTime;
    
    // Store output in memory
    await this.remember('last_output', output);
    await this.remember('last_execution_time_ms', duration);
    
    console.log(`[${this.config.id}] Completed in ${duration}ms`);
    
    return output;
  }
  
  /**
   * Abstract method - each agent implements their specific logic
   */
  protected abstract execute(input: any): Promise<any>;
  
  /**
   * Handle incoming message
   */
  private async handleMessage(message: AgentMessage): Promise<void> {
    console.log(`[${this.config.id}] Received ${message.type} from ${message.from}`);
    
    try {
      if (message.type === 'REQUEST') {
        const response = await this.process(message.payload.content);
        await this.respond(message.from, message.id, response);
      } else if (message.type === 'CHALLENGE') {
        await this.handleChallenge(message);
      } else if (message.type === 'BROADCAST') {
        await this.handleBroadcast(message);
      }
      // Other message types can be handled by subclasses
    } catch (error) {
      console.error(`[${this.config.id}] Error handling message:`, error);
      if (message.requiresResponse) {
        await this.reject(
          message.from,
          message.id,
          `Error processing request: ${error}`
        );
      }
    }
  }
  
  /**
   * Handle challenge from another agent
   */
  protected async handleChallenge(message: AgentMessage): Promise<void> {
    // Default: escalate to CEO
    console.log(`[${this.config.id}] Received challenge, escalating to CEO`);
    await this.sendMessage('CEO', 'QUERY', {
      type: 'CHALLENGE_ESCALATION',
      original: message
    });
  }
  
  /**
   * Handle broadcast message
   */
  protected async handleBroadcast(message: AgentMessage): Promise<void> {
    // Default: store in memory for context
    await this.remember(`broadcast:${message.id}`, message.payload.content);
  }
  
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
    
    await this.context!.messageBus.publish(message);
    
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
    this.validateContext();
    
    const expiresAt = ttl ? new Date(Date.now() + ttl * 1000) : undefined;
    
    await this.context!.memory.store({
      agentId: this.config.id,
      scope: 'AGENT_WORKING',
      key,
      value,
      expiresAt
    });
  }
  
  /**
   * Retrieve information from agent's memory
   */
  protected async recall<T = any>(key: string): Promise<T | null> {
    this.validateContext();
    return await this.context!.memory.retrieve<T>(this.config.id, key);
  }
  
  /**
   * Search memory semantically
   */
  protected async search(query: string, limit: number = 10): Promise<any[]> {
    this.validateContext();
    
    const results = await this.context!.memory.search(
      this.config.id,
      query,
      { limit, scope: 'AGENT_WORKING' }
    );
    
    return results.map(r => r.value);
  }
  
  /**
   * Call AI model with prompt
   */
  protected async callLLM(
    systemPrompt: string,
    userPrompt: string,
    options?: LLMCallOptions
  ): Promise<string> {
    this.validateContext();
    
    const response = await this.context!.llm.call(userPrompt, {
      systemPrompt,
      model: options?.model || this.config.model,
      temperature: options?.temperature ?? this.config.temperature,
      maxTokens: options?.maxTokens || this.config.maxTokens,
      ...options
    });
    
    // Track LLM usage
    await this.remember('total_tokens_used', 
      ((await this.recall<number>('total_tokens_used')) || 0) + response.usage.totalTokens
    );
    
    return response.content;
  }
  
  /**
   * Validate that agent has required context
   */
  private validateContext(): void {
    if (!this.context) {
      throw new Error(`Agent ${this.config.id} not initialized with context`);
    }
    if (!this.initialized) {
      throw new Error(`Agent ${this.config.id} not fully initialized - call initialize() first`);
    }
  }
  
  /**
   * Get agent info
   */
  getInfo() {
    return {
      id: this.config.id,
      name: this.config.name,
      role: this.config.role,
      initialized: this.initialized
    };
  }
  
  /**
   * Shutdown agent gracefully
   */
  async shutdown(): Promise<void> {
    if (this.context) {
      await this.context.messageBus.unsubscribe(this.config.id);
    }
    this.initialized = false;
    console.log(`[${this.config.id}] Shutdown complete`);
  }
}
