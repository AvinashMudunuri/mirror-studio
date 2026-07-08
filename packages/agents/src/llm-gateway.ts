import Anthropic from '@anthropic-ai/sdk';
import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';
import OpenAI from 'openai';
import { LLM_CONFIG } from './config';

/**
 * LLM Gateway - Unified interface for multiple LLM providers
 * 
 * Supports:
 * - Claude (Anthropic) - Primary for complex reasoning, callable via
 *   either the direct Anthropic API or AWS Bedrock (see `claudeBackend`)
 * - GPT (OpenAI) - Secondary/fallback
 * 
 * Features:
 * - Adaptive-thinking token headroom for Claude 5+ (max_tokens caps
 *   thinking + response text combined, so the requested budget is
 *   reserved for the response and headroom is added for thinking)
 * - Automatic retry with a larger budget / lower effort when a response
 *   is thinking-only or truncated (stop_reason: max_tokens)
 * 
 * Not yet implemented: rate limiting, cost tracking, response caching.
 */

export interface LLMConfig {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  defaultProvider?: 'claude' | 'gpt';
  defaultModel?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  /**
   * Which backend serves Claude calls. 'anthropic' (default) calls the
   * Anthropic API directly using `anthropicApiKey`. 'bedrock' calls the
   * same Claude models through AWS Bedrock instead, authenticated with
   * AWS credentials (see `bedrock` below) rather than an Anthropic API
   * key. The two backends take different model ID strings — e.g. the
   * direct API's `claude-sonnet-5` vs a Bedrock ID/inference-profile like
   * `us.anthropic.claude-sonnet-5` — so `model`/`defaultModel` must match
   * whichever backend is selected. Defaults to LLM_CONFIG.claude.backend
   * (env CLAUDE_BACKEND).
   */
  claudeBackend?: 'anthropic' | 'bedrock';
  /**
   * AWS Bedrock connection, only used when claudeBackend === 'bedrock'.
   * All fields are optional — omit them to use the standard AWS
   * credential provider chain (env vars, ~/.aws/credentials, or an IAM
   * role), which is the recommended way to authenticate rather than
   * passing static keys here.
   */
  bedrock?: {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
  };
  /**
   * Hard cap on total tokens (input + output) consumed through this
   * gateway instance. When the budget is exhausted the NEXT call throws
   * TokenBudgetExceededError instead of hitting the API, so a runaway
   * pipeline stops spending. Undefined = unlimited.
   */
  maxTotalTokens?: number;
}

export interface LLMUsageStats {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /**
   * Prompt-cache accounting (Claude only, 0 if caching was never used).
   * `cacheCreationInputTokens` is billed at a premium over normal input;
   * `cacheReadInputTokens` at a steep discount (~10%). Both are already
   * included in `inputTokens`/`totalTokens` above — these are for
   * visibility into whether caching is actually paying off, not separate
   * spend.
   */
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  /** Per-model breakdown, since creation and review use different models. */
  byModel: Record<string, { calls: number; inputTokens: number; outputTokens: number; cacheReadInputTokens: number }>;
}

/**
 * One block of a structured system prompt. Plain strings remain the
 * common case; use an array when part of the system prompt is large and
 * stable enough to benefit from Anthropic prompt caching (e.g. content
 * shared byte-for-byte across multiple agents/calls in the same run).
 *
 * Order matters: `cache_control` marks "cache everything up to and
 * including this block" (tools -> system -> messages, in that order), so
 * put the STABLE content first with `cache: true`, and anything that
 * varies per call AFTER it.
 */
export interface LLMSystemBlock {
  text: string;
  cache?: boolean;
}

/** Thrown before an API call would exceed the configured token budget. */
export class TokenBudgetExceededError extends Error {
  readonly usage: LLMUsageStats;
  readonly budget: number;

