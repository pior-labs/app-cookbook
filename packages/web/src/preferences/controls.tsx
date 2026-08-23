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
  return (
    <div className="rc-rating">
      {/* A radio group, not five buttons: the stars are one choice, so arrow
          keys move between them and only the chosen one is a tab stop. */}
      <div className="rc-rating__stars" role="radiogroup" aria-label={`Your rating for ${name}`}>
        {STARS.map((value) => (
          <button
            className={`rc-rating__star${
              rating != null && value <= rating ? ' rc-rating__star--on' : ''
            }`}
            key={value}
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
