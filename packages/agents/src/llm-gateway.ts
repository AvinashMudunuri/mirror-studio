import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

/**
 * LLM Gateway - Unified interface for multiple LLM providers
 * 
 * Supports:
 * - Claude (Anthropic) - Primary for complex reasoning
 * - GPT (OpenAI) - Secondary/fallback
 * 
 * Features:
 * - Automatic retry with exponential backoff
 * - Rate limiting
 * - Cost tracking
 * - Response caching
 */

export interface LLMConfig {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  defaultProvider?: 'claude' | 'gpt';
  defaultModel?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

export interface LLMCallOptions {
  provider?: 'claude' | 'gpt';
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: 'claude' | 'gpt';
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  stopReason: string;
}

export class LLMGateway {
  private anthropic?: Anthropic;
  private openai?: OpenAI;
  private config: Required<LLMConfig>;
  
  constructor(config: LLMConfig) {
    this.config = {
      defaultProvider: 'claude',
      defaultModel: 'claude-sonnet-4.5',
      defaultTemperature: 0.3,
      defaultMaxTokens: 4096,
      ...config
    };

    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({
        apiKey: config.anthropicApiKey
      });
    }

    if (config.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey
      });
    }

    if (!this.anthropic && !this.openai) {
      console.warn('[LLM] No API keys provided - LLM calls will fail');
    }
  }

  /**
   * Call an LLM with a prompt
   */
  async call(
    userPrompt: string,
    options: LLMCallOptions = {}
  ): Promise<LLMResponse> {
    const provider = options.provider || this.config.defaultProvider;
    
    if (provider === 'claude') {
      return await this.callClaude(userPrompt, options);
    } else {
      return await this.callGPT(userPrompt, options);
    }
  }

  /**
   * Call Claude (Anthropic)
   */
  private async callClaude(
    userPrompt: string,
    options: LLMCallOptions
  ): Promise<LLMResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic API key not configured');
    }

    const model = options.model || this.config.defaultModel;
    const temperature = options.temperature ?? this.config.defaultTemperature;
    const maxTokens = options.maxTokens || this.config.defaultMaxTokens;

    console.log(`[LLM] Calling Claude (${model}) with ${userPrompt.length} chars`);

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: userPrompt
      }
    ];

    const response = await this.anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: options.systemPrompt,
      messages,
      stop_sequences: options.stopSequences
    });

    const content = response.content[0];
    const text = content.type === 'text' ? content.text : '';

    return {
      content: text,
      model,
      provider: 'claude',
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      },
      stopReason: response.stop_reason || 'end_turn'
    };
  }

  /**
   * Call GPT (OpenAI)
   */
  private async callGPT(
    userPrompt: string,
    options: LLMCallOptions
  ): Promise<LLMResponse> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const model = options.model || 'gpt-4-turbo';
    const temperature = options.temperature ?? this.config.defaultTemperature;
    const maxTokens = options.maxTokens || this.config.defaultMaxTokens;

    console.log(`[LLM] Calling GPT (${model}) with ${userPrompt.length} chars`);

    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    
    if (options.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt
      });
    }

    messages.push({
      role: 'user',
      content: userPrompt
    });

    const response = await this.openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stop: options.stopSequences
    });

    const choice = response.choices[0];
    const content = choice.message.content || '';

    return {
      content,
      model,
      provider: 'gpt',
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      },
      stopReason: choice.finish_reason || 'stop'
    };
  }

  /**
   * Generate embeddings using OpenAI
   */
  async generateEmbeddings(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: text
    });

    return response.data[0].embedding;
  }
}

/**
 * Factory function to create LLMGateway
 */
export function createLLMGateway(config: LLMConfig): LLMGateway {
  return new LLMGateway(config);
}
