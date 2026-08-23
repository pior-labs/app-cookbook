import { useId } from 'react';
import { MeshBackdrop } from '../MeshBackdrop';
import { ThemePicker } from '../ThemePicker';
import { ArrowIcon } from './parts';
import { useSignInFlow } from './useSignInFlow';

// The sign-in screen, built to concept 2 of the login design study,
// "Frosted Recipe Card" (docs/design/02-frosted-recipe-card.md): a ruled
// recipe card rendered in glass over the design system's drifting mesh.
//
// It is deliberately the same material language as the central service-auth
// sign-in page - the same mesh, glass, and Fraunces display - so leaving for
// SSO and coming back reads as one continuous product rather than two.

export function LoginScreen() {
  const flow = useSignInFlow();
  const errorId = useId();

  return (
    <main className="login-screen">
      <MeshBackdrop />

      <section className="login-card" aria-labelledby="login-heading">
        <span className="login-card__tab">Cookbook</span>

        <div className="login-card__inner">
          <header className="login-card__head">
            <span className="login-card__seal" aria-hidden="true">
              C
            </span>
            <span className="login-card__wordmark">Pior Labs</span>
            <ThemePicker className="login-card__theme" />
          </header>

          <p className="login-eyebrow">Household access</p>

          <h1 className="login-title" id="login-heading">
            Welcome back to
            <br />
            the <em>kitchen.</em>
          </h1>

          <p className="login-body">
            Your household cookbook - every recipe you&rsquo;ve saved, the notes that make them
            yours, and whatever you decide to make tonight.
          </p>

          {flow.error ? (
            <p className="login-error" id={errorId} role="alert">
              <span aria-hidden="true">!</span>
              {flow.error}
            </p>
          ) : null}

          <button
            className="login-button"
            type="button"
            onClick={flow.handleSignIn}
            disabled={flow.submitting}
            aria-describedby={flow.error ? errorId : undefined}
          >
            <span>{flow.submitting ? 'Opening Pior Labs…' : 'Continue with Pior Labs'}</span>
            {flow.submitting ? (
              <span className="login-button__spinner" aria-hidden="true" />
            ) : (
              <ArrowIcon />
            )}
          </button>

          <p className="login-note">
            Private by design. Only approved household accounts can enter.
          </p>
        </div>
      </section>
    </main>
  );
}
