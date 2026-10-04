import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { openAIProvider } from './provider.js';

const request = {
  task: 'test',
  instructions: 'Interpret names.',
  input: ['onion'],
  schema: z.object({ name: z.string() }).strict(),
};
beforeEach(() => {
  vi.stubEnv('OPENAI_API_KEY', 'test-secret');
  vi.stubEnv('OPENAI_API_KEY_FILE', '');
  vi.stubEnv('COOKBOOK_AI_MODEL', 'test-model');
  vi.stubEnv('COOKBOOK_AI_TIMEOUT_MS', '100');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe('OpenAI structured-output adapter', () => {
  it('sends strict JSON schema with storage disabled and reports usage', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          status: 'completed',
          output: [
            { type: 'message', content: [{ type: 'output_text', text: '{"name":"onion"}' }] },
          ],
          usage: { input_tokens: 10, output_tokens: 4 },
        }),
      );
    vi.stubGlobal('fetch', fetch);
    const result = await openAIProvider(request);
    expect(result).toMatchObject({
      value: { name: 'onion' },
      inputTokens: 10,
      outputTokens: 4,
      model: 'test-model',
    });
    const [, init] = fetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      store: false,
      text: {
        format: { type: 'json_schema', strict: true, schema: { additionalProperties: false } },
      },
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  it('sends image content to the requested import model without changing the grocery model', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"name":"soup"}' }] }] }));
    vi.stubGlobal('fetch', fetch);
    await openAIProvider({ ...request, model: 'gpt-6-luna', imageDataUrl: 'data:image/png;base64,aGVsbG8=' });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.model).toBe('gpt-6-luna');
    expect(body.input[0].content[1]).toEqual({ type: 'input_image', image_url: 'data:image/png;base64,aGVsbG8=', detail: 'high' });
    expect(body.tools).toBeUndefined();
    expect(body.store).toBe(false);
    expect(process.env.COOKBOOK_AI_MODEL).toBe('test-model');
  });
  it.each([
    { status: 'incomplete', output: [] },
    {
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }],
    },
    {
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'invalid JSON' }] }],
    },
  ])('rejects incomplete, refused and invalid responses', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)));
    await expect(openAIProvider(request)).rejects.toThrow('AI provider unavailable');
  });
  it('aborts a stalled provider within the configured deadline', async () => {
    vi.stubGlobal(
      'fetch',
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const start = performance.now();
    await expect(openAIProvider(request)).rejects.toThrow('AI provider unavailable');
    expect(performance.now() - start).toBeLessThan(1000);
  });
  it('does not log credentials, raw provider errors, or ingredient data', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('test-secret onion')));
    await expect(openAIProvider(request)).rejects.toThrow('AI provider unavailable');
    const text = JSON.stringify(log.mock.calls);
    expect(text).not.toContain('test-secret');
    expect(text).not.toContain('onion');
    expect(text).toContain('latencyMs');
  });
});
