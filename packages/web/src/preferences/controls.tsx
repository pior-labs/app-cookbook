import { useRef } from 'react';

// Favorite and rating controls (technical design sections 11.2 and 11.3).
// Both are toggles a cook uses while cooking, so they carry a full touch
// target and say what they do rather than relying on the icon alone.

const STARS = [1, 2, 3, 4, 5] as const;

export function FavoriteButton({
  name,
  favorite,
  onToggle,
  size = 'default',
}: {
  name: string;
  favorite: boolean;
  onToggle: () => void;
  size?: 'default' | 'small';
}) {
  return (
    <button
      className={`rc-favorite${favorite ? ' rc-favorite--on' : ''}${
        size === 'small' ? ' rc-favorite--small' : ''
      }`}
      type="button"
      aria-pressed={favorite}
      aria-label={favorite ? `Remove ${name} from your favorites` : `Add ${name} to your favorites`}
      onClick={onToggle}
    >
      <span aria-hidden="true">{favorite ? '♥' : '♡'}</span>
      {size === 'default' ? <span>{favorite ? 'Favorited' : 'Favorite'}</span> : null}
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
    <div className="rc-rating">
      {/* A radio group, not five buttons: the stars are one choice, so arrow
          keys move between them and only the chosen one is a tab stop. */}
      <div
        className="rc-rating__stars"
        role="radiogroup"
        aria-label={`Your rating for ${name}`}
        onKeyDown={onKeyDown}
      >
        {STARS.map((value, index) => (
          <button
            className={`rc-rating__star${
              rating != null && value <= rating ? ' rc-rating__star--on' : ''
            }`}
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
            <span aria-hidden="true">{rating != null && value <= rating ? '★' : '☆'}</span>
          </button>
        ))}
      </div>

      {rating != null ? (
        <button className="rc-rating__clear" type="button" onClick={onClear}>
          Clear<span className="rc-visually-hidden"> your rating for {name}</span>
        </button>
      ) : null}

      <p className="rc-rating__household">
        {count === 0 || average == null
          ? 'Not rated in this house yet'
          : `${average.toFixed(1)} average from ${count === 1 ? '1 rating' : `${count} ratings`}`}
      </p>
    </div>
  );
}
