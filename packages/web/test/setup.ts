import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// React Testing Library does not auto-clean when `globals` are enabled through
// a config rather than an import, so unmount between tests explicitly.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
