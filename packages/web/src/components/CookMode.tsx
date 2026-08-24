import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

// Cook mode is a property of the whole app, not of the recipe screen: the
// shell has to drop its navigation and the atmosphere has to settle, and
// neither of those lives inside the recipe page.

interface CookModeValue {
  cooking: boolean;
  setCooking: (cooking: boolean) => void;
}

const CookModeContext = createContext<CookModeValue>({ cooking: false, setCooking: () => {} });

export function useCookMode(): CookModeValue {
  return useContext(CookModeContext);
}

// `navigator.wakeLock` is not in every browser's lib types, and a refused lock
// is not an error worth surfacing, so it is reached for defensively.
interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

function wakeLockApi() {
  const candidate = navigator as Navigator & {
    wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
  };

  return candidate.wakeLock;
}

// A cook has their hands in a bowl. The screen going dark mid-recipe means
// wiping them to wake it, so cook mode holds the display awake while it is on
// and lets go the moment it is not.
function useScreenWakeLock(active: boolean): void {
  useEffect(() => {
    const api = wakeLockApi();
    if (!active || !api) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let released = false;

    const acquire = async () => {
      try {
        const next = await api.request('screen');
        if (released) {
          void next.release();
          return;
        }
        sentinel = next;
      } catch {
        // Denied, unsupported, or the tab is not visible. Cooking continues.
      }
    };

    // Browsers drop the lock whenever the tab is hidden, so coming back to the
    // recipe has to take it again.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void sentinel?.release();
      sentinel = null;
    };
  }, [active]);
}

// Entering and leaving cook mode swaps the whole layout, so the scroll offset
// carried over from the other one points at nothing. Tapping "Cook this" from
// the bottom of a long recipe otherwise lands the cook halfway down their own
// ingredient list.
function useScrollToTopOnToggle(cooking: boolean): void {
  const settled = useRef(false);

  useEffect(() => {
    // The first run is the initial render, not a toggle: scrolling there would
    // fight whatever position the browser is restoring.
    if (!settled.current) {
      settled.current = true;
      return;
    }

    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [cooking]);
}

export function CookModeProvider({ children }: { children: ReactNode }) {
  const [cooking, setCooking] = useState(false);

  useScreenWakeLock(cooking);
  useScrollToTopOnToggle(cooking);

  const value = useMemo(() => ({ cooking, setCooking }), [cooking]);

  return <CookModeContext.Provider value={value}>{children}</CookModeContext.Provider>;
}
