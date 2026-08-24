import { scaleFactor, formatQuantity } from '@cookbook/domain';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { focusRing } from '@/components/ui';

// Serving adjustment is local view state only. The saved recipe is never
// mutated, the base count stays visible, and returning to it is one action
// (technical design section 11.2, PRD 6.3).

interface ServingControlProps {
  baseServings: number;
  servings: number;
  onChange: (servings: number) => void;
  size?: 'default' | 'large';
}

const MIN_SERVINGS = 1;
const MAX_SERVINGS = 100;

function clamp(value: number): number {
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, value));
}

export function ServingControl({ baseServings, servings, onChange, size = 'default' }: ServingControlProps) {
  const scaled = servings !== baseServings;
  const factor = formatQuantity(scaleFactor(baseServings, servings));
  const large = size === 'large';

  // The field holds its own text so it can be momentarily empty while the cook
  // selects all and types a new number. Clamping an empty field straight to 1
  // would turn "select all, type 8" into 18.
  const [text, setText] = useState(String(servings));

  useEffect(() => {
    setText(String(servings));
  }, [servings]);

  function commit(raw: string) {
    setText(raw);

    if (raw.trim() === '') return;

    const next = Number(raw);
    if (Number.isInteger(next) && next >= MIN_SERVINGS) onChange(clamp(next));
  }

  // Leaving the field empty or invalid restores the last good value rather
  // than leaving the recipe in an unscalable state.
  function handleBlur() {
    setText(String(servings));
  }

  const stepClass = cn(
    'inline-grid shrink-0 cursor-pointer place-items-center rounded-full border border-ink/12 bg-frost/70 text-ink-2',
    'transition-colors duration-200 hover:bg-frost hover:text-ink disabled:pointer-events-none disabled:opacity-40',
    focusRing,
    large ? 'h-12 w-12' : 'h-10 w-10',
  );

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-frost/80 bg-[rgba(var(--surface-rgb),0.7)] shadow-[inset_0_0_0_1px_rgba(var(--frost-rgb),0.5)]',
          large ? 'gap-3 p-1.5' : 'p-1',
        )}
      >
        <button
          className={stepClass}
          type="button"
          onClick={() => onChange(clamp(servings - 1))}
          disabled={servings <= MIN_SERVINGS}
          aria-label="One fewer serving"
        >
          <Minus aria-hidden="true" className={large ? 'h-5 w-5' : 'h-4 w-4'} strokeWidth={2.4} />
        </button>

        <div className="flex min-w-14 flex-col items-center">
          <label
            className="font-mono text-[10px] font-semibold tracking-[0.16em] text-ink-3 uppercase"
            htmlFor="recipe-servings-input"
          >
            Servings
          </label>
          <input
            className={cn(
              'w-14 border-0 bg-transparent p-0 text-center font-serif tracking-[-0.02em] text-ink tabular-nums focus:outline-none',
              focusRing,
              large ? 'text-[30px]' : 'text-[24px]',
            )}
            id="recipe-servings-input"
            type="number"
            inputMode="numeric"
            min={MIN_SERVINGS}
            max={MAX_SERVINGS}
            value={text}
            onChange={(event) => commit(event.target.value)}
            onBlur={handleBlur}
          />
        </div>

        <button
          className={stepClass}
          type="button"
          onClick={() => onChange(clamp(servings + 1))}
          disabled={servings >= MAX_SERVINGS}
          aria-label="One more serving"
        >
          <Plus aria-hidden="true" className={large ? 'h-5 w-5' : 'h-4 w-4'} strokeWidth={2.4} />
        </button>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        {/* Announced politely so a screen reader hears the scaling change without
            the ingredient list stealing focus. */}
        <p className="m-0 font-serif text-[14px] italic text-ink-2" aria-live="polite">
          {scaled ? (
            <>
              <span className="font-medium text-accent not-italic">×{factor}</span> from{' '}
              {baseServings} servings
            </>
          ) : (
            <>Recipe as written makes {baseServings}</>
          )}
        </p>

        {scaled ? (
          <button
            className={cn(
              'inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent px-2 py-1 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink',
              focusRing,
            )}
            type="button"
            onClick={() => onChange(baseServings)}
          >
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.1} />
            Reset to {baseServings}
          </button>
        ) : null}
      </div>
    </div>
  );
}
