import { render as rtlRender, type RenderOptions, type RenderResult } from '@testing-library/react';
import { ThemeProvider } from '@pior-labs/design-system';
import type { ReactElement, ReactNode } from 'react';

// Screens render under the theme provider in `main.tsx`, and anything reading
// the active theme - the topbar's theme picker, for one - needs it in a test
// too. Tests use this in place of Testing Library's own `render` so a screen is
// mounted the way the application mounts it.
export function render(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>): RenderResult {
  return rtlRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => <ThemeProvider>{children}</ThemeProvider>,
    ...options,
  });
}
