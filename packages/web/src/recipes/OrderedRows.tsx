import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { Button, FieldError, IconButton, SectionHeading } from '@/components/ui';

// Ordered ingredient and instruction rows. Position comes from array order and
// is derived server-side, so reordering here only moves array entries.
//
// Every reorder control is a real button: pointer, touch, and keyboard users
// all get the same affordance rather than a drag-only interaction.

interface RowControlsProps {
  index: number;
  total: number;
  label: string;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  position?: number;
}

export function RowControls({
  index,
  total,
  label,
  onMove,
  onRemove,
  canRemove,
  position: displayPosition,
}: RowControlsProps) {
  const position = `${label} ${displayPosition ?? index + 1}`;

  return (
    // Always a horizontal cluster. Stacked, three 44px buttons stand taller
    // than the fields they belong to and leave the row mostly dead space. On a
    // phone the row turns into a column and this sits under the fields; from
    // `sm` up it sits beside them, pushed down past the field label so it
    // lines up with the inputs rather than with their captions.
    <div className="flex shrink-0 justify-end gap-1.5 sm:self-start sm:pt-[26px]">
      <IconButton
        onClick={() => onMove(index, index - 1)}
        disabled={index === 0}
        aria-label={`Move ${position} up`}
      >
        <ArrowUp aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
      </IconButton>
      <IconButton
        onClick={() => onMove(index, index + 1)}
        disabled={index === total - 1}
        aria-label={`Move ${position} down`}
      >
        <ArrowDown aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
      </IconButton>
      <IconButton
        tone="danger"
        onClick={() => onRemove(index)}
        disabled={!canRemove}
        aria-label={`Remove ${position}`}
      >
        <X aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
      </IconButton>
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
  onAddSection?: () => void;
}

export function RowList({ legend, hint, error, addLabel, onAdd, children, onAddSection }: RowListProps) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-3 p-0">
        <SectionHeading sub={hint}>{legend}</SectionHeading>
      </legend>
      {/* The hint is rendered inside the legend above for sighted readers; an
          error is separate so it can carry its own alert role. */}
      {error ? <FieldError>{error}</FieldError> : null}
      <ol className="m-0 flex list-none flex-col gap-3 p-0">{children}</ol>
      <Button className="mt-3.5" onClick={onAdd}>
        <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.3} />
        {addLabel}
      </Button>
      {onAddSection ? <Button className="mt-3.5 ml-2" onClick={onAddSection}>Add section</Button> : null}
    </fieldset>
  );
}
