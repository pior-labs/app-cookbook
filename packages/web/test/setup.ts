import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom implements no layout, so it ships no `ResizeObserver`. Components that
// measure themselves - the discovery rails, which fade whichever end still has
// cards behind it - would otherwise throw on mount. Nothing here ever reports a
// size, which is the honest answer in a document that has no layout: the
// observed callback simply never fires.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// React Testing Library does not auto-clean when `globals` are enabled through
// a config rather than an import, so unmount between tests explicitly.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
