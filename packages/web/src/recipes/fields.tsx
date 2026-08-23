import type { ReactNode } from 'react';
import type { ErrorFields } from '../api/client.js';

// Shared form primitives. Each field owns its own label/description/error
// wiring so every input in the recipe form announces errors the same way
// (technical design section 11.3).

export function fieldError(fields: ErrorFields, path: string): string | null {
  const messages = fields[path];
  return messages && messages.length > 0 ? messages[0] : null;
}

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
}

export function Field({ id, label, hint, error, required, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={`rc-field${error ? ' rc-field--invalid' : ''}`}>
      <label className="rc-field__label" htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {hint ? (
        <p className="rc-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p className="rc-field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Inputs need the same aria wiring as the field that wraps them; keeping it in
// one helper stops a field from drifting out of sync with its own error.
export function describedBy(id: string, hint?: string, error?: string | null): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}
