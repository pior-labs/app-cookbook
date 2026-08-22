// The single error model behind the API error envelope (technical design
// section 7.1). Every layer throws `ApiError`; the Hono error middleware is the
// only place that turns one into a response. Internal exceptions, SQL details,
// storage paths, tokens, and secrets never reach the client.

import type { ZodError } from 'zod';

// Field-scoped messages keyed by a dotted path such as `ingredients.2.name`.
export type ErrorFields = Record<string, string[]>;

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    fields: ErrorFields;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: ErrorFields;

  constructor(status: number, code: string, message: string, fields: ErrorFields = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  toBody(): ErrorBody {
    return { error: { code: this.code, message: this.message, fields: this.fields } };
  }
}

export function validationError(message: string, fields: ErrorFields = {}): ApiError {
  return new ApiError(400, 'validation_error', message, fields);
}

export function notFoundError(code: string, message: string): ApiError {
  return new ApiError(404, code, message);
}

export function conflictError(code: string, message: string, fields?: ErrorFields): ApiError {
  return new ApiError(409, code, message, fields);
}

export function recipeNotFound(): ApiError {
  return notFoundError('recipe_not_found', 'This recipe does not exist.');
}

export function recipeVersionConflict(): ApiError {
  return conflictError(
    'recipe_version_conflict',
    'This recipe changed after you opened it.',
  );
}

// Zod reports issues against a path segment array; the envelope uses a dotted
// string so a client can address a specific row in an ordered collection.
export function fieldsFromZodError(error: ZodError): ErrorFields {
  const fields: ErrorFields = {};

  for (const issue of error.issues) {
    const path = issue.path.map((segment) => String(segment)).join('.') || '_';
    (fields[path] ??= []).push(issue.message);
  }

  return fields;
}

export function zodValidationError(error: ZodError): ApiError {
  return validationError('Some values need attention.', fieldsFromZodError(error));
}
