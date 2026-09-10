import OpenAI from 'openai';
import type {
  InvestigationProvider,
  InvestigationProviderRequest,
  InvestigationResult,
} from '../types';
import {
  type InvestigationProviderConfig,
  InvestigationProviderConfigError,
  InvestigationProviderRequestError,
  InvestigationProviderTimeoutError,
  InvestigationProviderValidationError,
  logSafeProviderMetrics,
  validateInvestigationOutput,
} from '../aiProvider';
import {
  buildInvestigationMessages,
  INVESTIGATION_RESULT_JSON_SCHEMA,
} from '../prompt';

export interface OpenAIClientLike {
  readonly chat: {
    readonly completions: {
      create(
        params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming
      ): Promise<OpenAI.Chat.ChatCompletion>;
    };
  };
}

export class OpenAIInvestigationProvider implements InvestigationProvider {
  public readonly name = 'openai';
  private readonly client: OpenAIClientLike;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config?: InvestigationProviderConfig, customClient?: OpenAIClientLike) {
    this.model = config?.model || process.env.NEXUS_AI_INVESTIGATION_MODEL || 'gpt-4o-mini';

    const envTimeout = process.env.NEXUS_AI_INVESTIGATION_TIMEOUT_MS;
    const parsedEnvTimeout = envTimeout ? parseInt(envTimeout, 10) : NaN;
    this.timeoutMs =
      config?.timeoutMs ??
      (Number.isFinite(parsedEnvTimeout) && parsedEnvTimeout > 0 ? parsedEnvTimeout : 30_000);

    if (customClient) {
      this.client = customClient;
    } else {
      const apiKey = config?.apiKey || process.env.OPENAI_API_KEY;
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        throw new InvestigationProviderConfigError(
          'OpenAI API key is missing. Please set OPENAI_API_KEY in server environment variables.'
        );
      }
      this.client = new OpenAI({
        apiKey: apiKey.trim(),
        timeout: this.timeoutMs,
      });
    }
  }

  public getModel(): string {
    return this.model;
  }

  public getTimeoutMs(): number {
    return this.timeoutMs;
  }

  public async generateInvestigation(
    request: InvestigationProviderRequest
  ): Promise<InvestigationResult> {
    const startTime = Date.now();

    if (!request || !request.context) {
      throw new InvestigationProviderRequestError('Investigation request or context is missing.');
    }

    const messages = buildInvestigationMessages(request);

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'investigation_result',
            strict: true,
            schema: INVESTIGATION_RESULT_JSON_SCHEMA,
          },
        },
        temperature: 0.1,
      });

      const choice = completion.choices?.[0];
      const rawContent = choice?.message?.content;

      if (!rawContent || typeof rawContent !== 'string') {
        throw new InvestigationProviderRequestError('OpenAI provider returned empty response content.');
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawContent);
      } catch {
        throw new InvestigationProviderValidationError('AI provider returned malformed non-JSON payload.');
      }

      const validatedOutput = validateInvestigationOutput(
        parsedJson,
        request.context,
        this.model,
        { serverTimestamp: new Date().toISOString() }
      );

      const durationMs = Date.now() - startTime;
      logSafeProviderMetrics({
        provider: this.name,
        model: this.model,
        durationMs,
        success: true,
      });

      return validatedOutput;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorName = error instanceof Error ? error.name : 'UnknownError';

      // Distinguish timeout errors
      const isTimeout =
        errorName === 'APIConnectionTimeoutError' ||
        (error instanceof Error && error.message.toLowerCase().includes('timeout'));

      let finalError: Error;

      if (
        error instanceof InvestigationProviderConfigError ||
        error instanceof InvestigationProviderValidationError ||
        error instanceof InvestigationProviderTimeoutError ||
        error instanceof InvestigationProviderRequestError
      ) {
        finalError = error;
      } else if (isTimeout) {
        finalError = new InvestigationProviderTimeoutError(
          `OpenAI provider request timed out after ${this.timeoutMs}ms.`
        );
      } else {
        // Safe generic message never exposing upstream payloads, tokens, or headers
        finalError = new InvestigationProviderRequestError(
          'OpenAI provider request failed. Upstream communication error.'
        );
      }

      logSafeProviderMetrics({
        provider: this.name,
        model: this.model,
        durationMs,
        success: false,
        errorType: finalError.name,
      });

      throw finalError;
    }
  }
}

export function createOpenAIInvestigationProvider(
  config?: InvestigationProviderConfig,
  customClient?: OpenAIClientLike
): InvestigationProvider {
  return new OpenAIInvestigationProvider(config, customClient);
}
