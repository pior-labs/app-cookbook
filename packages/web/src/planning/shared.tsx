import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { apiGet, ApiRequestError } from '../api/client.js';
import { useApiResource } from '../api/hooks.js';
import { useAuth } from '../auth.js';
import { useModalOverlay } from '../lib/overlay.js';
import { Button, Panel } from '@/components/ui';

export function usePlanningResource<T>(path: string) {
  const resource = useApiResource<T>((signal) => apiGet(path, signal), [path]);
  const { refreshSession } = useAuth();
  useEffect(() => {
    if (resource.error?.isUnauthorized) void refreshSession();
  }, [resource.error, refreshSession]);
  return resource;
}

export function usePlanningAction() {
  const { refreshSession } = useAuth();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = useCallback(
    async (action: () => Promise<void>) => {
      if (pending.current) return false;
      pending.current = true;
      setBusy(true);
      setError('');
      try {
        await action();
        return true;
      } catch (error) {
        if (error instanceof ApiRequestError && error.isUnauthorized) await refreshSession();
        const fields =
          error instanceof ApiRequestError ? Object.values(error.fields).flat().join(' ') : '';
        setError(
          fields || (error instanceof Error ? error.message : 'Could not save. Please try again.'),
        );
        return false;
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
    [refreshSession],
  );
  return { busy, error, run, clearError: () => setError('') };
}
export function PlanningError({ error, reload }: { error: string; reload?: () => void }) {
  return error ? (
    <Panel>
      <p role="alert">{error}</p>
      {reload ? <Button onClick={reload}>Reload latest</Button> : null}
    </Panel>
  ) : null;
}
export function PlanningDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null);
  useModalOverlay({ open: true, dialogRef: ref, triggerRef: trigger, onClose });
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-3 backdrop-blur-sm">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-[26px] bg-cream p-5 text-ink shadow-xl sm:p-7"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="m-0 font-serif text-3xl">{title}</h2>
          <Button onClick={onClose}>Close</Button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
