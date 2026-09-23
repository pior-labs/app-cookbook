import { ArrowLeft, ChevronDown, MoreHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  InputHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

// The app's control vocabulary. Screens compose these rather than restating
// the same twenty utilities, which is what keeps a button on the Trash screen
// identical to a button on the recipe form.

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-cream';

export type ButtonVariant = 'primary' | 'ghost' | 'quiet' | 'danger';
export type ButtonSize = 'default' | 'small';

const VARIANTS: Record<ButtonVariant, string> = {
  // The one solid action on a screen. Everything else steps back from it.
  primary:
    'border-ink/10 bg-ink text-cream shadow-[var(--cb-action-shadow)] hover:bg-[var(--cb-action-hover-bg)] hover:-translate-y-px hover:shadow-[var(--cb-action-shadow-hover)] motion-reduce:hover:translate-y-0',
  ghost:
    'border-ink/12 bg-frost/55 text-ink backdrop-blur-md hover:bg-frost/85 hover:-translate-y-px motion-reduce:hover:translate-y-0',
  quiet: 'border-transparent bg-transparent text-ink-2 hover:bg-ink/5 hover:text-ink',
  // Reserved for the one irreversible action in the app, so it is the only
  // control that looks like one.
  danger:
    'border-transparent bg-destructive text-cream hover:brightness-95 hover:-translate-y-px motion-reduce:hover:translate-y-0',
};

// A finger is the same size everywhere, so a coarse pointer gets the full
// touch target back on the dense rows that use the small size.
const SIZES: Record<ButtonSize, string> = {
  default: 'min-h-11 px-5 text-[15px]',
  small: 'min-h-[34px] px-3.5 text-[13px] pointer-coarse:min-h-11 pointer-coarse:px-4',
};

export function buttonClass(
  variant: ButtonVariant = 'ghost',
  size: ButtonSize = 'default',
  className?: string,
): string {
  return cn(
    'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border py-2 font-medium whitespace-nowrap',
    'transition-[background-color,box-shadow,transform,filter] duration-200 ease-out',
    'disabled:pointer-events-none disabled:opacity-55',
    focusRing,
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant, size, className, type = 'button', ...rest }: ButtonProps) {
  return <button className={buttonClass(variant, size, className)} type={type} {...rest} />;
}

export function ButtonLink({
  to,
  variant,
  size,
  className,
  children,
}: {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link className={buttonClass(variant, size, className)} to={to}>
      {children}
    </Link>
  );
}

// A square control for the reorder and remove actions in the recipe form.
export function IconButton({
  className,
  tone = 'default',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'default' | 'danger' }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-2xl border border-ink/12',
        'bg-frost/55 text-ink-2 backdrop-blur-md transition-colors duration-200',
        'disabled:pointer-events-none disabled:opacity-45',
        tone === 'danger' ? 'hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive' : 'hover:bg-frost/85 hover:text-ink',
        focusRing,
        className,
      )}
      {...rest}
    />
  );
}

// ---- overflow menu ----------------------------------------------------

// The rare actions on a thing, behind one control, so the frequent one can stay
// out in the open. A meal card, a plan card and a plan's own title all need
// this, and the click-outside and Escape handling is not worth writing three
// times.

const MenuCloseContext = createContext<() => void>(() => {});

export function MenuItem({
  children,
  onSelect,
  disabled,
  tone = 'default',
}: {
  children: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}) {
  const close = useContext(MenuCloseContext);

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cn(
        'w-full cursor-pointer rounded-xl border-0 bg-transparent px-3 py-2.5 text-left font-[inherit]',
        'text-[13px] transition-colors disabled:pointer-events-none disabled:opacity-45',
        tone === 'danger'
          ? 'text-[var(--cb-danger-ink-strong)] hover:bg-destructive/10'
          : 'text-ink hover:bg-ink/5',
        focusRing,
      )}
      onClick={() => {
        close();
        onSelect();
      }}
    >
      {children}
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1 border-t border-dashed border-ink/10" />;
}

