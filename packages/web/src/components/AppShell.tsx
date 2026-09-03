import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { FolderTree, Heart, History, House, Menu, Plus, Search, Trash2, X } from 'lucide-react';
import { useAuth } from '@/auth';
import { useCookMode } from '@/components/CookMode';
import { Wordmark } from '@/components/BrandMark';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { ThemePicker } from '@/ThemePicker';
import { buttonClass, focusRing } from '@/components/ui';
import { useModalOverlay } from '@/lib/overlay';

// The navigation every screen shares. Home, browse, favorites, and recent are
// four ways into the same shelf, so they sit together; organize and trash tend
// the shelf itself, so they sit under their own heading
// (technical design section 11.1).
//
// The rail is glass over the ambient mesh `App` renders, the material the
// sign-in screen introduced. Content surfaces stay opaque: a recipe is read
// while cooking, and text over moving colour is not
// (login design study, docs/design/README.md).

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end: boolean;
}

const COOK_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/recipes', label: 'Browse', icon: Search, end: true },
  { to: '/favorites', label: 'Favorites', icon: Heart, end: false },
  { to: '/recent', label: 'Recent', icon: History, end: false },
];

const KEEP_NAV: NavItem[] = [
  { to: '/organize', label: 'Organize', icon: FolderTree, end: false },
  { to: '/trash', label: 'Trash', icon: Trash2, end: false },
];

// Past the first inch of a page, the bar is a strip of blur laid over whatever
// is being read, and the wordmark on it is a link to a screen someone is
// already looking at. So the glass and the wordmark fade out on scroll and
// leave the one control that is still worth the space: the menu, floating.
const HEADER_CONDENSE_AT = 24;

