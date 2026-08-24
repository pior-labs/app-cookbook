import type { ReactNode } from 'react';
import type { ErrorFields } from '../api/client.js';
import { FieldError, FieldHint, FieldLabel } from '@/components/ui';

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

// A required field is marked visually with an asterisk and programmatically
// with `aria-required` on its own control, because the asterisk is decoration
// a screen reader is right to skip.
export function Field({ id, label, hint, error, required, children }: FieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <FieldLabel htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true" className="text-accent"> *</span> : null}
      </FieldLabel>
      {hint ? <FieldHint id={`${id}-hint`}>{hint}</FieldHint> : null}
      {children}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </div>
  );
}

// Inputs need the same aria wiring as the field that wraps them; keeping it in
// one helper stops a field from drifting out of sync with its own error.
export function describedBy(id: string, hint?: string, error?: string | null): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}
