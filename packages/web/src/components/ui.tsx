import { ArrowLeft, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import type {
  ButtonHTMLAttributes,
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
export function chipClass(active = false, className?: string): string {
  return cn(
    'inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium',
    'transition-[background-color,color,box-shadow] duration-200',
    focusRing,
    active
      ? 'border-transparent bg-ink text-cream shadow-[0_6px_18px_-6px_color-mix(in_srgb,var(--ink)_45%,transparent)]'
      : 'border-frost/80 bg-frost/55 text-ink-2 backdrop-blur-md hover:bg-frost/85 hover:text-ink',
    className,
  );
}

// A chip whose control is a visually hidden checkbox or radio inside it, so
// the ring has to come from the input's focus rather than the label's.
export function chipLabelClass(active = false): string {
  return chipClass(
    active,
    'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/45 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-cream',
  );
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
export function Breadcrumb({ to, children }: { to: string; children: ReactNode }) {
  return (
    <nav aria-label="Breadcrumb">
      <Link
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full py-1 text-[14px] text-ink-2 transition-colors hover:text-ink',
          focusRing,
        )}
        to={to}
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
        {children}
      </Link>
    </nav>
  );
}

export function PageHeader({
  kicker,
  title,
  lede,
  actions,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-5 px-0.5 pt-1 sm:px-1">
      <div className="min-w-0">
        {kicker ? <div className="text-[13px] tracking-wide text-ink-3">{kicker}</div> : null}
        <h1 className="my-1.5 font-serif text-[36px] leading-none font-normal tracking-[-0.03em] text-ink sm:text-[44px] lg:text-[52px]">
          {title}
        </h1>
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
