import { useId } from 'react';
import { AuthError, SignInButton } from '../login/parts';
import { useSignInFlow } from '../login/useSignInFlow';
import './low-flame.css';

/*
 * Concept 6 - "Low Flame".
 *
 * The kitchen at night, before anyone turns the light on. The only object is a
 * gas ring, drawn in CSS - a crown of flame ports, the burner cap, the pan
 * supports - burning low in the dark, and the light it throws is what lights
 * the page.
 *
 * The sign-in is the ignition: hovering or focusing the button raises the
 * flame, and starting the hand-off to Pior Labs Auth brings it up full. The
 * status line under the button reports real flow state and nothing else, so
 * the atmosphere never pretends to be a control.
 */
export function LowFlame() {
  const flow = useSignInFlow();
  const errorId = useId();

  return (
    <main className="lf" data-igniting={flow.submitting ? 'true' : 'false'}>
      <div className="lf__burner" aria-hidden="true">
        <span className="lf__halo" />
        <span className="lf__grate" />
        <span className="lf__crown" />
        <span className="lf__cap" />
      </div>

      <section className="lf__copy" aria-labelledby="lf-heading">
        <p className="lf__eyebrow">Pior Labs Cookbook</p>

        <h1 className="lf__title" id="lf-heading">
          The pilot light
          <br />
          is always on.
        </h1>

        <p className="lf__lede">
          The household book never closes. Sign in and pick up wherever the last cook left off.
        </p>

        <AuthError id={errorId} message={flow.error} className="lf__error" />
        <SignInButton flow={flow} className="lf__btn" errorId={errorId} />

        <p className="lf__status">
          <span className="lf__dot" aria-hidden="true" />
          {flow.submitting ? 'igniting' : 'standby'} &middot; pior labs auth
        </p>
      </section>
    </main>
  );
}
