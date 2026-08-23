import type { ReactNode } from 'react';
import type { ApiRequestError } from '../api/client.js';

// The loading, error, and empty states every recipe screen shares
// (technical design section 11.3).

// Layout-preserving skeletons: the page keeps its shape while loading so
// content does not jump into place.
export function RecipeSkeleton() {
  return (
    <div className="rc-skeleton" role="status" aria-live="polite">
      <span className="rc-visually-hidden">Loading recipe…</span>
      <div className="rc-skeleton__photo" />
      <div className="rc-skeleton__line rc-skeleton__line--title" />
      <div className="rc-skeleton__line" />
      <div className="rc-skeleton__columns">
        <div>
          <div className="rc-skeleton__line" />
          <div className="rc-skeleton__line" />
          <div className="rc-skeleton__line" />
        </div>
        <div>
          <div className="rc-skeleton__line" />
          <div className="rc-skeleton__line" />
        </div>
      </div>
    </div>
  );
}

interface ErrorStateProps {
  error: ApiRequestError;
  onRetry?: () => void;
  children?: ReactNode;
}

// A network error keeps its context and offers retry; a 404 is a dead end and
// offers a way back instead.
export function ErrorState({ error, onRetry, children }: ErrorStateProps) {
  return (
    <div className="rc-state" role="alert">
      <p className="rc-state__title">
        {error.isNotFound ? 'That recipe is not here.' : 'Something interrupted this.'}
      </p>
      <p className="rc-state__body">{error.message}</p>
      <div className="rc-state__actions">
        {onRetry && !error.isNotFound ? (
          <button className="rc-button rc-button--primary" type="button" onClick={onRetry}>
            Try again
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
}

// A failed save that is not field-scoped: the form stays put and explains what
// happened above the actions.
export function FormErrorBanner({ error }: { error: ApiRequestError }) {
  return (
    <p className="rc-form__banner" role="alert">
      {error.message}
    </p>
  );
}
