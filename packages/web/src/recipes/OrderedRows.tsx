import type { ReactNode } from 'react';

// Ordered ingredient and instruction rows. Position comes from array order and
// is derived server-side, so reordering here only moves array entries
// (technical design section 12).
//
// Every reorder control is a real button: pointer, touch, and keyboard users
// all get the same affordance, which is what section 11.2 asks for rather than
// a drag-only interaction.

interface RowControlsProps {
  index: number;
  total: number;
  label: string;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

export function RowControls({
  index,
  total,
  label,
  onMove,
  onRemove,
  canRemove,
}: RowControlsProps) {
  const position = `${label} ${index + 1}`;

  return (
    <div className="rc-row__controls">
      <button
        className="rc-icon-button"
        type="button"
        onClick={() => onMove(index, index - 1)}
        disabled={index === 0}
        aria-label={`Move ${position} up`}
      >
        <span aria-hidden="true">↑</span>
      </button>
      <button
        className="rc-icon-button"
        type="button"
        onClick={() => onMove(index, index + 1)}
        disabled={index === total - 1}
        aria-label={`Move ${position} down`}
      >
        <span aria-hidden="true">↓</span>
      </button>
      <button
        className="rc-icon-button rc-icon-button--danger"
        type="button"
        onClick={() => onRemove(index)}
        disabled={!canRemove}
        aria-label={`Remove ${position}`}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

interface RowListProps {
  legend: string;
  hint?: string;
  error?: string | null;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}

export function RowList({ legend, hint, error, addLabel, onAdd, children }: RowListProps) {
  return (
    <fieldset className="rc-rows">
      <legend className="rc-rows__legend">{legend}</legend>
      {hint ? <p className="rc-field__hint">{hint}</p> : null}
      {error ? (
        <p className="rc-field__error" role="alert">
          {error}
        </p>
      ) : null}
      <ol className="rc-rows__list">{children}</ol>
      <button className="rc-button rc-button--ghost" type="button" onClick={onAdd}>
        {addLabel}
      </button>
    </fieldset>
  );
}
