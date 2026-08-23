import type { ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from './auth';

// The topbar every discovery screen shares. Home, browse, and organize are one
// place a cook moves between, so the navigation stays put rather than each
// screen inventing its own way back (technical design section 11.1).

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/recipes', label: 'Browse', end: true },
  { to: '/favorites', label: 'Favorites', end: false },
  { to: '/recent', label: 'Recent', end: false },
  { to: '/organize', label: 'Organize', end: false },
  { to: '/trash', label: 'Trash', end: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();

  return (
    <div className="rc-shell">
      {/* Six section links and two actions sit ahead of the content on every
          screen, so a keyboard or screen-reader user gets one press past them
          (technical design section 11.2). */}
      <a className="rc-skip-link" href="#cookbook-main">
        Skip to content
      </a>

      <header className="rc-topbar">
        <Link className="rc-wordmark" to="/">
          <span className="rc-wordmark__seal" aria-hidden="true">
            C
          </span>
          <span>Cookbook</span>
        </Link>

        <nav className="rc-nav" aria-label="Cookbook sections">
          {NAV.map((item) => (
            <NavLink
              className={({ isActive }) => `rc-nav__link${isActive ? ' rc-nav__link--active' : ''}`}
              key={item.to}
              to={item.to}
              end={item.end}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="rc-topbar__actions">
          <Link className="rc-button rc-button--primary" to="/recipes/new">
            Add recipe
          </Link>
          <button
            className="rc-button rc-button--ghost"
            type="button"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </header>

      <div id="cookbook-main" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