  constructor(usage: LLMUsageStats, budget: number) {
    super(
      `LLM token budget exhausted: ${usage.totalTokens} of ${budget} tokens ` +
      `used over ${usage.calls} calls. Raise maxTotalTokens (MAX_RUN_TOKENS) or split the work.`
    );
    this.name = 'TokenBudgetExceededError';
    this.usage = usage;
    this.budget = budget;
  }
}

export interface LLMCallOptions {
  provider?: 'claude' | 'gpt';
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  /** Plain string (common case) or structured blocks for prompt caching — see LLMSystemBlock. */
  systemPrompt?: string | LLMSystemBlock[];
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

/**
 * Extra max_tokens reserved for adaptive thinking on Claude 5+ models.
 * max_tokens is a hard cap on thinking + response text combined, so the
 * agent's configured budget (intended for the response) needs headroom on
 * top, scaled by how much the model is expected to think at each effort.
 */
const THINKING_HEADROOM: Record<'low' | 'medium' | 'high', number> = {
  low: 2048,
  medium: 4096,
  high: 8192
};

/** Cost guard. Claude Sonnet 5 supports up to 128k output tokens. */
const MAX_TOTAL_OUTPUT_TOKENS = 32768;

/** Attempts per Claude call: initial + budget doubling + effort drop. */
const MAX_CLAUDE_ATTEMPTS = 3;

/**
 * Request timeout. The SDK default (10 min) is too short for non-streaming
 * requests with large max_tokens budgets: a 32k-token generation with
 * adaptive thinking regularly takes longer and dies in
 * APIConnectionTimeoutError (observed live on the retry-with-doubled-budget
 * path).
 */
const REQUEST_TIMEOUT_MS = 30 * 60 * 1000;

export class LLMGateway {
  private anthropic?: Anthropic;
  private bedrockClient?: AnthropicBedrock;
  private claudeBackend: 'anthropic' | 'bedrock';
  private openai?: OpenAI;
  private config: LLMConfig & {
    defaultProvider: 'claude' | 'gpt';
    defaultModel: string;
    defaultTemperature: number;
    defaultMaxTokens: number;
  };
  private usage: LLMUsageStats = {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    byModel: {}
  };
  
  constructor(config: LLMConfig) {
    this.config = {
      defaultProvider: 'claude',
      defaultModel: LLM_CONFIG.defaultModels.anthropic,
      defaultTemperature: LLM_CONFIG.temperatures.balanced,
      defaultMaxTokens: LLM_CONFIG.maxTokens.medium,
      ...config
    };

    this.claudeBackend = config.claudeBackend || LLM_CONFIG.claude.backend;

    if (this.claudeBackend === 'bedrock') {
      // Static creds are optional and must be provided as a pair (the SDK's
      // overloads reject one without the other) — omitted entirely, the
      // SDK falls back to the standard AWS credential provider chain (env
      // vars, ~/.aws/credentials, IAM role), which is the common case.
      const bedrockOptions: Record<string, unknown> = { timeout: REQUEST_TIMEOUT_MS };
      if (config.bedrock?.region) bedrockOptions.awsRegion = config.bedrock.region;
      if (config.bedrock?.accessKeyId && config.bedrock?.secretAccessKey) {
        bedrockOptions.awsAccessKey = config.bedrock.accessKeyId;
        bedrockOptions.awsSecretKey = config.bedrock.secretAccessKey;
        if (config.bedrock?.sessionToken) bedrockOptions.awsSessionToken = config.bedrock.sessionToken;
      }
      this.bedrockClient = new AnthropicBedrock(bedrockOptions as ConstructorParameters<typeof AnthropicBedrock>[0]);
    } else if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({
        apiKey: config.anthropicApiKey,
        timeout: REQUEST_TIMEOUT_MS
      });
    }

