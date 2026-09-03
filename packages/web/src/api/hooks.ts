import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError } from './client.js';

// Small async primitives shared by the recipe screens. They exist so every
// screen reports loading, error, and retry the same way (technical design
// section 11.3) without pulling in a caching layer the app does not yet need.

export interface AsyncResource<T> {
  data: T | null;
  error: ApiRequestError | null;
  loading: boolean;
  reload: () => void;
  // Writes the answer a mutation already gave into what is on screen, for the
  // changes where refetching would only confirm what the response said. A
  // reload redraws the whole list; this redraws the row that changed.
  apply: (update: (current: T) => T) => void;
}

// Loads once per key change and exposes an explicit retry. The in-flight
// request is aborted on unmount and whenever a reload supersedes it, so a slow
// response can never overwrite newer state.
export function useApiResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): AsyncResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    loadRef
      .current(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          caught instanceof ApiRequestError
            ? caught
            : new ApiRequestError(0, 'unknown_error', 'Something went wrong.'),
        );
        setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  const apply = useCallback((update: (current: T) => T) => {
    setData((current) => (current === null ? current : update(current)));
  }, []);

  return { data, error, loading, reload, apply };
}

// The result is returned rather than only stored in state: `error` is state and
// is still the previous render's value immediately after `run` resolves, so a
// caller that branched on it would miss the failure it just caused.
export type MutationResult<TResult> =
  | { ok: true; data: TResult }
  | { ok: false; error: ApiRequestError };

export interface Mutation<TArgs extends unknown[], TResult> {
  run: (...args: TArgs) => Promise<MutationResult<TResult>>;
  submitting: boolean;
  error: ApiRequestError | null;
  reset: () => void;
}

// Wraps a mutation so a screen gets submitting state and a parsed error without
// repeating try/catch. The error is returned as state rather than thrown,
// because the form must survive a failure with its entered values intact
// (section 11.2).
export function useMutation<TArgs extends unknown[], TResult>(
  mutate: (...args: TArgs) => Promise<TResult>,
): Mutation<TArgs, TResult> {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;

  const run = useCallback(async (...args: TArgs): Promise<MutationResult<TResult>> => {
    setSubmitting(true);
    setError(null);

    try {
      const data = await mutateRef.current(...args);
      if (mounted.current) setSubmitting(false);
      return { ok: true, data };
    } catch (caught: unknown) {
      const failure =
        caught instanceof ApiRequestError
          ? caught
          : new ApiRequestError(0, 'unknown_error', 'Something went wrong.');

      if (mounted.current) {
        setError(failure);
        setSubmitting(false);
      }
      return { ok: false, error: failure };
    }
  }, []);

  const reset = useCallback(() => setError(null), []);

  return { run, submitting, error, reset };
}
