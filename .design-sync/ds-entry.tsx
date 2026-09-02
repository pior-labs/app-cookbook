/*
 * Entry barrel for the claude.ai/design sync.
 *
 * The Cookbook design system is split across two homes: the published
 * @pior-labs/design-system package owns the themes and semantic tokens, and
 * packages/web/src owns the control vocabulary the screens are actually built
 * from. This file is the single module that states that combined surface, so
 * the converter bundles exactly it - no app routes, no API clients.
 *
 * Nothing here reimplements a component; it only re-exports the real ones.
 */
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@pior-labs/design-system';

import { AuthProvider } from '../packages/web/src/auth';
import { CookModeProvider } from '../packages/web/src/components/CookMode';

// -- the control vocabulary ------------------------------------------------
export * from '../packages/web/src/components/ui';
export * from '../packages/web/src/components/BrandMark';
export { CookModeProvider, useCookMode } from '../packages/web/src/components/CookMode';
export { ThemeSwitcher } from '../packages/web/src/components/ThemeSwitcher';
export { ThemePicker } from '../packages/web/src/ThemePicker';
export { AppShell } from '../packages/web/src/components/AppShell';

/*
 * Routing primitives, re-exported from the DS's own react-router instance.
 * AppShell renders an <Outlet />, so anything composing it needs Route/Routes
 * from the SAME react-router copy - a preview importing react-router-dom
 * directly would get a second instance with its own, empty context.
 */
export { Routes, Route, Link, NavLink, Outlet } from 'react-router-dom';

// -- themes and tokens -----------------------------------------------------
export {
  ThemeProvider,
  useTheme,
  THEMES,
  DEFAULT_THEME,
  DEFAULT_STORAGE_KEY,
  readStoredTheme,
} from '@pior-labs/design-system';
export type { ThemeId, ThemeOption } from '@pior-labs/design-system';

/*
 * Preview scaffolding. Every card renders inside this: the real ThemeProvider
 * (which is what puts the token values on the document), a MemoryRouter
 * because the control vocabulary links with react-router's <Link>, and the
 * real CookModeProvider.
 *
 * AuthProvider reads its session over the network, which no preview card has.
 * Rather than fake the provider - which would stop exercising the real one -
 * the one request it makes is answered locally, so AppShell previews show a
 * realistic account rather than an empty one. Preview-only, and scoped to
 * that single path.
 */
const SESSION_PATH = '/api/auth/get-session';

if (typeof window !== 'undefined' && !(window as unknown as Record<string, unknown>).__dsFetchPatched) {
  (window as unknown as Record<string, unknown>).__dsFetchPatched = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes(SESSION_PATH)) {
      return Promise.resolve(
        new Response(JSON.stringify({ user: { id: 1, name: 'Ana Bergeron', email: 'ana@example.com' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    return realFetch(input as RequestInfo, init);
  }) as typeof window.fetch;
}

export function PreviewProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <MemoryRouter>
        <AuthProvider>
          <CookModeProvider>{children}</CookModeProvider>
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>
  );
}