    if (config.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey
      });
    }

    if (!this.anthropic && !this.bedrockClient && !this.openai) {
      console.warn('[LLM] No API keys provided - LLM calls will fail');
    }
  }

  /** The Claude client for the currently configured backend, if any. */
  private get claudeClient(): Anthropic | AnthropicBedrock | undefined {
    return this.claudeBackend === 'bedrock' ? this.bedrockClient : this.anthropic;
  }

  /**
   * Call an LLM with a prompt
   */
  async call(
    userPrompt: string,
    options: LLMCallOptions = {}
  ): Promise<LLMResponse> {
    this.assertWithinBudget();
    
    const provider = options.provider || this.config.defaultProvider;
    
    // Usage is recorded per API attempt inside the provider methods, so
    // retried (truncated/thinking-only) attempts count against the budget.
    if (provider === 'claude') {
      return await this.callClaude(userPrompt, options);
    }
    return await this.callGPT(userPrompt, options);
  }
  
  /** Cumulative token usage across all calls through this gateway. */
  getUsageStats(): LLMUsageStats {
    return {
      ...this.usage,
      byModel: Object.fromEntries(
        Object.entries(this.usage.byModel).map(([k, v]) => [k, { ...v }])
      )
    };
  }
  
  private assertWithinBudget(): void {
    const budget = this.config.maxTotalTokens;
    if (budget !== undefined && this.usage.totalTokens >= budget) {
      throw new TokenBudgetExceededError(this.getUsageStats(), budget);
    }
  }
  
  private recordUsage(
    model: string,
    rawInputTokens: number,
    outputTokens: number,
    cacheCreationInputTokens = 0,
    cacheReadInputTokens = 0
  ): void {
    // Anthropic's `input_tokens` is ONLY the tokens after the last cache
    // breakpoint — cache_creation/cache_read tokens are accounted
    // separately and are NOT included in it:
    //   total_input_tokens = cache_read + cache_creation + input_tokens
    // (confirmed live: a cached reviewer call reported input_tokens in the
    // low thousands while cache_read_input_tokens carried the rest of the
    // ~20k-token episode payload.) Summing them here so inputTokens/
    // totalTokens — and the MAX_RUN_TOKENS budget check against
    // totalTokens — reflect what was actually processed, not just the
    // uncached remainder.
    const inputTokens = rawInputTokens + cacheCreationInputTokens + cacheReadInputTokens;
    
    this.usage.calls += 1;
    this.usage.inputTokens += inputTokens;
    this.usage.outputTokens += outputTokens;
    this.usage.totalTokens += inputTokens + outputTokens;
    this.usage.cacheCreationInputTokens += cacheCreationInputTokens;
    this.usage.cacheReadInputTokens += cacheReadInputTokens;
    
    const entry = this.usage.byModel[model] ||
      (this.usage.byModel[model] = { calls: 0, inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0 });
    entry.calls += 1;
    entry.inputTokens += inputTokens;
    entry.outputTokens += outputTokens;
    entry.cacheReadInputTokens += cacheReadInputTokens;
  }

  /**
   * Call Claude (Anthropic)
   * 
   * For Claude 5+ (adaptive thinking), max_tokens caps thinking + response
   * text COMBINED. A tight budget can be consumed entirely by thinking,
   * yielding a thinking-only response with no text block and
   * stop_reason: 'max_tokens'. To handle this:
   * 
   * 1. Headroom for thinking (scaled by effort) is added on top of the
   *    caller's requested response budget.
   * 2. If the response is still thinking-only or truncated, retry with a
   *    doubled budget, then with effort lowered one level (less thinking).
   * 3. If no attempt produces text, throw instead of returning ''.
   */
  private async callClaude(
    userPrompt: string,
    options: LLMCallOptions
  ): Promise<LLMResponse> {
    const client = this.claudeClient;
    if (!client) {
      throw new Error(
        this.claudeBackend === 'bedrock'
          ? 'AWS Bedrock backend selected (CLAUDE_BACKEND=bedrock) but the Bedrock client failed to initialize'
          : 'Anthropic API key not configured'
      );
    }

    const model = options.model || this.config.defaultModel;
    const requestedTokens = options.maxTokens || this.config.defaultMaxTokens;
    
    // Claude 5+ models use 'effort' instead of 'temperature'
    // Map temperature to effort: low temp = low effort, high temp = high effort
    const temperature = options.temperature ?? this.config.defaultTemperature;
    const isModern = this.isClaudeFiveOrNewer(model);
    
    let effort = this.mapTemperatureToEffort(temperature);
    let maxTokens = isModern
      ? Math.min(requestedTokens + THINKING_HEADROOM[effort], MAX_TOTAL_OUTPUT_TOKENS)
      : requestedTokens;

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: userPrompt
      }
    ];

    let lastResponse: Anthropic.Message | undefined;
    
    for (let attempt = 1; attempt <= MAX_CLAUDE_ATTEMPTS; attempt++) {
      // The first attempt was budget-checked in call(); retries burn extra
      // tokens, so re-check before each one.
      if (attempt > 1) this.assertWithinBudget();
      console.log(
        `[LLM] Calling Claude (${model}) with ${userPrompt.length} chars` +
        (isModern ? ` (attempt ${attempt}, max_tokens=${maxTokens}, effort=${effort})` : '')
      );

      // Build request params based on model version
      const requestParams: any = {
        model,
        max_tokens: maxTokens,
        messages,
        system: this.buildSystemParam(options.systemPrompt),
        stop_sequences: options.stopSequences
      };
      
      // Claude 5+ (and Opus 4.6+) use adaptive thinking + output_config.effort.
      // `effort` is NOT a top-level param — it's nested under output_config,
      // and requires thinking: { type: 'adaptive' } alongside it.
      if (isModern) {
        requestParams.thinking = { type: 'adaptive' };
        // Only set output_config if effort is not 'high' (high is default)
        // This keeps prompt caching more stable
        if (effort !== 'high') {
          requestParams.output_config = { effort };
        }
      } else {
        requestParams.temperature = temperature;
      }

      // AnthropicBedrock.messages.create() shares the same request/response
      // shape as the direct Anthropic client for non-streaming calls (it
      // only adapts the wire format for streaming, which this gateway
      // never uses) — so requestParams and the response handling below are
      // identical across both backends. Cast needed because TS can't unify
      // the two clients' overloaded `messages.create` signatures.
      const create = client.messages.create.bind(client.messages) as (params: unknown) => Promise<Anthropic.Message>;
      const response: Anthropic.Message = await create(requestParams);
      lastResponse = response;
      // cache_creation_input_tokens / cache_read_input_tokens aren't in this
      // SDK version's stable Usage type (prompt caching predates it there),
      // but the API returns them regardless — read them defensively.
      const usageAny = response.usage as any;
      const cacheCreationInputTokens = usageAny.cache_creation_input_tokens || 0;
      const cacheReadInputTokens = usageAny.cache_read_input_tokens || 0;
      this.recordUsage(model, response.usage.input_tokens, response.usage.output_tokens, cacheCreationInputTokens, cacheReadInputTokens);
      if (cacheCreationInputTokens > 0 || cacheReadInputTokens > 0) {
        console.log(`[LLM] Cache: ${cacheCreationInputTokens} tokens written, ${cacheReadInputTokens} tokens read (${model})`);
      }

      // Claude 5+ with adaptive thinking returns thinking blocks + text blocks
      console.log(`[LLM] Response contains ${response.content.length} content blocks:`);
      response.content.forEach((block, i) => {
        console.log(`[LLM]   Block ${i}: type=${block.type}, length=${block.type === 'text' ? block.text.length : 'N/A'}`);
      });
      
      // Find the text block (don't assume content[0] is text)
      const textBlock = response.content.find(b => b.type === 'text');
      const text = textBlock?.type === 'text' ? textBlock.text : '';
      const truncated = response.stop_reason === 'max_tokens';
      
      if (text && !truncated) {
        console.log(`[LLM] Extracted text block with ${text.length} characters`);
        return this.toClaudeResponse(text, model, response);
      }
      
      // Thinking-only or truncated response — adjust and retry.
      console.warn(
        `[LLM] ${text ? 'Truncated' : 'Thinking-only'} response ` +
        `(stop_reason=${response.stop_reason}, output_tokens=${response.usage.output_tokens})`
      );
      
      if (!isModern) {
        // Older models don't think; truncated text is the best we can do.
        break;
      }
      
      if (attempt === 1 && maxTokens < MAX_TOTAL_OUTPUT_TOKENS) {
        maxTokens = Math.min(maxTokens * 2, MAX_TOTAL_OUTPUT_TOKENS);
        console.warn(`[LLM] Retrying with larger budget: max_tokens=${maxTokens}`);
      } else if (effort !== 'low') {
        effort = effort === 'high' ? 'medium' : 'low';
        console.warn(`[LLM] Retrying with reduced thinking: effort=${effort}`);
      } else {
        break;
      }
    }
    
    // Retries exhausted. Truncated text is still returned (callers'
    // JSON repair may salvage it); a thinking-only result is an error.
    const finalTextBlock = lastResponse?.content.find(b => b.type === 'text');
    const finalText = finalTextBlock?.type === 'text' ? finalTextBlock.text : '';
    
    if (finalText) {
      console.warn(`[LLM] Returning truncated text (${finalText.length} chars) after ${MAX_CLAUDE_ATTEMPTS} attempts`);
      return this.toClaudeResponse(finalText, model, lastResponse!);
    }
    
    throw new Error(
      `[LLM] Claude (${model}) returned no text after ${MAX_CLAUDE_ATTEMPTS} attempts — ` +
      `the token budget was consumed by adaptive thinking ` +
      `(last stop_reason=${lastResponse?.stop_reason}, ` +
      `output_tokens=${lastResponse?.usage.output_tokens}). ` +
      `Increase the agent's max tokens (e.g. DIALOGUE_WRITER_MAX_TOKENS) or lower its temperature/effort.`
    );
  }
  
  /**
   * A plain string system prompt passes through unchanged. An array of
   * LLMSystemBlock becomes Anthropic content blocks, with `cache_control`
   * on any block marked `cache: true` (and everything before it, per
   * Anthropic's "tools -> system -> messages" prefix rule).
   */
  private buildSystemParam(systemPrompt: string | LLMSystemBlock[] | undefined): any {
    if (!Array.isArray(systemPrompt)) return systemPrompt;
    return systemPrompt.map(block =>
      block.cache
        ? { type: 'text', text: block.text, cache_control: { type: 'ephemeral' } }
        : { type: 'text', text: block.text }
    );
  }

  private toClaudeResponse(text: string, model: string, response: Anthropic.Message): LLMResponse {
    // Same cache-token accounting as recordUsage() — input_tokens alone
    // excludes cache_creation/cache_read tokens.
    const usageAny = response.usage as any;
    const inputTokens = response.usage.input_tokens + (usageAny.cache_creation_input_tokens || 0) + (usageAny.cache_read_input_tokens || 0);
    return {
      content: text,
      model,
      provider: 'claude',
      usage: {
        inputTokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: inputTokens + response.usage.output_tokens
      },
      stopReason: response.stop_reason || 'end_turn'
    };
  }
  
  /**
   * Check if model is Claude 5+ or Opus 4.6+ (uses effort + adaptive thinking)
   *
   * Uses substring matching, so this also works for AWS Bedrock model/
   * inference-profile IDs (e.g. `us.anthropic.claude-sonnet-5`), which
   * embed the same `claude-{name}-{version}` substring as the direct
   * Anthropic API's model names.
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
      // GPT has no equivalent of Anthropic's cache_control; blocks are
      // just concatenated back into one system message.
      const systemText = Array.isArray(options.systemPrompt)
        ? options.systemPrompt.map(block => block.text).join('\n\n')
        : options.systemPrompt;
      messages.push({
        role: 'system',
        content: systemText
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
    this.recordUsage(model, response.usage?.prompt_tokens || 0, response.usage?.completion_tokens || 0);

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
