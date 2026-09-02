import { MeshBackdrop } from '../MeshBackdrop';
import { IndexColumns } from './IndexColumns';

// Shown while the session is being restored, before the app knows whether it is
// heading for the login screen or the cookbook.
//
// It is the sign-in screen with the band still empty: the same mesh, the same
// drifting index, the same cut in the same place. Only the contents of the band
// change when the answer arrives, so that first moment never flashes a surface
// the rest of the pre-auth flow does not use.

export function SessionLoading() {
  return (
    <div className="login-screen" role="status" aria-live="polite">
      <MeshBackdrop />
      <div className="login-pool" aria-hidden="true" />

      <IndexColumns />

      <section className="login-band login-band--waiting">
        <div className="login-band__inner">
          <p className="login-eyebrow">Pior Labs Cookbook</p>
          <p className="login-waiting">
            <span className="login-waiting__dot" aria-hidden="true" />
            Opening your cookbook…
          </p>
        </div>
      </section>
    </div>
  );
}
