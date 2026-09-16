import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import '../src/env.js';
import { normalizeIngredients } from '../src/ai/normalization.js';
import { openAIProvider } from '../src/ai/provider.js';

// Explicit opt-in command: CI uses provider fixtures and never spends tokens.
// JSONL on stdout can be saved outside the repo and compared across prompt or
// model changes. Pricing is supplied by the operator rather than going stale
// in code. Synthetic names are safe to include in these evaluation results.
if (
  !process.env.COOKBOOK_AI_MODEL ||
  !(process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_FILE)
) {
  throw new Error(
    'Configure COOKBOOK_AI_MODEL and OPENAI_API_KEY or OPENAI_API_KEY_FILE before running the live evaluation.',
  );
}
const fixtures = z
  .array(
    z.object({
      names: z.tuple([z.string(), z.string()]),
      merge: z.boolean(),
      reason: z.string().optional(),
    }),
  )
  .parse(JSON.parse(await readFile(new URL('./normalization.json', import.meta.url), 'utf8')));
let falseMerges = 0;
let missedMerges = 0;
let fallbacks = 0;
for (const fixture of fixtures) {
  const start = performance.now();
  let inputTokens = 0;
  let outputTokens = 0;
  const result = await normalizeIngredients(fixture.names, async (request) => {
    const output = await openAIProvider(request);
    inputTokens = output.inputTokens;
    outputTokens = output.outputTokens;
    return output;
  });
  const [a, b] = fixture.names;
  const automatic = (result.identities.get(a) ?? a) === (result.identities.get(b) ?? b);
  const proposed =
    automatic || result.suggestions.some((s) => s.names.includes(a) && s.names.includes(b));
  if (proposed && !fixture.merge) falseMerges++;
  if (!proposed && fixture.merge) missedMerges++;
  if (result.mode === 'fallback') fallbacks++;
  const inputRate = process.env.AI_EVAL_INPUT_USD_PER_MILLION;
  const outputRate = process.env.AI_EVAL_OUTPUT_USD_PER_MILLION;
  console.log(
    JSON.stringify({
      ...fixture,
      model: process.env.COOKBOOK_AI_MODEL,
      prompt: 'ingredient_normalization_v1',
      proposed,
      automatic,
      fallback: result.mode === 'fallback',
      latencyMs: Math.round(performance.now() - start),
      inputTokens,
      outputTokens,
      estimatedUsd:
        inputRate && outputRate
          ? (inputTokens * Number(inputRate) + outputTokens * Number(outputRate)) / 1e6
          : null,
    }),
  );
}
console.log(
  JSON.stringify({ summary: true, cases: fixtures.length, falseMerges, missedMerges, fallbacks }),
);
if (fallbacks || falseMerges || missedMerges) process.exitCode = 1;