export function OverflowMenu({
  label,
  children,
  disabled,
  size = 'default',
  placement = 'bottom',
  quiet = false,
}: {
  label: string;
  children: ReactNode;
  disabled?: boolean;
  // `small` is the round control that rides under a card; `default` matches
  // `IconButton`, so it sits level with the other controls on a page header.
  size?: 'default' | 'small';
  placement?: 'top' | 'bottom';
  // For a control repeated down a list: no ring until it is pointed at or
  // focused, so a column of them does not outweigh what the rows say.
  quiet?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const onDocClick = (event: MouseEvent) => {
      if (holder.current && !holder.current.contains(event.target as Node)) setOpen(false);
    };
    // Escape returns focus to the control that opened the menu, the same way
    // the modal overlay does.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };

    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={holder}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-grid shrink-0 cursor-pointer place-items-center border transition-colors duration-200',
          quiet
            ? 'border-transparent bg-transparent text-ink-3 hover:bg-ink/5 hover:text-ink'
            : 'border-ink/12 bg-frost/55 text-ink-2 backdrop-blur-md hover:bg-frost/85 hover:text-ink',
          'disabled:pointer-events-none disabled:opacity-45',
          size === 'small' ? 'h-9 w-9 rounded-full' : 'h-11 w-11 rounded-2xl',
          open ? 'bg-frost/85 text-ink' : '',
          focusRing,
        )}
      >
        <MoreHorizontal aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            'absolute right-0 z-20 w-46 rounded-[18px] border border-frost/80 bg-[var(--cb-menu-bg)]',
            'p-1.5 shadow-[var(--cb-menu-shadow)] backdrop-blur-xl backdrop-saturate-150',
            placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          )}
        >
          <MenuCloseContext.Provider value={close}>{children}</MenuCloseContext.Provider>
        </div>
      ) : null}
    </div>
  );
}

// ---- fields -----------------------------------------------------------

// Fields stay near-opaque where the chrome is glass: a recipe is written and
// read while cooking, and text over moving colour is not.
const CONTROL_BASE =
  'w-full min-h-11 rounded-2xl border border-frost/80 bg-[rgba(var(--surface-rgb),0.92)] px-4 py-2.5 text-[15px] text-ink ' +
  'shadow-[inset_0_0_0_1px_rgba(var(--frost-rgb),0.5)] transition-[border-color,box-shadow] duration-200 ' +
  'placeholder:text-ink-3 focus:outline-none focus:border-accent/45 focus:shadow-[var(--cb-focus-shadow)] ' +
  'aria-[invalid=true]:border-[var(--cb-danger-border)] disabled:opacity-60';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL_BASE, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL_BASE, 'min-h-24 resize-y leading-relaxed', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select className={cn(CONTROL_BASE, 'cursor-pointer appearance-none pr-10', className)} {...rest}>
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        strokeWidth={2.25}
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
      />
    </span>
  );
}

export function FieldLabel({ htmlFor, children, className }: { htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block text-[13px] font-medium text-ink-2', className)} htmlFor={htmlFor}>
      {children}
    </label>
  );
}

export function FieldHint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p className="m-0 text-[13px] text-ink-3" id={id}>
      {children}
    </p>
  );
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p className="m-0 text-[13px] font-medium text-[var(--cb-danger-ink-strong)]" id={id} role="alert">
      {children}
    </p>
  );
}

// ---- surfaces ---------------------------------------------------------

// Glass, the material the sign-in card introduced. Used for chrome and for
// panels that hold short content.
export function Panel({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('theme-glass rounded-[26px] p-5 sm:rounded-4xl sm:p-7', className)} {...rest}>
      {children}
    </div>
  );
}

// A pill that either filters (button) or navigates (link).
const CHIP_BASE =
  'inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium ' +
  'transition-[background-color,color,box-shadow] duration-200';

export function chipClass(active = false, className?: string): string {
  return cn(
    CHIP_BASE,
    focusRing,
    active
      ? 'border-transparent bg-ink text-cream shadow-[0_6px_18px_-6px_color-mix(in_srgb,var(--ink)_45%,transparent)]'
      : 'border-frost/80 bg-frost/55 text-ink-2 backdrop-blur-md hover:bg-frost/85 hover:text-ink',
    className,
  );
}

