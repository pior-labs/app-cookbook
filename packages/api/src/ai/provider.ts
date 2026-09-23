import { readFileSync } from 'node:fs';
import { z } from 'zod';

export interface ModelRequest {
  task: string;
  instructions: string;
  input: unknown;
  schema: z.ZodType;
}
export interface ModelResult {
  value: unknown;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}
export type ModelProvider = (request: ModelRequest) => Promise<ModelResult>;

// Responses API's strict structured-output contract:
// https://developers.openai.com/api/docs/guides/structured-outputs

// Logs are deliberately metadata-only and use stderr so this adapter is also
// safe inside the stdio MCP process. Ingredient decisions live in the grocery
// snapshot; recipe text, preferences, credentials and raw provider errors never
// go to logs. No SDK retries: one bounded attempt, then the domain fallback.
export function aiEvent(event: Record<string, unknown>): void {
  console.error(JSON.stringify({ event: 'cookbook_ai', ...event }));
}
let activeRequests = 0;
export const openAIProvider: ModelProvider = async (request) => {
  const start = performance.now();
  const model = process.env.COOKBOOK_AI_MODEL;
  // No unbounded queue of paid work. Each process permits two simultaneous
  // requests; overload follows the same visible fallback as an outage.
  if (activeRequests >= 2) {
    aiEvent({ task: request.task, status: 'capacity_exceeded', fallback: true });
    throw new Error('AI provider busy');
  }
  activeRequests++;
  let failure = 'configuration';
  try {
    const key = process.env.OPENAI_API_KEY_FILE
      ? readFileSync(process.env.OPENAI_API_KEY_FILE, 'utf8').trim()
      : process.env.OPENAI_API_KEY;
    if (!key || !model) throw new Error('unconfigured');
    const timeout = Number(process.env.COOKBOOK_AI_TIMEOUT_MS ?? 20000);
    if (!Number.isInteger(timeout) || timeout < 100 || timeout > 60000)
      throw new Error('invalid_config');
    failure = 'network_or_timeout';
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: AbortSignal.timeout(timeout),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 12000,
        instructions: request.instructions,
        input: JSON.stringify(request.input),
        text: {
          format: {
            type: 'json_schema',
            name: request.task,
            strict: true,
            schema: z.toJSONSchema(request.schema),
          },
        },
      }),
    });
    if (!response.ok) {
      failure = `http_${response.status}`;
      throw new Error('http_failure');
    }
    failure = 'invalid_provider_response';
    const body = (await response.json()) as {
      status?: string;
      output?: { type: string; content?: { type: string; text?: string }[] }[];
      usage?: { input_tokens: number; output_tokens: number };
    };
    if (body.status !== 'completed') {
      failure = 'incomplete';
      throw new Error('incomplete');
    }
    const content = body.output
      ?.filter((item) => item.type === 'message')
      .flatMap((item) => item.content ?? []);
    if (!content?.length || content.some((item) => item.type !== 'output_text')) {
      failure = 'refusal_or_empty';
      throw new Error('refusal');
    }
    const value = JSON.parse(content.map((item) => item.text ?? '').join('')) as unknown;
    const result = {
      value,
      model,
      latencyMs: Math.round(performance.now() - start),
      inputTokens: body.usage?.input_tokens ?? 0,
      outputTokens: body.usage?.output_tokens ?? 0,
    };
    aiEvent({
      task: request.task,
      status: 'received',
      model,
      latencyMs: result.latencyMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
    return result;
  } catch {
    aiEvent({
      task: request.task,
      status: 'provider_failure',
      failure,
      model: model ?? null,
      latencyMs: Math.round(performance.now() - start),
    });
    // A safe error, including when a provider response embeds submitted data.
    throw new Error('AI provider unavailable');
  } finally {
    activeRequests--;
  }
};
