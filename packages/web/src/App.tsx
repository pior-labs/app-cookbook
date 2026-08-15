import { useEffect, useState } from 'react';

type ApiStatus = 'checking' | 'healthy' | 'unavailable';

const statusCopy: Record<ApiStatus, string> = {
  checking: 'Connecting',
  healthy: 'Kitchen online',
  unavailable: 'API unavailable',
};

function CookbookMark() {
  return (
    <svg aria-hidden="true" className="brand-mark" viewBox="0 0 40 40">
      <path d="M10 7.5h15.5a4.5 4.5 0 0 1 4.5 4.5v20.5H14.5A4.5 4.5 0 0 1 10 28V7.5Z" />
      <path d="M14.5 32.5A4.5 4.5 0 0 1 10 28c0-2.5 2-4.5 4.5-4.5H30M15 12h10M15 16.5h7" />
    </svg>
  );
}

function RecipeCardStack() {
  return (
    <div className="card-stack" aria-hidden="true">
      <div className="recipe-card recipe-card-back" />
      <div className="recipe-card recipe-card-middle" />
      <div className="recipe-card recipe-card-front">
        <div className="card-photo">
          <svg viewBox="0 0 180 120">
            <path className="bowl" d="M36 64h108c-4 27-23 41-54 41S40 91 36 64Z" />
            <path className="steam" d="M67 51c-8-8 8-13 0-22M91 51c-8-8 8-13 0-22M115 51c-8-8 8-13 0-22" />
          </svg>
        </div>
        <span className="card-kicker">House recipe</span>
        <span className="card-line card-line-long" />
        <span className="card-line" />
        <div className="card-meta">
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/health', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('API health check failed');
        return response.json();
      })
      .then(() => setApiStatus('healthy'))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setApiStatus('unavailable');
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <div className="cookbook-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Pior Labs Cookbook home">
          <CookbookMark />
          <span>
            <strong>Cookbook</strong>
            <small>Pior Labs</small>
          </span>
        </a>
        <div className="header-meta">
          <span className="private-label">Private household cookbook</span>
          <span className={`api-status api-status-${apiStatus}`} aria-live="polite">
            <i />
            {statusCopy[apiStatus]}
          </span>
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">The kitchen shelf is ready</p>
            <h1 id="hero-title">Every recipe worth keeping, in one place.</h1>
            <p className="hero-description">
              Cookbook is becoming the household home for recipes we cook, change, and come
              back to. The foundation is in place; the Phase 1 recipe experience comes next.
            </p>
            <div className="foundation-note">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="m7 12 3 3 7-7" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              <span>
                <strong>Scaffold established</strong>
                Responsive shell, API health, database tooling, and central auth configuration
              </span>
            </div>
          </div>
          <RecipeCardStack />
        </section>

        <section className="up-next" aria-labelledby="up-next-title">
          <div className="section-heading">
            <p className="eyebrow">Phase 1 · Core Cookbook</p>
            <h2 id="up-next-title">What this foundation is made for</h2>
          </div>
          <div className="capability-grid">
            <article>
              <span className="capability-icon" aria-hidden="true">⌕</span>
              <h3>Find the right recipe</h3>
              <p>Visual browsing and useful search across the household collection.</p>
            </article>
            <article>
              <span className="capability-icon fraction" aria-hidden="true">½</span>
              <h3>Cook for any table</h3>
              <p>Structured ingredients that scale cleanly without changing the original.</p>
            </article>
            <article>
              <span className="capability-icon" aria-hidden="true">♡</span>
              <h3>Make it personal</h3>
              <p>Shared recipes with individual favorites, ratings, and recent history.</p>
            </article>
          </div>
        </section>
      </main>

      <footer>
        <p>Pior Labs Cookbook</p>
        <p>Built for the recipes that stay in the family.</p>
      </footer>
    </div>
  );
}
