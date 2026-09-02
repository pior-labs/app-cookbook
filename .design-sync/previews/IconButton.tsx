import { IconButton } from '@cookbook/web';

function Grip() {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="18">
      <circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" />
    </svg>
  );
}

function Trash() {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  );
}

export function Tones() {
  return (
    <div className="flex items-center gap-3">
      <IconButton aria-label="Reorder step"><Grip /></IconButton>
      <IconButton aria-label="Remove step" tone="danger"><Trash /></IconButton>
    </div>
  );
}

export function InAnIngredientRow() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-frost/80 bg-[rgba(var(--surface-rgb),0.92)] px-4 py-3">
      <IconButton aria-label="Reorder ingredient"><Grip /></IconButton>
      <span className="flex-1 text-[15px] text-ink">200g orzo</span>
      <IconButton aria-label="Remove ingredient" tone="danger"><Trash /></IconButton>
    </div>
  );
}

export function Disabled() {
  return (
    <div className="flex items-center gap-3">
      <IconButton aria-label="Reorder step" disabled><Grip /></IconButton>
      <IconButton aria-label="Remove step" disabled tone="danger"><Trash /></IconButton>
    </div>
  );
}
