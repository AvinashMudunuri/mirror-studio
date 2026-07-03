import { Pool, PoolClient, QueryResult } from 'pg';
import { AgentId, MemoryScope } from '@mirror/schemas';
import { OpenAI } from 'openai';

/**
 * Memory System Implementation
 * 
 * Provides 4 layers of memory:
 * 1. Episode Memory (short-term, current episode)
 * 2. Agent Working Memory (medium-term, last 7 days)
 * 3. Institutional Memory (long-term, all-time patterns)
 * 4. Player Memory (user-specific, lifetime)
 * 
 * Features:
 * - PostgreSQL persistence
 * - Vector embeddings for semantic search
 * - TTL-based expiration
 * - Access tracking
 */

export interface MemoryConfig {
  databaseUrl: string;
  embeddingModel?: string;
  openaiApiKey?: string;
}

export interface MemoryEntry {
  id?: string;
  agentId: AgentId;
  scope: MemoryScope;
  key: string;
  value: any;
  embedding?: number[];
  createdAt?: Date;
  expiresAt?: Date;
  accessCount?: number;
  lastAccessed?: Date;
}

export interface SearchOptions {
  limit?: number;
  threshold?: number; // Cosine similarity threshold (0-1)
  scope?: MemoryScope;
}

export class MemorySystem {
  private pool: Pool;
  private openai?: OpenAI;
  private embeddingModel: string;

  constructor(config: MemoryConfig) {
    this.pool = new Pool({
      connectionString: config.databaseUrl
    });

    this.embeddingModel = config.embeddingModel || 'text-embedding-3-large';

    if (config.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey
      });
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Store a memory entry
   */
  async store(entry: MemoryEntry): Promise<string> {
    const client = await this.pool.connect();
    
    try {
      // Generate embedding if content is text and OpenAI is configured
      let embedding: number[] | null = null;
      
      if (this.openai && typeof entry.value === 'string') {
        embedding = await this.generateEmbedding(entry.value);
      } else if (this.openai && typeof entry.value === 'object') {
        // For objects, embed a JSON string representation
        const text = JSON.stringify(entry.value);
        embedding = await this.generateEmbedding(text);
      }

      const result = await client.query(
        `INSERT INTO agent_memory 
         (agent_id, scope, key, value, embedding, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (agent_id, key) 
         DO UPDATE SET 
           value = EXCLUDED.value,
           embedding = EXCLUDED.embedding,
           expires_at = EXCLUDED.expires_at
         RETURNING id`,
        [
          entry.agentId,
          entry.scope,
          entry.key,
          JSON.stringify(entry.value),
          embedding ? `[${embedding.join(',')}]` : null,
          entry.expiresAt
        ]
      );

      const id = result.rows[0].id;
      console.log(`[Memory] Stored ${entry.scope} memory for ${entry.agentId}: ${entry.key}`);
      
      return id;
    } finally {
      client.release();
    }
  }

