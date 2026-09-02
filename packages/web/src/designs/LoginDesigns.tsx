import { useEffect, type ReactElement } from 'react';
import { useTheme } from '@pior-labs/design-system';
import { LoginScreen } from '../login/LoginScreen';
import { FactsPanel } from './FactsPanel';
import { IndexWall } from './IndexWall';
import { LowFlame } from './LowFlame';
import './designs.css';

/*
 * Three further login concepts, parked at /designs/login/1..3.
 *
 * They are a design study, not part of the sign-in gate: the App resolves the
 * path before the auth branches, so a concept can be opened signed in or out
 * without changing what an unauthenticated visitor to any other URL gets. The
 * sign-in button on each one is the real `useSignInFlow`, because a login
 * concept that cannot be pressed cannot be judged.
 *
 * Concepts 1-3 (Ticket Stub, Frosted Recipe Card, Pinned Recipe Card) live in
 * `login/variants.tsx` and are all paper artefacts. These three deliberately
 * leave that family: one is typographic, one is structural, one is atmospheric.
 */

interface Design {
  slug: string;
  name: string;
  blurb: string;
  /** The switcher has to sit legibly on both a cream page and a dark one. */
  tone: 'light' | 'dark';
  Component: () => ReactElement;
}

export const LOGIN_DESIGNS: Design[] = [
  {
    slug: '1',
    name: 'The Index',
    blurb: "The household's whole index drifting behind one band cut through it.",
    tone: 'light',
    Component: IndexWall,
  },
  {
    slug: '2',
    name: 'Cookbook Facts',
    blurb: 'The nutrition panel, stating the book instead of a serving.',
    tone: 'light',
    Component: FactsPanel,
  },
  {
    slug: '3',
    name: 'Low Flame',
    blurb: 'A gas ring burning low in the dark. The button is the ignition.',
    tone: 'dark',
    Component: LowFlame,
  },
  {
    slug: '4',
    name: 'The Index, Lit (live)',
    // The chosen concept, so the study shows the real sign-in screen rather
    // than a copy of it that could drift away from what people actually see.
    blurb: "Concept 1's cut, lit by the design system's mesh. Shipped as the login screen.",
    tone: 'light',
    Component: LoginScreen,
  },
];

const DESIGN_PATH = /^\/designs\/login\/([^/]+)\/?$/;

/** The requested concept, or null when the path is not a design route. */
export function matchDesign(pathname: string): Design | null {
  const match = DESIGN_PATH.exec(pathname);
  if (!match) return null;
  return LOGIN_DESIGNS.find((design) => design.slug === match[1]) ?? null;
}

export function isDesignRoute(pathname: string): boolean {
  return DESIGN_PATH.test(pathname);
}

/*
 * The one family the shipped app does not use: Archivo Narrow, for the panel's
 * condensed rules. It is requested from here rather than from index.html so the
 * app itself keeps loading only the faces it actually sets. (IBM Plex Mono was
 * study-only too until concept 7 shipped; it now lives in index.html.)
 */
const STUDY_FONTS =
  'https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@400;600;700&display=swap';

function useStudyFonts() {
  useEffect(() => {
    if (document.querySelector(`link[href="${STUDY_FONTS}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = STUDY_FONTS;
    document.head.appendChild(link);
  }, []);
}

export default function LoginDesigns() {
  const design = matchDesign(window.location.pathname);
  useStudyFonts();

  useEffect(() => {
    if (design) document.title = `${design.name} - login concept`;
  }, [design]);

  if (!design) return <NotFound />;

  const { Component } = design;

  return (
    <>
      <Component />
      <Switcher design={design} />
    </>
  );
}

/* ---- study chrome ---------------------------------------------------- */

/*
 * Review furniture, not part of any concept: it stays at a low opacity until
 * it is hovered or focused so it never reads as page content, and it moves
 * between concepts with real navigations because these routes are resolved
 * from the path rather than mounted in a router.
 */
function Switcher({ design }: { design: Design }) {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="dx" data-tone={design.tone}>
      <div className="dx__bar">
        <span className="dx__label">
          <b>{design.name}</b>
          <span>{design.blurb}</span>
        </span>

        <span className="dx__sep" aria-hidden="true" />

        <nav className="dx__group" aria-label="Login concept">
          {LOGIN_DESIGNS.map((option) => (
            <a
              key={option.slug}
              className={`dx__pip${option.slug === design.slug ? ' is-active' : ''}`}
              href={`/designs/login/${option.slug}`}
              aria-current={option.slug === design.slug ? 'page' : undefined}
              title={option.name}
            >
              {option.slug}
            </a>
          ))}
        </nav>

        <span className="dx__sep" aria-hidden="true" />

        <div className="dx__group" role="group" aria-label="Theme">
          {themes.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`dx__pip${option.id === theme ? ' is-active' : ''}`}
              aria-pressed={option.id === theme}
              onClick={() => setTheme(option.id)}
              title={option.hint}
            >
              {option.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <main className="dx-missing">
      <p>No login concept at this address.</p>
      <nav>
        {LOGIN_DESIGNS.map((design) => (
          <a key={design.slug} href={`/designs/login/${design.slug}`}>
            {design.slug}. {design.name}
          </a>
        ))}
      </nav>
    </main>
  );
}
