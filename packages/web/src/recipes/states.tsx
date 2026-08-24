import type { ReactNode } from 'react';
import type { ApiRequestError } from '../api/client.js';
import { Panel } from '@/components/ui';
import { cn } from '@/lib/utils';

// The loading, error, and empty states every recipe screen shares
// (technical design section 11.3).

// Layout-preserving skeletons: the page keeps its shape while loading so
// content does not jump into place.
function Line({ className }: { className?: string }) {
  return <div className={cn('h-3 rounded-full bg-[var(--cb-muted-track)]', className)} />;
}

export function RecipeSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite">
      <span className="sr-only">Loading recipe…</span>
      <div className="aspect-[16/9] w-full rounded-4xl bg-[var(--cb-muted-track)]" />
      <div className="flex flex-col gap-3">
        <Line className="h-8 w-3/5" />
        <Line className="w-4/5" />
      </div>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <div className="flex flex-col gap-2.5">
          <Line />
          <Line className="w-5/6" />
          <Line className="w-2/3" />
        </div>
        <div className="flex flex-col gap-2.5">
          <Line />
          <Line className="w-3/4" />
        </div>
      </div>
    </div>
  );
}

// An empty screen is an invitation to act, so it always leaves with something
// to press.
export function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <Panel className="text-center">
      <p className="m-0 font-serif text-[24px] leading-tight font-normal tracking-[-0.02em] text-ink sm:text-[28px]">
        {title}
      </p>
      <p className="mx-auto mt-2 mb-0 max-w-110 text-[15px] text-ink-2">{body}</p>
      {children ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">{children}</div>
      ) : null}
    </Panel>
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
    <div
      className="rounded-[26px] border border-[var(--cb-danger-border)] bg-[var(--cb-danger-surface)] p-5 text-center sm:rounded-4xl sm:p-7"
      role="alert"
    >
      <p className="m-0 font-serif text-[22px] leading-tight font-normal tracking-[-0.02em] text-[var(--cb-danger-ink-strong)] sm:text-[26px]">
        {error.isNotFound ? 'That recipe is not here.' : 'Something interrupted this.'}
      </p>
      <p className="mx-auto mt-2 mb-0 max-w-110 text-[15px] text-ink-2">{error.message}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        {onRetry && !error.isNotFound ? (
          <button
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-ink/10 bg-ink px-5 py-2 text-[15px] font-medium text-cream shadow-[var(--cb-action-shadow)] transition-[background-color,transform] duration-200 hover:-translate-y-px hover:bg-[var(--cb-action-hover-bg)] focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-cream focus-visible:outline-none motion-reduce:hover:translate-y-0"
            type="button"
            onClick={onRetry}
          >
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
  return <Banner>{error.message}</Banner>;
}

export function Banner({ children }: { children: ReactNode }) {
  return (
    <p
      className="m-0 rounded-2xl border border-[var(--cb-danger-border)] bg-[var(--cb-danger-surface)] px-4 py-3 text-[14px] font-medium text-[var(--cb-danger-ink-strong)]"
      role="alert"
    >
      {children}
    </p>
  );
}
