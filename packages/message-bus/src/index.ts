import { createClient, RedisClientType } from 'redis';
import { AgentMessage, AgentId } from '@mirror/schemas';
import { v4 as uuidv4 } from 'uuid';

/**
 * Message Bus Implementation using Redis Streams
 * 
 * Handles inter-agent communication with:
 * - Message routing (point-to-point and broadcast)
 * - Priority queues
 * - Message persistence
 * - Thread tracking
 * - Expiration handling
 */

export interface MessageBusConfig {
  redisUrl: string;
  streamPrefix?: string;
  maxStreamLength?: number;
}

export class MessageBus {
  private client: RedisClientType;
  private config: MessageBusConfig;
  private listeners: Map<AgentId, (message: AgentMessage) => Promise<void>>;
  private running: boolean = false;

  constructor(config: MessageBusConfig) {
    this.config = {
      streamPrefix: 'mirror:messages',
      maxStreamLength: 10000,
      ...config
    };
    
    this.client = createClient({
      url: config.redisUrl
    });
    
    this.listeners = new Map();
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    await this.client.connect();
    console.log('[MessageBus] Connected to Redis');
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    this.running = false;
    await this.client.disconnect();
    console.log('[MessageBus] Disconnected from Redis');
  }

  /**
   * Publish a message to the bus
   */
  async publish(message: AgentMessage): Promise<void> {
    const streamKey = this.getStreamKey(message.to as AgentId);
    
    // Store message in Redis Stream
    await this.client.xAdd(
      streamKey,
      '*', // Auto-generate ID
      {
        message: JSON.stringify(message)
      },
      {
        TRIM: {
          strategy: 'MAXLEN',
          threshold: this.config.maxStreamLength!,
          strategyModifier: '~' // Approximate trimming for performance
        }
      }
    );

    // Also store in message archive (PostgreSQL will be primary source)
    await this.client.set(
      `mirror:message:${message.id}`,
      JSON.stringify(message),
      {
        EX: 86400 // 24 hour expiration
      }
    );

    console.log(`[MessageBus] Published ${message.type} from ${message.from} to ${message.to}`);
  }

  /**
   * Subscribe to messages for a specific agent
   */
  async subscribe(
    agentId: AgentId,
    handler: (message: AgentMessage) => Promise<void>
  ): Promise<void> {
    this.listeners.set(agentId, handler);
    
    if (!this.running) {
      this.running = true;
      this.startListening();
    }

    console.log(`[MessageBus] Agent ${agentId} subscribed`);
  }

  /**
   * Unsubscribe an agent from receiving messages
   */
  async unsubscribe(agentId: AgentId): Promise<void> {
    this.listeners.delete(agentId);
    console.log(`[MessageBus] Agent ${agentId} unsubscribed`);
  }

  /**
   * Get message by ID (from Redis cache or PostgreSQL)
   */
  async getMessage(messageId: string): Promise<AgentMessage | null> {
    const cached = await this.client.get(`mirror:message:${messageId}`);
    
    if (cached) {
      return JSON.parse(cached) as AgentMessage;
    }
    
    // Fallback to PostgreSQL (not implemented yet)
    return null;
  }

  /**
   * Get all messages in a thread
   */
  async getThread(threadId: string): Promise<AgentMessage[]> {
    // This will query PostgreSQL for thread messages
    // For now, return empty array
    return [];
  }

  /**
   * Start listening for messages on all subscribed agents
   */
  private async startListening(): Promise<void> {
    const pollInterval = 100; // ms
    
    while (this.running && this.listeners.size > 0) {
      for (const [agentId, handler] of this.listeners.entries()) {
        try {
          await this.pollMessages(agentId, handler);
        } catch (error) {
          console.error(`[MessageBus] Error polling for ${agentId}:`, error);
        }
      }
      
      // Small delay to avoid hammering Redis
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  /**
   * Poll for new messages for an agent
   */
  private async pollMessages(
    agentId: AgentId,
    handler: (message: AgentMessage) => Promise<void>
  ): Promise<void> {
    const streamKey = this.getStreamKey(agentId);
    const lastId = await this.getLastProcessedId(agentId);
    
    // Read new messages from stream
    const results = await this.client.xRead(
      { key: streamKey, id: lastId || '0' },
      { COUNT: 10, BLOCK: 0 }
    );

    if (!results || results.length === 0) {
      return;
    }

    for (const result of results) {
      for (const item of result.messages) {
        const message = JSON.parse(item.message.message) as AgentMessage;
        
        // Check if message has expired
        if (message.expiresAt && new Date(message.expiresAt) < new Date()) {
          console.log(`[MessageBus] Message ${message.id} expired, skipping`);
          continue;
        }
        
        // Handle message
        try {
          await handler(message);
          await this.setLastProcessedId(agentId, item.id);
        } catch (error) {
          console.error(`[MessageBus] Error handling message ${message.id}:`, error);
        }
      }
    }
  }

  /**
   * Get the last processed message ID for an agent
   */
  private async getLastProcessedId(agentId: AgentId): Promise<string | null> {
    return await this.client.get(`mirror:agent:${agentId}:last_message_id`);
  }

  /**
   * Set the last processed message ID for an agent
   */
  private async setLastProcessedId(agentId: AgentId, messageId: string): Promise<void> {
    await this.client.set(`mirror:agent:${agentId}:last_message_id`, messageId);
  }

  /**
   * Get the Redis stream key for an agent
   */
  private getStreamKey(agentId: AgentId): string {
    return `${this.config.streamPrefix}:${agentId}`;
  }

  /**
   * Broadcast message to all agents
   */
  async broadcast(message: Omit<AgentMessage, 'id' | 'to' | 'timestamp'>): Promise<void> {
    // Get all agent IDs
    const agentIds: AgentId[] = [
      'CEO',
      'CREATIVE_DIRECTOR',
      'STORY_ARCHITECT',
      'CHARACTER_DESIGNER',
      'DIALOGUE_WRITER',
      'TECH_LEAD',
      'BACKEND_DEVELOPER'
      // Add more as needed
    ];

    for (const agentId of agentIds) {
      if (agentId !== message.from) {
        const fullMessage: AgentMessage = {
          ...message,
          id: uuidv4(),
          to: agentId,
          timestamp: new Date().toISOString()
        } as AgentMessage;

        await this.publish(fullMessage);
      }
    }
  }

  /**
   * Get queue length for an agent
   */
  async getQueueLength(agentId: AgentId): Promise<number> {
    const streamKey = this.getStreamKey(agentId);
    const length = await this.client.xLen(streamKey);
    return length;
  }

  /**
   * Clear all messages for an agent (use with caution)
   */
  async clearQueue(agentId: AgentId): Promise<void> {
    const streamKey = this.getStreamKey(agentId);
    await this.client.del(streamKey);
    console.log(`[MessageBus] Cleared queue for ${agentId}`);
  }
}

/**
 * Factory function to create and connect MessageBus
 */
export async function createMessageBus(config: MessageBusConfig): Promise<MessageBus> {
  const bus = new MessageBus(config);
  await bus.connect();
  return bus;
}
