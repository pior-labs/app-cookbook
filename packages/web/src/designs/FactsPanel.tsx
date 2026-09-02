import { useId, type CSSProperties } from 'react';
import { AuthError, SignInButton } from '../login/parts';
import { useSignInFlow } from '../login/useSignInFlow';
import './facts-panel.css';

/*
 * Concept 5 - "The Panel".
 *
 * Borrowed wholesale from the one typographic system that belongs to food and
 * nothing else: the nutrition facts panel. Its whole hierarchy is rule weight -
 * a heavy bar, a mid bar, hairlines between rows - so the page needs no cards,
 * no shadows and no second colour to be organised.
 *
 * What it states is the household's book rather than a serving of it, and the
 * "% daily value" column becomes each section's share of the whole index, so
 * the borrowed structure is carrying real information instead of a costume.
 */

interface Row {
  label: string;
  value: string;
  /** Share of the whole index, where the row is a slice of it. */
  share?: number;
  /** Indented the way a nutrition panel indents a component of the row above. */
  nested?: boolean;
}

const COMPOSITION: Row[] = [
  { label: 'Dinners', value: '148', share: 69 },
  { label: 'Ready under 30 minutes', value: '61', share: 29, nested: true },
  { label: 'Baking', value: '31', share: 15 },
  { label: 'Sides and sauces', value: '34', share: 16 },
];

const HOUSEHOLD: Row[] = [
  { label: 'Cooks', value: '4' },
  { label: 'Notes and tweaks', value: '512' },
];

const HISTORY: Row[] = [
  { label: 'Oldest recipe', value: '2019' },
  { label: 'Last cooked', value: 'Sunday soup' },
];

function Rows({ rows }: { rows: Row[] }) {
  return (
    <div className="fp__rows">
      {rows.map((row) => (
        <div className="fp__row" key={row.label} data-nested={row.nested ? 'true' : undefined}>
          <span className="fp__row-label">{row.label}</span>
          <span className="fp__row-value">{row.value}</span>
          <span className="fp__row-share">
            {row.share === undefined ? (
              <span className="fp__row-dash" aria-hidden="true">
                &ndash;
              </span>
            ) : (
              <>
                <span className="fp__pct">{row.share}%</span>
                <span
                  className="fp__meter"
                  style={{ '--fp-fill': `${row.share}%` } as CSSProperties}
                  aria-hidden="true"
                />
              </>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export function FactsPanel() {
  const flow = useSignInFlow();
  const errorId = useId();

  return (
    <main className="fp">
      <article className="fp__panel" aria-labelledby="fp-heading">
        <p className="fp__kicker">Pior Labs</p>
        <h1 className="fp__title" id="fp-heading">
          Cookbook Facts
        </h1>

        <div className="fp__rule fp__rule--hair" aria-hidden="true" />
        <p className="fp__serving">
          1 household <i aria-hidden="true">/</i> 4 cooks <i aria-hidden="true">/</i> kept since 2019
        </p>

        <div className="fp__rule fp__rule--heavy" aria-hidden="true" />
        {/* the column heads and the one big number share the rows' grid, so
            every value in the panel right-aligns on the same edge */}
        <div className="fp__colhead">
          <span>In the book</span>
          <span />
          <span>Share</span>
        </div>

        <div className="fp__hero">
          <span className="fp__hero-label">Recipes</span>
          <span className="fp__hero-value">213</span>
          <span />
        </div>

        <div className="fp__rule fp__rule--mid" aria-hidden="true" />
        <Rows rows={COMPOSITION} />
        <div className="fp__rule fp__rule--mid" aria-hidden="true" />
        <Rows rows={HOUSEHOLD} />
        <div className="fp__rule fp__rule--mid" aria-hidden="true" />
        <Rows rows={HISTORY} />

        <div className="fp__rule fp__rule--heavy" aria-hidden="true" />
        <p className="fp__fine">
          Counts are the whole shared index, not one cook&rsquo;s. The book is private: only
          approved household accounts can open it.
        </p>

        <AuthError id={errorId} message={flow.error} className="fp__error" />
        <SignInButton flow={flow} className="fp__btn" errorId={errorId} />

        <p className="fp__margin" aria-hidden="true">
          add mum&rsquo;s paprika chicken
        </p>
      </article>
    </main>
  );
}
