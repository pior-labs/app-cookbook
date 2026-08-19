import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@pior-labs/design-system';
import { LOGIN_VARIANTS } from './variants';
import './login-gallery.css';

function initialVariant() {
  const raw = new URLSearchParams(window.location.search).get('v');
  const index = Number(raw) - 1;
  return Number.isInteger(index) && index >= 0 && index < LOGIN_VARIANTS.length ? index : 0;
}

export function LoginGallery() {
  const { theme, setTheme, themes } = useTheme();
  const [active, setActive] = useState(initialVariant);

  // Honor ?theme= once on load so a concept can be deep-linked in either theme.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('theme');
    if (requested && themes.some((option) => option.id === requested)) {
      setTheme(requested as typeof theme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = useCallback((delta: number) => {
    setActive((current) => (current + delta + LOGIN_VARIANTS.length) % LOGIN_VARIANTS.length);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target.isContentEditable) return;
      }

      if (event.key === 'ArrowRight') step(1);
      else if (event.key === 'ArrowLeft') step(-1);
      else if (event.key >= '1' && event.key <= String(LOGIN_VARIANTS.length)) {
        setActive(Number(event.key) - 1);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  const current = LOGIN_VARIANTS[active];
  const { Component } = current;

  return (
    <div className="login-gallery">
      <div className="lv-caption" aria-hidden="true">
        <span className="lv-caption__index">
          {String(active + 1).padStart(2, '0')} / {String(LOGIN_VARIANTS.length).padStart(2, '0')}
        </span>
        <span className="lv-caption__name">{current.name}</span>
        <span className="lv-caption__blurb">{current.blurb}</span>
      </div>

      <div className="lv-stage" role="group" aria-label={`Login concept: ${current.name}`}>
        <Component key={current.id} />
      </div>

      <div className="lv-dock">
        <div className="lv-dock__group" role="tablist" aria-label="Login concept">
          {LOGIN_VARIANTS.map((variant, index) => (
            <button
              key={variant.id}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={variant.name}
              title={variant.name}
              className={`lv-pip${index === active ? ' is-active' : ''}`}
              onClick={() => setActive(index)}
            >
              {index + 1}
            </button>
          ))}
        </div>

        <span className="lv-dock__divider" aria-hidden="true" />

        <div className="lv-dock__group lv-seg" role="group" aria-label="Theme">
          {themes.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={option.id === theme}
              className={`lv-seg__btn${option.id === theme ? ' is-active' : ''}`}
              onClick={() => setTheme(option.id)}
              title={option.hint}
            >
              <span className="lv-seg__swatch" aria-hidden="true">
                {option.swatch.map((color, i) => (
                  <span key={i} style={{ background: color }} />
                ))}
              </span>
              {option.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
