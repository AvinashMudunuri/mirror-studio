import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { LLM_CONFIG } from './config';

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
  private config: LLMConfig & {
    defaultProvider: 'claude' | 'gpt';
    defaultModel: string;
    defaultTemperature: number;
    defaultMaxTokens: number;
  };
  
  constructor(config: LLMConfig) {
    this.config = {
      defaultProvider: 'claude',
      defaultModel: LLM_CONFIG.defaultModels.anthropic,
      defaultTemperature: LLM_CONFIG.temperatures.balanced,
      defaultMaxTokens: LLM_CONFIG.maxTokens.medium,
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
    const maxTokens = options.maxTokens || this.config.defaultMaxTokens;
    
    // Claude 5+ models use 'effort' instead of 'temperature'
    // Map temperature to effort: low temp = low effort, high temp = high effort
    const temperature = options.temperature ?? this.config.defaultTemperature;
    const effort = this.mapTemperatureToEffort(temperature);

    console.log(`[LLM] Calling Claude (${model}) with ${userPrompt.length} chars`);

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: userPrompt
      }
    ];

    // Build request params based on model version
    const requestParams: any = {
      model,
      max_tokens: maxTokens,
      messages,
      system: options.systemPrompt,
      stop_sequences: options.stopSequences
    };
    
    // Claude 5+ (and Opus 4.6+) use adaptive thinking + output_config.effort.
    // `effort` is NOT a top-level param — it's nested under output_config,
    // and requires thinking: { type: 'adaptive' } alongside it.
    if (this.isClaudeFiveOrNewer(model)) {
      requestParams.thinking = { type: 'adaptive' };
      // Only set output_config if effort is not 'high' (high is default)
      // This keeps prompt caching more stable
      if (effort !== 'high') {
        requestParams.output_config = { effort };
      }
    } else {
      requestParams.temperature = temperature;
    }

    const response = await this.anthropic.messages.create(requestParams);

    // Claude 5+ with adaptive thinking returns thinking blocks + text blocks
    // Find the text block (don't assume content[0] is text)
    const textBlock = response.content.find(b => b.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '';

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
   * Check if model is Claude 5+ or Opus 4.6+ (uses effort + adaptive thinking)
   */
  private isClaudeFiveOrNewer(model: string): boolean {
    // Claude 5 models
    if (model.includes('claude-5') || 
        model.includes('claude-sonnet-5') || 
        model.includes('claude-opus-5') ||
        model.includes('claude-fable-5') ||
        model.includes('claude-haiku-5')) {
      return true;
    }
    
    // Opus 4.6+ also supports adaptive thinking + effort
    if (model.includes('claude-opus-4')) {
      const versionMatch = model.match(/opus-4[.-](\d+)/);
      if (versionMatch) {
        const minorVersion = parseInt(versionMatch[1], 10);
        return minorVersion >= 6;
      }
    }
    
    return false;
  }
  
  /**
   * Map temperature (0-1) to effort parameter for Claude 5+
   * 
   * Note: 'high' effort is the default, so we only return it when explicitly needed.
   * This optimization keeps prompt caching more stable by avoiding unnecessary
   * output_config changes.
   * 
   * Low temperature (0-0.3) = low effort (deterministic)
   * Medium temperature (0.4-0.6) = medium effort (balanced)
   * High temperature (0.7-1.0) = high effort (creative, default)
   */
  private mapTemperatureToEffort(temperature: number): 'low' | 'medium' | 'high' {
    if (temperature <= 0.3) return 'low';
    if (temperature <= 0.6) return 'medium';
    return 'high';
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
