import { scaleFactor, formatQuantity } from '@cookbook/domain';
import { useEffect, useState } from 'react';

// Serving adjustment is local view state only. The saved recipe is never
// mutated, the base count stays visible, and returning to it is one action
// (technical design section 11.2, PRD 6.3).

interface ServingControlProps {
  baseServings: number;
  servings: number;
  onChange: (servings: number) => void;
}

const MIN_SERVINGS = 1;
const MAX_SERVINGS = 100;

function clamp(value: number): number {
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, value));
}

export function ServingControl({ baseServings, servings, onChange }: ServingControlProps) {
  const scaled = servings !== baseServings;
  const factor = formatQuantity(scaleFactor(baseServings, servings));

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

  return (
    <div className="rc-servings">
      <div className="rc-servings__control">
        <button
          className="rc-servings__step"
          type="button"
          onClick={() => onChange(clamp(servings - 1))}
          disabled={servings <= MIN_SERVINGS}
          aria-label="One fewer serving"
        >
          <span aria-hidden="true">−</span>
        </button>

        <div className="rc-servings__value">
          <label className="rc-servings__label" htmlFor="recipe-servings-input">
            Servings
          </label>
          <input
            className="rc-servings__input"
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
          className="rc-servings__step"
          type="button"
          onClick={() => onChange(clamp(servings + 1))}
          disabled={servings >= MAX_SERVINGS}
          aria-label="One more serving"
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>

      {/* Announced politely so a screen reader hears the scaling change without
          the ingredient list stealing focus. */}
      <p className="rc-servings__state" aria-live="polite">
        {scaled ? (
          <>
            <span className="rc-servings__factor">×{factor}</span> from {baseServings} servings
          </>
        ) : (
          <>Recipe as written makes {baseServings}</>
        )}
      </p>

      {scaled ? (
        <button
          className="rc-button rc-button--ghost rc-button--small"
          type="button"
          onClick={() => onChange(baseServings)}
        >
          Reset to {baseServings}
        </button>
      ) : null}
    </div>
  );
}