  /**
   * Retrieve a memory entry by key
   */
  async retrieve<T = any>(agentId: AgentId, key: string): Promise<T | null> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        `UPDATE agent_memory 
         SET access_count = access_count + 1,
             last_accessed = CURRENT_TIMESTAMP
         WHERE agent_id = $1 
           AND key = $2
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         RETURNING value`,
        [agentId, key]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const value = result.rows[0].value;
      return typeof value === 'string' ? JSON.parse(value) : value;
    } finally {
      client.release();
    }
  }

  /**
   * Search memory using semantic similarity
   */
  async search(
    agentId: AgentId,
    query: string,
    options: SearchOptions = {}
  ): Promise<Array<{ key: string; value: any; similarity: number }>> {
    if (!this.openai) {
      throw new Error('OpenAI client not configured - cannot perform semantic search');
    }

    const client = await this.pool.connect();
    
    try {
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Search using cosine similarity
      const result = await client.query(
        `SELECT 
           key, 
           value,
           1 - (embedding <=> $1::vector) as similarity
         FROM agent_memory
         WHERE agent_id = $2
           AND embedding IS NOT NULL
           ${options.scope ? 'AND scope = $3' : ''}
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
           AND 1 - (embedding <=> $1::vector) > $${options.scope ? 4 : 3}
         ORDER BY similarity DESC
         LIMIT $${options.scope ? 5 : 4}`,
        options.scope
          ? [
              `[${queryEmbedding.join(',')}]`,
              agentId,
              options.scope,
              options.threshold || 0.7,
              options.limit || 10
            ]
          : [
              `[${queryEmbedding.join(',')}]`,
              agentId,
              options.threshold || 0.7,
              options.limit || 10
            ]
      );

      return result.rows.map(row => ({
        key: row.key,
        value: typeof row.value === 'string' ? JSON.parse(row.value) : row.value,
        similarity: row.similarity
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Get all memories for an agent in a specific scope
   */
  async listByScope(agentId: AgentId, scope: MemoryScope): Promise<MemoryEntry[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        `SELECT id, agent_id, scope, key, value, created_at, expires_at, access_count, last_accessed
         FROM agent_memory
         WHERE agent_id = $1 AND scope = $2
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         ORDER BY created_at DESC`,
        [agentId, scope]
      );

      return result.rows.map(row => ({
        id: row.id,
        agentId: row.agent_id,
        scope: row.scope,
        key: row.key,
        value: typeof row.value === 'string' ? JSON.parse(row.value) : row.value,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        accessCount: row.access_count,
        lastAccessed: row.last_accessed
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Delete a memory entry
   */
  async forget(agentId: AgentId, key: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(
        `DELETE FROM agent_memory WHERE agent_id = $1 AND key = $2`,
        [agentId, key]
      );
      
      console.log(`[Memory] Forgot ${key} for ${agentId}`);
    } finally {
      client.release();
    }
  }

  /**
   * Clean up expired memories
   */
  async cleanupExpired(): Promise<number> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        `DELETE FROM agent_memory WHERE expires_at < CURRENT_TIMESTAMP`
      );
      
      const count = result.rowCount || 0;
      console.log(`[Memory] Cleaned up ${count} expired memories`);
      
      return count;
    } finally {
      client.release();
    }
  }

  /**
   * Generate embedding for text using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI client not configured');
    }

    const response = await this.openai.embeddings.create({
      model: this.embeddingModel,
      input: text
    });

    return response.data[0].embedding;
  }

  /**
   * Get memory statistics
   */
  async getStats(agentId?: AgentId): Promise<{
    total: number;
    byScope: Record<MemoryScope, number>;
    expired: number;
  }> {
    const client = await this.pool.connect();
    
    try {
      const whereClause = agentId ? `WHERE agent_id = $1` : '';
      const params = agentId ? [agentId] : [];

      const totalResult = await client.query(
        `SELECT COUNT(*) as count FROM agent_memory ${whereClause}`,
        params
      );

      const byScopeResult = await client.query(
        `SELECT scope, COUNT(*) as count FROM agent_memory ${whereClause} GROUP BY scope`,
        params
      );

      const expiredResult = await client.query(
        `SELECT COUNT(*) as count FROM agent_memory ${whereClause} 
         ${whereClause ? 'AND' : 'WHERE'} expires_at < CURRENT_TIMESTAMP`,
        params
      );

      const byScope: Record<string, number> = {};
      for (const row of byScopeResult.rows) {
        byScope[row.scope] = parseInt(row.count);
      }

      return {
        total: parseInt(totalResult.rows[0].count),
        byScope: byScope as Record<MemoryScope, number>,
        expired: parseInt(expiredResult.rows[0].count)
      };
    } finally {
      client.release();
    }
  }
}

/**
 * Factory function to create MemorySystem
 */
export function createMemorySystem(config: MemoryConfig): MemorySystem {
  return new MemorySystem(config);
}
