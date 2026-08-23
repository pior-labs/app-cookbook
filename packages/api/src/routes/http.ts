import { idParamSchema } from '@cookbook/domain';
import type { Context } from 'hono';
import type { z } from 'zod';
import { validationError, zodValidationError } from '../errors.js';
import type { AppEnv } from '../middleware/context.js';

// Request parsing shared by every route module. Routes translate HTTP into
// validated input and nothing else; domain schemas own the rules and services
// own the transaction (technical design section 3).

export function idParam(c: Context<AppEnv>, label: string, name = 'id'): number {
  const parsed = idParamSchema.safeParse(c.req.param(name));

  if (!parsed.success) {
    throw validationError(`That is not a valid ${label} ID.`, {
      [name]: [`Expected a ${label} ID.`],
    });
  }

  return parsed.data;
}

export async function parseBody<T extends z.ZodType>(
  c: Context<AppEnv>,
  schema: T,
): Promise<z.infer<T>> {
  let raw: unknown;

  try {
    raw = await c.req.json();
  } catch {
    throw validationError('Send a JSON request body.');
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw zodValidationError(parsed.error);
  }

  return parsed.data;
}

// Query parameters as the schemas expect them: a repeated parameter such as
// `tagId=1&tagId=2` stays an array, while a single occurrence stays a scalar.
// `c.req.query()` alone would silently drop every repeat but the first.
export function parseQuery<T extends z.ZodType>(c: Context<AppEnv>, schema: T): z.infer<T> {
  const raw: Record<string, string | string[]> = {};

  for (const [key, values] of Object.entries(c.req.queries())) {
    raw[key] = values.length > 1 ? values : values[0];
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw zodValidationError(parsed.error);
  }

  return parsed.data;
}
