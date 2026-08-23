import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '../test/render';
import { ThemePicker } from './ThemePicker';

// The theme is a household preference the design system persists, so the
// control has to report which theme is on and actually flip the document.

describe('theme picker', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('marks the active theme and offers the other one', () => {
    render(<ThemePicker />);

    expect(screen.getByRole('button', { name: /Bloom/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Slate/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches the document theme when another is chosen', async () => {
    const user = userEvent.setup();
    render(<ThemePicker />);

    await user.click(screen.getByRole('button', { name: /Slate/ }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('slate');
    expect(screen.getByRole('button', { name: /Slate/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
