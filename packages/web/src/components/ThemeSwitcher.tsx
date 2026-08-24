import { Check } from 'lucide-react';
import { useTheme } from '@pior-labs/design-system';
import { focusRing } from '@/components/ui';

// The theme picker as it appears inside the account menu: a labelled list with
// a live swatch and a check on the active theme. The sign-in screen uses the
// side-by-side `ThemePicker` instead - the same preference, sized for a screen
// with nothing else on it.
export function ThemeSwitcher({ onSelect }: { onSelect?: () => void }) {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div role="group" aria-label="Theme">
      <div className="px-3 pt-1.5 pb-1 font-serif text-[11px] tracking-wide italic text-ink-2">
        Theme
      </div>
      <div className="flex flex-col gap-0.5">
        {themes.map((option) => {
          const active = option.id === theme;

          return (
            <button
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              onClick={() => {
                setTheme(option.id);
                onSelect?.();
              }}
              className={[
                'flex w-full cursor-pointer items-center gap-2.5 rounded-xl border-0 bg-transparent px-3 py-2 text-left font-[inherit] transition-colors',
                focusRing,
                active ? 'bg-ink/5' : 'hover:bg-ink/5',
              ].join(' ')}
            >
              <span
                aria-hidden="true"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgba(var(--frost-rgb),0.5)]"
                style={{ background: option.swatch[0] }}
              >
                <span className="flex h-2.5 w-2.5 overflow-hidden rounded-full">
                  <span className="h-full w-1/2" style={{ background: option.swatch[1] }} />
                  <span className="h-full w-1/2" style={{ background: option.swatch[2] }} />
                </span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[13px] text-ink">{option.name}</span>
                <span className="truncate text-[11px] text-ink-2">{option.hint}</span>
              </span>
              {active ? (
                <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2.5} />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
