import { useId, useState } from 'react';
import { useAuth } from './auth';

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="M4 10h11M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TableSetting() {
  return (
    <div className="table-setting" aria-hidden="true">
      <div className="recipe-tab recipe-tab--one">lemon pasta</div>
      <div className="recipe-tab recipe-tab--two">sunday soup</div>
      <div className="napkin" />
      <div className="plate plate--shadow" />
      <div className="plate">
        <div className="plate__rim" />
        <div className="plate__message">
          <span>Tonight</span>
          <strong>something good</strong>
        </div>
      </div>
      <div className="ingredient-bowl ingredient-bowl--herbs"><span /></div>
      <div className="ingredient-bowl ingredient-bowl--lemon"><span /></div>
      <div className="fork"><i /><i /><i /><b /></div>
    </div>
  );
}

export function LoginScreen() {
  const { startSignIn } = useAuth();
  const errorId = useId();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setError(null);
    setSubmitting(true);

    try {
      await startSignIn();
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : 'Could not start sign-in. Check your connection to Pior Labs Auth.',
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="cookbook-shell login-screen">
      <main className="login-layout">
        <section className="login-story" aria-labelledby="cookbook-heading">
          <header className="wordmark">
            <span className="wordmark__seal">C</span>
            <span>Cookbook</span>
          </header>

          <div className="story-copy">
            <p className="utility-label">The household recipe book</p>
            <h1 id="cookbook-heading">
              Your best recipes,
              <em>kept close.</em>
            </h1>
            <p className="story-copy__body">
              One shared place for the meals you return to, the notes that make them yours, and
              whatever you decide to cook tonight.
            </p>
          </div>

          <TableSetting />

          <p className="story-footnote"><span /> Shared with your household</p>
        </section>

        <section className="login-action" aria-labelledby="sign-in-heading">
          <div className="sign-in-card">
            <p className="utility-label">Household access</p>
            <h2 id="sign-in-heading">Come cook with us.</h2>
            <p className="sign-in-card__body">
              Continue to Pior Labs to sign in. You’ll come straight back to your cookbook.
            </p>

            {error ? (
              <p className="auth-error" id={errorId} role="alert">
                <span aria-hidden="true">!</span>
                {error}
              </p>
            ) : null}

            <button
              className="sign-in-button"
              type="button"
              onClick={handleSignIn}
              disabled={submitting}
              aria-describedby={error ? errorId : undefined}
            >
              <span>{submitting ? 'Opening Pior Labs…' : 'Continue with Pior Labs'}</span>
              {submitting ? <span className="button-spinner" aria-hidden="true" /> : <ArrowIcon />}
            </button>

            <p className="sign-in-note">
              Private by design. Only approved household accounts can enter.
            </p>
          </div>

          <p className="login-action__footer">Pior Labs · Home tools, thoughtfully made</p>
        </section>
      </main>
    </div>
  );
}