// A tag's chip, in the colour the household gave the tag. The colours
// themselves live in `.cb-tag` in app.css, which mixes the tag's hex against
// the active theme's ink and surface rather than painting it flat, so a tag
// reads the same way in either theme. A tag with no colour is simply the
// neutral chip above.
export function tagChipClass(
  color: string | null | undefined,
  active = false,
  className?: string,
): string {
  if (!color) return chipClass(active, className);

  return cn(CHIP_BASE, focusRing, 'cb-tag', active ? 'cb-tag-on' : '', className);
}

// The tag's own colour, handed to CSS as a custom property so one rule can
// express what to do with it.
export function tagChipStyle(color: string | null | undefined): CSSProperties | undefined {
  return color ? ({ '--tag-color': color } as CSSProperties) : undefined;
}

// A chip whose control is a visually hidden checkbox or radio inside it, so
// the ring has to come from the input's focus rather than the label's.
const CHIP_LABEL_RING =
  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/45 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-cream';

export function chipLabelClass(active = false): string {
  return chipClass(active, CHIP_LABEL_RING);
}

export function tagChipLabelClass(color: string | null | undefined, active = false): string {
  return tagChipClass(color, active, CHIP_LABEL_RING);
}

// ---- page furniture ---------------------------------------------------

// A small mono label. Used only where something is filed under something else -
// a recipe's category - which is the one place an index label is true.
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'm-0 font-mono text-[11px] font-semibold tracking-[0.16em] text-ink-3 uppercase',
        className,
      )}
    >
      {children}
    </p>
  );
}

// One way back, in one place, on every screen that is not a top-level section.
const BACK = cn(
  'inline-flex items-center gap-1.5 rounded-full py-1 text-[14px] text-ink-2 transition-colors hover:text-ink',
  focusRing,
);

export function Breadcrumb({ to, children }: { to: string; children: ReactNode }) {
  return (
    <nav aria-label="Breadcrumb">
      <Link className={BACK} to={to}>
        <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
        {children}
      </Link>
    </nav>
  );
}

// The same way back for a step that is a change of state rather than a change
// of address - picking a recipe for a meal plan happens over the plan, not at
// its own URL. It has to be a button: a button inside a link is neither valid
// nor operable, and a link that goes nowhere is a lie to a keyboard.
export function BackButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button className={cn(BACK, 'cursor-pointer border-0 bg-transparent p-0 font-[inherit]')} type="button" onClick={onClick}>
      <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
      {children}
    </button>
  );
}

export function PageHeader({
  kicker,
  title,
  titleAction,
  lede,
  actions,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  // A control that acts on the title itself - renaming it, most obviously -
  // and so sits beside it rather than out in `actions` with the controls that
  // act on the page. Kept outside the heading: a button inside an `h1` becomes
  // part of the heading's name, and "This week Rename meal plan" is not what
  // the heading says.
  titleAction?: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
}) {
  const heading = (
    <h1 className="my-1.5 min-w-0 font-serif text-[36px] leading-none font-normal tracking-[-0.03em] text-ink sm:text-[44px] lg:text-[52px]">
      {title}
    </h1>
  );

  return (
    <header className="flex flex-wrap items-end justify-between gap-5 px-0.5 pt-1 sm:px-1">
      <div className="min-w-0">
        {kicker ? <div className="text-[13px] tracking-wide text-ink-3">{kicker}</div> : null}
        {titleAction ? (
          <div className="flex flex-wrap items-center gap-3">
            {heading}
            {titleAction}
          </div>
        ) : (
          heading
        )}
        {lede ? <p className="m-0 max-w-140 text-[15px] text-ink-2 sm:text-base">{lede}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </header>
  );
}

export function SectionHeading({
  id,
  children,
  sub,
  className,
}: {
  id?: string;
  children: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <h2
        className="m-0 font-serif text-[22px] leading-[1.15] font-normal tracking-[-0.02em] text-ink sm:text-[26px]"
        id={id}
      >
        {children}
      </h2>
      {sub ? <span className="mt-0.5 block font-serif text-sm italic text-ink-3">{sub}</span> : null}
    </div>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
