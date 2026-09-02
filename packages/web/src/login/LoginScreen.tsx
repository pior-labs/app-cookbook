import { useId } from 'react';
import { MeshBackdrop } from '../MeshBackdrop';
import { ThemePicker } from '../ThemePicker';
import { IndexColumns } from './IndexColumns';
import { AuthError, SignInButton } from './parts';
import { useSignInFlow } from './useSignInFlow';

// The sign-in screen, built to concept 7 of the login design study, "The Index,
// Lit" (docs/design/README.md): a printed index drifting floor to ceiling, and
// one band cut edge to edge through it.
//
// The materials are the design system's own - the drifting mesh, glass, and the
// Fraunces display the central service-auth sign-in page uses - so leaving for
// SSO and coming back reads as one continuous product rather than two. The mesh
// runs at a fraction of its default strength here: it is the light in the room,
// not colour under the words.
//
// The listing behind the band is decoration, not the household's book. See
// `index-content.ts` for why it cannot be.

export function LoginScreen() {
  const flow = useSignInFlow();
  const errorId = useId();

  return (
    <main className="login-screen">
      <MeshBackdrop />
      <div className="login-pool" aria-hidden="true" />

      <IndexColumns />

      <section className="login-band" aria-labelledby="login-heading">
        <div className="login-band__inner">
          {/* The theme is a household preference, not a page setting, so it is
              offered before signing in the way the central sign-in page offers
              it. It sits at the far edge of the band, level with the eyebrow,
              where it stays a quiet utility rather than a second object next to
              the title. */}
          <ThemePicker className="login-theme" />

          <div className="login-lede">
            <p className="login-eyebrow">
              Pior Labs Cookbook <span aria-hidden="true">/</span> Household access
            </p>

            <h1 className="login-title" id="login-heading">
              Everything the house
              <br />
              knows how to <em>cook.</em>
            </h1>
          </div>

          <div className="login-act">
            <AuthError id={errorId} message={flow.error} className="login-error" />
            <SignInButton flow={flow} className="login-button" errorId={errorId} />
            <p className="login-note">
              Private by design. Only approved household accounts can enter.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
