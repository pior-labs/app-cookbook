import { useTheme } from '@pior-labs/design-system';

// The theme is a household preference, not a page setting, so the same control
// appears on the sign-in screen and in the application topbar, and the design
// system persists the choice across both.
export function ThemePicker({ className }: { className?: string }) {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className={className ? `theme-picker ${className}` : 'theme-picker'} role="group" aria-label="Theme">
      {themes.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`theme-picker__option${option.id === theme ? ' is-active' : ''}`}
          aria-pressed={option.id === theme}
          title={option.hint}
          onClick={() => setTheme(option.id)}
        >
          <span className="theme-picker__swatch" aria-hidden="true">
            {option.swatch.map((color, index) => (
              <span key={index} style={{ background: color }} />
            ))}
          </span>
          <span className="theme-picker__name">{option.name}</span>
        </button>
      ))}
    </div>
  );
}
