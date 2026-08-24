import { Heart, Star } from 'lucide-react';
import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { focusRing } from '@/components/ui';

// Favorite and rating controls (technical design sections 11.2 and 11.3).
// Both are toggles a cook uses while cooking, so they carry a full touch
// target and say what they do rather than relying on the icon alone.

const STARS = [1, 2, 3, 4, 5] as const;

export function FavoriteButton({
  name,
  favorite,
  onToggle,
  size = 'default',
  className,
}: {
  name: string;
  favorite: boolean;
  onToggle: () => void;
  size?: 'default' | 'small';
  className?: string;
}) {
  const compact = size === 'small';

  return (
    <button
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border font-medium',
        'backdrop-blur-md transition-[background-color,color,transform] duration-200 ease-out',
        'hover:-translate-y-px motion-reduce:hover:translate-y-0',
        focusRing,
        // Small sits on top of a photograph, so it keeps its own frosted disc
        // rather than trusting whatever was photographed underneath it.
        compact
          ? 'h-9 w-9 border-frost/70 bg-[rgba(var(--surface-rgb),0.86)] shadow-[0_6px_16px_-8px_color-mix(in_srgb,var(--ink)_50%,transparent)]'
          : 'min-h-11 border-ink/12 bg-frost/55 px-5 py-2 text-[15px]',
        favorite ? 'text-accent' : 'text-ink-2 hover:text-ink',
        className,
      )}
      type="button"
      aria-pressed={favorite}
      aria-label={favorite ? `Remove ${name} from your favorites` : `Add ${name} to your favorites`}
      onClick={onToggle}
    >
      <Heart
        aria-hidden="true"
        className={cn(compact ? 'h-[18px] w-[18px]' : 'h-[18px] w-[18px]', favorite && 'fill-current')}
        strokeWidth={2}
      />
      {compact ? null : <span>{favorite ? 'Favorited' : 'Favorite'}</span>}
    </button>
  );
}

export function RatingControl({
  name,
  rating,
  average,
  count,
  onRate,
  onClear,
}: {
  name: string;
  rating: number | null;
  average: number | null;
  count: number;
  onRate: (value: number) => void;
  onClear: () => void;
}) {
  const stars = useRef<(HTMLButtonElement | null)[]>([]);

  // Choosing with the keyboard moves and selects in one press, the way a radio
  // group does. Focus follows the choice, or the arrow key would move the
  // selection out from under the cook.
  const choose = (value: number) => {
    onRate(value);
    stars.current[value - 1]?.focus();
  };

  const step = (delta: number) => {
    if (rating == null) {
      choose(delta > 0 ? STARS[0] : STARS[STARS.length - 1]);
      return;
    }

    choose(STARS[(rating - 1 + delta + STARS.length) % STARS.length]);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, () => void> = {
      ArrowRight: () => step(1),
      ArrowDown: () => step(1),
      ArrowLeft: () => step(-1),
      ArrowUp: () => step(-1),
      Home: () => choose(STARS[0]),
      End: () => choose(STARS[STARS.length - 1]),
    };

    const move = moves[event.key];
    if (!move) return;

    event.preventDefault();
    move();
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {/* A radio group, not five buttons: the stars are one choice, so arrow
          keys move between them and only the chosen one is a tab stop. */}
      <div
        className="flex items-center"
        role="radiogroup"
        aria-label={`Your rating for ${name}`}
        onKeyDown={onKeyDown}
      >
        {STARS.map((value, index) => {
          const on = rating != null && value <= rating;

          return (
            <button
              className={cn(
                'inline-grid h-11 w-9 cursor-pointer place-items-center rounded-xl border-0 bg-transparent transition-colors',
                focusRing,
                on ? 'text-accent' : 'text-ink-3 hover:text-ink-2',
              )}
              key={value}
              ref={(element) => {
                stars.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={value === 1 ? '1 star' : `${value} stars`}
              tabIndex={rating === value || (rating == null && value === 1) ? 0 : -1}
              onClick={() => onRate(value)}
            >
              <Star
                aria-hidden="true"
                className={cn('h-[21px] w-[21px]', on && 'fill-current')}
                strokeWidth={1.9}
              />
            </button>
          );
        })}
      </div>

      {rating != null ? (
        <button
          className={cn(
            'cursor-pointer rounded-full border-0 bg-transparent px-2 py-1 font-serif text-[13px] italic text-ink-2 underline decoration-dotted underline-offset-4 transition-colors hover:text-ink',
            focusRing,
          )}
          type="button"
          onClick={onClear}
        >
          Clear<span className="sr-only"> your rating for {name}</span>
        </button>
      ) : null}

      <p className="m-0 font-serif text-[13px] italic text-ink-3">
        {count === 0 || average == null
          ? 'Not rated in this house yet'
          : `${average.toFixed(1)} average from ${count === 1 ? '1 rating' : `${count} ratings`}`}
      </p>
    </div>
  );
}
