// The single place the web app talks to the API. Every response is either a
// typed payload or an `ApiRequestError` carrying the shared error envelope, so
// screens never parse raw responses or invent their own error shapes
// (technical design section 7.1).

export type ErrorFields = Record<string, string[]>;

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: ErrorFields;

  constructor(status: number, code: string, message: string, fields: ErrorFields = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  // Losing the session mid-flow is not a form error: the app returns to login
  // rather than showing stale protected data (section 11.3).
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isVersionConflict(): boolean {
    return this.code === 'recipe_version_conflict';
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

const NETWORK_MESSAGE = 'Could not reach the Cookbook. Check your connection and try again.';

function envelopeFrom(payload: unknown, status: number): ApiRequestError {
  const error = (payload as { error?: unknown } | null)?.error;

  if (error && typeof error === 'object') {
    const { code, message, fields } = error as Record<string, unknown>;

    return new ApiRequestError(
      status,
      typeof code === 'string' ? code : 'request_error',
      typeof message === 'string' ? message : 'Something went wrong.',
      (fields && typeof fields === 'object' ? fields : {}) as ErrorFields,
    );
  }

  return new ApiRequestError(status, 'request_error', 'Something went wrong.');
}

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(path, { credentials: 'include', ...init });
  } catch (error) {
    // A thrown fetch is a transport failure, not an API response. Aborts are
    // re-thrown untouched so callers can ignore their own cancellations.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiRequestError(0, 'network_error', NETWORK_MESSAGE);
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw envelopeFrom(payload, response.status);

  return payload as T;
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return parse<T>(await send(path, { signal }));
}

export async function apiSend<T>(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return parse<T>(
    await send(path, {
      method,
      signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

// Multipart uploads must not set Content-Type by hand; the browser adds the
// boundary (section 7.4).
export async function apiUpload<T>(path: string, field: string, file: File): Promise<T> {
  const form = new FormData();
  form.append(field, file);

  return parse<T>(await send(path, { method: 'PUT', body: form }));
}
