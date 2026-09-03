import { useEffect, useState } from 'react';

// Some layouts are not a class swap: the browse filters are an overlay on a
// phone and an inline section on a desktop, and an overlay owes a keyboard
// behaviour - a focus trap, a scroll lock - that CSS cannot express. Those
// screens ask the viewport directly.
//
// A document with no `matchMedia` - jsdom under test - answers "no", which
// lands every screen on the wide layout: the one where every control is
// already in the page.
function evaluate(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => evaluate(query));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);

    // A rotation between the first render and this effect would otherwise be
    // missed, since the initial state was read before the listener existed.
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}