function useCondensedHeader(enabled: boolean) {
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setCondensed(false);
      return;
    }

    // Setting the same value back is free - React drops the render - so this
    // can stay a plain passive listener rather than a rAF-throttled one.
    const update = () => setCondensed(window.scrollY > HEADER_CONDENSE_AT);

    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [enabled]);

  return condensed;
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const { cooking, setCooking } = useCookMode();

  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const condensed = useCondensedHeader(!cooking);

  const accountRef = useRef<HTMLDivElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const mobileNavTriggerRef = useRef<HTMLButtonElement>(null);

  // Leaving a recipe leaves the stove. Cook mode never survives a navigation,
  // or the next screen would open with no way back to the navigation.
  useEffect(() => {
    setMobileNavOpen(false);
    setAccountOpen(false);
    setCooking(false);
  }, [location.pathname, setCooking]);

  useEffect(() => {
    if (!accountOpen) return;

    const onDocClick = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [accountOpen]);

  // The mobile overlay covers the page, so it holds focus until it is closed
  // and hands focus back to the control that opened it. The browse filter
  // sheet is the same dialog, and shares the implementation.
  useModalOverlay({
    open: mobileNavOpen,
    dialogRef: mobileNavRef,
    triggerRef: mobileNavTriggerRef,
    onClose: () => setMobileNavOpen(false),
  });

  return (
    <div className="relative min-h-dvh text-[15px] leading-[1.55] text-ink">
      {/* Ahead of the navigation on every screen, so a keyboard or
          screen-reader user gets one press past it (section 11.2). */}
      <a
        className={`absolute top-3 left-3 z-70 -translate-y-24 rounded-full border border-ink/15 bg-cream px-4 py-2.5 text-sm font-medium text-ink shadow-[0_10px_24px_-10px_color-mix(in_srgb,var(--ink)_40%,transparent)] transition-transform focus:translate-y-0 ${focusRing}`}
        href="#cookbook-main"
      >
        Skip to content
      </a>

      {/* The bar itself never takes a tap: the glass does while it is there,
          and the two controls always do. Once it has faded, the strip it
          leaves behind has to let the page through it. */}
      {!cooking ? (
        <header
          className="pointer-events-none fixed top-0 right-0 left-0 z-30 md:hidden"
          aria-hidden={mobileNavOpen}
        >
          <div
            aria-hidden="true"
            className={[
              'absolute inset-0 border-b border-frost/70 bg-[rgba(var(--surface-rgb),0.82)] backdrop-blur-xl backdrop-saturate-150 transition-opacity duration-300 ease-out motion-reduce:transition-none',
              condensed ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100',
            ].join(' ')}
          />
          <div className="relative flex items-center justify-between gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <Link
              className={[
                'flex items-center gap-2.5 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none',
                condensed ? 'pointer-events-none -translate-y-1 opacity-0' : 'pointer-events-auto',
                focusRing,
              ].join(' ')}
              to="/"
              // Faded out it is not a link any more - not to a pointer, not to
              // a keyboard, and not to a screen reader.
              inert={condensed}
            >
              <Wordmark size={28} textClass="text-[19px]" />
            </Link>
            <button
              ref={mobileNavTriggerRef}
              type="button"
              aria-label="Open navigation"
              aria-expanded={mobileNavOpen}
              aria-controls="cookbook-mobile-nav"
              onClick={() => setMobileNavOpen(true)}
              className={[
                'pointer-events-auto inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-ink/10 bg-ink p-0 text-cream transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-px motion-reduce:hover:translate-y-0',
                // Alone over the page it carries its own separation, since the
                // glass behind it is gone.
                condensed ? 'shadow-[var(--cb-action-shadow-hover)]' : 'shadow-[var(--cb-action-shadow)]',
                focusRing,
              ].join(' ')}
            >
              <Menu aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </button>
          </div>
        </header>
      ) : null}

      {mobileNavOpen ? (
        <MobileNav
          navRef={mobileNavRef}
          userName={user?.name}
          onClose={() => setMobileNavOpen(false)}
          onSignOut={() => {
            setMobileNavOpen(false);
            void signOut();
          }}
        />
      ) : null}

      <div
        className={[
          'relative z-2 mx-auto grid max-w-330 grid-cols-1 gap-0 px-4 pb-12',
          cooking
            ? 'pt-5 md:px-8 md:pt-8 md:pb-16'
            : 'pt-[calc(68px+env(safe-area-inset-top))] md:grid-cols-[236px_1fr] md:gap-7 md:px-8 md:pt-6 md:pb-15',
        ].join(' ')}
      >
        {/* The rail is a card that hugs its contents, not a full-height panel:
            it carries seven links and an account row, and stretching it to the
            viewport would be a column of empty glass under them. `max-h` keeps
            it honest on a short window, where the scroll is a safety valve
            rather than the normal case. */}
        {!cooking ? (
          <aside className="hidden flex-col gap-1.5 rounded-4xl border border-frost/80 bg-[rgba(var(--surface-rgb),0.55)] px-4 pt-[22px] pb-[18px] shadow-[0_8px_32px_color-mix(in_srgb,var(--ink)_8%,transparent),inset_0_0_0_1px_rgba(var(--frost-rgb),0.5)] backdrop-blur-xl backdrop-saturate-150 md:sticky md:top-6 md:flex md:max-h-[calc(100dvh-3rem)] md:self-start md:overflow-y-auto">
            <Link
              className={`mb-2 flex items-center gap-3 border-b border-dashed border-ink/10 px-2 pb-3.5 ${focusRing}`}
              to="/"
            >
              <Wordmark size={32} textClass="text-[21px]" />
            </Link>

            <nav aria-label="Cookbook" className="flex flex-col gap-0.5">
              {COOK_NAV.map((item) => (
                <SidebarLink item={item} key={item.to} />
              ))}
            </nav>

            <div className="px-3 pt-3.5 pb-1 font-serif text-xs tracking-wide italic text-ink-2">
              Keeping house
            </div>
            <nav aria-label="Manage the cookbook" className="flex flex-col gap-0.5">
              {KEEP_NAV.map((item) => (
                <SidebarLink item={item} key={item.to} />
              ))}
            </nav>

            {/* The rail is only as tall as what is in it, so this is a plain
                gap before the action and the account row rather than a spring
                pushing them to the bottom of the screen. */}
            <div className="h-4" />

            <Link className={buttonClass('primary', 'default', 'w-full')} to="/recipes/new">
              <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
              Add recipe
            </Link>

            <div ref={accountRef} className="relative mt-3 border-t border-dashed border-ink/10 pt-3">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((open) => !open)}
                className={[
                  'flex w-full cursor-pointer items-center gap-2.5 rounded-2xl border-0 bg-transparent px-2.5 py-2 text-left font-[inherit] transition-colors hover:bg-frost/50',
                  focusRing,
                  accountOpen ? 'bg-frost/70' : '',
                ].join(' ')}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-serif text-[15px] text-ink shadow-[inset_0_0_0_1px_rgba(var(--frost-rgb),0.6)]"
                  style={{ background: 'var(--cb-avatar-bg)' }}
                >
                  {user?.name?.[0]?.toUpperCase() ?? '?'}
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-[1.15]">
                  <span className="truncate font-serif text-[15px] text-ink">
                    {user?.name ?? 'Account'}
                  </span>
                  <span className="text-[11px] text-ink-2">Account ⌄</span>
                </span>
              </button>

              {accountOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 bottom-full left-0 z-20 mb-1 rounded-[18px] border border-frost/80 bg-[var(--cb-menu-bg)] p-1.5 shadow-[var(--cb-menu-shadow)] backdrop-blur-xl backdrop-saturate-150"
                >
                  <ThemeSwitcher />
                  <div className="my-1 border-t border-dashed border-ink/10" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountOpen(false);
                      void signOut();
                    }}
                    className={`w-full cursor-pointer rounded-xl border-0 bg-transparent px-3 py-2.5 text-left font-[inherit] text-[13px] text-ink hover:bg-ink/5 ${focusRing}`}
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}

        <main className="flex min-w-0 flex-col gap-6" id="cookbook-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        [
          'flex items-center gap-2.5 rounded-full px-3 py-2.5 text-sm font-medium transition-colors',
          focusRing,
          isActive
            ? 'bg-ink text-cream shadow-[0_6px_18px_-6px_color-mix(in_srgb,var(--ink)_45%,transparent)]'
            : 'text-ink-2 hover:bg-frost/50 hover:text-ink',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            className={[
              'inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full',
              isActive
                ? 'bg-[var(--cb-accent-surface-strong)] text-ink shadow-[inset_0_0_0_1px_rgba(var(--frost-rgb),0.4)]'
                : 'bg-frost/70 text-ink-2 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_8%,transparent)]',
            ].join(' ')}
          >
            <item.icon className="h-3.5 w-3.5" strokeWidth={2.1} />
          </span>
          <span className="flex-1">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

// The phone gets the sections at reading size rather than the rail shrunk
// down. Nothing here is numbered: the order of six destinations carries no
// information a cook needs.
function MobileNav({
  navRef,
  userName,
  onClose,
  onSignOut,
}: {
  navRef: React.RefObject<HTMLDivElement | null>;
  userName: string | undefined;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const groups: { label: string | null; items: NavItem[] }[] = [
    { label: null, items: COOK_NAV },
    { label: 'Keeping house', items: KEEP_NAV },
  ];

  let index = 0;

  return (
    <div
      ref={navRef}
      id="cookbook-mobile-nav"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation"
      tabIndex={-1}
      className="theme-overlay-anim fixed inset-0 z-50 flex flex-col bg-cream motion-reduce:animate-none md:hidden"
    >
      <div className="theme-mesh pointer-events-none" aria-hidden="true">
        <div className="theme-blob b1" />
        <div className="theme-blob b3" />
        <div className="theme-blob b5" />
      </div>

      <div className="relative flex items-center justify-between gap-3 px-5 pt-[max(0.875rem,env(safe-area-inset-top))] pb-3">
        <Link className={`flex items-center gap-2.5 ${focusRing}`} to="/" onClick={onClose}>
          <Wordmark size={30} textClass="text-[20px]" />
        </Link>
        {/* The theme as the two dials rather than as a labelled list. It is a
            preference, not a destination, and as a list of names and hints it
            was a third of this screen - enough to push the one action on it
            below the fold. */}
        <div className="flex items-center gap-2.5">
          <ThemePicker />
          <button
            data-overlay-autofocus="true"
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className={`inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-ink/10 bg-frost/60 p-0 text-ink shadow-[inset_0_0_0_1px_rgba(var(--frost-rgb),0.5)] backdrop-blur-md transition-colors hover:bg-frost/85 ${focusRing}`}
          >
            <X aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      <nav
        aria-label="Cookbook sections"
        className="relative flex flex-1 flex-col overflow-y-auto px-6 pt-3 pb-5"
      >
        {groups.map((group) => (
          <div key={group.label ?? 'main'}>
            {group.label ? (
              <div className="mt-5 mb-1 font-serif text-xs tracking-[0.18em] uppercase italic text-ink-2">
                {group.label}
              </div>
            ) : null}
            {group.items.map((item) => {
              const delay = 110 + index * 60;
              index += 1;

              return (
                <div
                  className="theme-overlay-item-anim motion-reduce:animate-none"
                  key={item.to}
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-3 border-b border-dashed border-ink/10 py-3 transition-colors',
                        focusRing,
                        isActive ? 'text-ink' : 'text-ink-2 hover:text-ink',
                      ].join(' ')
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={1.9} />
                        <span
                          className={[
                            'flex-1 font-serif text-[26px] leading-[1.1] tracking-tight',
                            isActive ? 'italic' : '',
                          ].join(' ')}
                        >
                          {item.label}
                        </span>
                        {isActive ? (
                          <span aria-hidden="true" className="font-serif text-[20px] italic text-ink">
                            →
                          </span>
                        ) : null}
                      </>
                    )}
                  </NavLink>
                </div>
              );
            })}
          </div>
        ))}

      </nav>

      {/* The one action on this screen does not belong at the end of a list
          that scrolls: on a short phone it was below the fold, behind the
          destinations it is an alternative to. */}
      <div className="relative flex flex-col gap-3 border-t border-dashed border-ink/15 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Link className={buttonClass('primary', 'default', 'w-full')} to="/recipes/new" onClick={onClose}>
          <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
          Add recipe
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-serif text-[16px] text-ink shadow-[inset_0_0_0_1px_rgba(var(--frost-rgb),0.6)]"
              style={{ background: 'var(--cb-avatar-bg)' }}
            >
              {userName?.[0]?.toUpperCase() ?? '?'}
            </span>
            <span className="flex min-w-0 flex-col leading-[1.15]">
              <span className="truncate font-serif text-[15px] text-ink">
                {userName ?? 'Account'}
              </span>
              <span className="text-[11px] text-ink-2">Signed in</span>
            </span>
          </div>
          <button type="button" onClick={onSignOut} className={buttonClass('ghost', 'small')}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
