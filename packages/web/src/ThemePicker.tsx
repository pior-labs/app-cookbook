import type { CSSProperties } from 'react';
import { useTheme } from '@pior-labs/design-system';

// The theme is a household preference, not a page setting, so the same control
// appears on the sign-in screen and in the application topbar, and the design
// system persists the choice across both.
//
// It reads as one small pill of two half-lit dials rather than a labelled list:
// on the sign-in screen it sits next to the wordmark, where a second block of
// words would compete with the title.
export function ThemePicker({ className }: { className?: string }) {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className={className ? `theme-picker ${className}` : 'theme-picker'} role="group" aria-label="Theme">
      {themes.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`theme-picker__option${option.id === theme ? ' is-active' : ''}`}
          // The dial is tinted with the theme's own accent, which is the one
          // color here that cannot come from a token: it has to show the theme
          // that is not currently applied.
          style={{ '--theme-picker-tint': option.swatch[2] } as CSSProperties}
          aria-pressed={option.id === theme}
          title={option.hint}
          onClick={() => setTheme(option.id)}
        >
          <ThemeDial />
          <span className="theme-picker__name">{option.name}</span>
        </button>
      ))}
    </div>
  );
}

// A circle lit on one side - the same "light and dark" shorthand the rest of
// the product uses for a theme.
function ThemeDial() {
  return (
    <svg className="theme-picker__dial" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" />
    </svg>
  );
}
