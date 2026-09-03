import { useEffect, useRef, type RefObject } from 'react';

// What an overlay that covers the page owes a keyboard: it holds focus while
// it is open, closes on Escape, keeps the page behind it from scrolling, and
// hands focus back to the control that opened it. The mobile navigation and
// the browse filter sheet are the same dialog in this respect, so they share
// one implementation rather than two that drift apart.

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    return el.tabIndex >= 0;
  });
}

export function useModalOverlay({
  open,
  dialogRef,
  triggerRef,
  onClose,
}: {
  open: boolean;
  dialogRef: RefObject<HTMLElement | null>;
  // The control that opened the overlay, focused again when it closes so a
  // keyboard lands back where it was rather than at the top of the page.
  triggerRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
}): void {
  // Callers pass a fresh closure every render; the effect must run on open and
  // close, not on every keystroke behind the overlay.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    // The first paint has to land before anything in it can take focus.
    const frame = window.requestAnimationFrame(() => {
      const focusables = getFocusableElements(dialog);
      const preferred = focusables.find((el) => el.dataset.overlayAutofocus === 'true');
      (preferred ?? focusables[0] ?? dialog).focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = getFocusableElements(dialog);
      if (focusables.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!active || !dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerRef?.current?.focus();
    };
  }, [open, dialogRef, triggerRef]);
}
