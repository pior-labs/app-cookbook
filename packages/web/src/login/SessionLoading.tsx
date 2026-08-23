import { MeshBackdrop } from '../MeshBackdrop';

// Shown while the session is being restored, before the app knows whether it
// is heading for the login screen or the cookbook. It wears the same mesh and
// glass as the login screen, so that first moment never flashes a surface the
// rest of the pre-auth flow does not use.

export function SessionLoading() {
  return (
    <div className="login-screen login-loading" role="status" aria-live="polite">
      <MeshBackdrop />

      <div className="login-loading__mark">
        <span className="login-card__seal" aria-hidden="true">
          C
        </span>
        <p>Opening your cookbook…</p>
      </div>
    </div>
  );
}
