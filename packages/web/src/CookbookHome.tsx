import { useEffect, useState } from 'react';
import { useAuth } from './auth';

type ApiState = 'checking' | 'connected' | 'unavailable';

export function CookbookHome() {
  const { user, signOut } = useAuth();
  const [apiState, setApiState] = useState<ApiState>('checking');
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/hello', { credentials: 'include', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Protected API check failed');
        setApiState('connected');
      })
      .catch((apiError: unknown) => {
        if (apiError instanceof DOMException && apiError.name === 'AbortError') return;
        setApiState('unavailable');
      });

    return () => controller.abort();
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);

    try {
      await signOut();
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Could not sign out.');
      setSigningOut(false);
    }
  }

  return (
    <div className="cookbook-shell home-screen">
      <header className="home-header">
        <div className="wordmark wordmark--dark">
          <span className="wordmark__seal">C</span>
          <span>Cookbook</span>
        </div>
        <button className="text-button" type="button" onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </header>

      <main className="home-main">
        <section className="welcome-panel">
          <p className="utility-label">The kitchen is open</p>
          <h1>
            Welcome, <em>{user?.name.split(' ')[0] ?? 'cook'}.</em>
          </h1>
          <p>
            Your account is connected. Recipe shelves, favorites, and cooking notes will grow from
            here as Phase 1 comes together.
          </p>

          <div className="session-card">
            <div>
              <span className={`connection-dot connection-dot--${apiState}`} aria-hidden="true" />
              <strong>
                {apiState === 'checking'
                  ? 'Checking kitchen access…'
                  : apiState === 'connected'
                    ? 'Cookbook session connected'
                    : 'Cookbook API unavailable'}
              </strong>
            </div>
            <span>{user?.email}</span>
          </div>

          {error ? <p className="auth-error" role="alert"><span aria-hidden="true">!</span>{error}</p> : null}
        </section>

        <aside className="coming-soon" aria-label="Upcoming Cookbook features">
          <div className="coming-soon__plate"><span>Next</span></div>
          <p className="utility-label">On the prep list</p>
          <ul>
            <li><span>01</span> Your recipe shelf</li>
            <li><span>02</span> Serving-size controls</li>
            <li><span>03</span> Favorites and recent dishes</li>
          </ul>
        </aside>
      </main>
    </div>
  );
}
