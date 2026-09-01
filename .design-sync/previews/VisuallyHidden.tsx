import { IconButton, VisuallyHidden } from '@cookbook/web';

export function NamingAnIconControl() {
  return (
    <div className="flex items-center gap-3">
      <IconButton>
        <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <VisuallyHidden>Search the cookbook</VisuallyHidden>
      </IconButton>
      <span className="text-[14px] text-ink-3">
        This control has no visible label - only a screen reader announces it as "Search the cookbook".
      </span>
    </div>
  );
}

export function AddingContext() {
  return (
    <p className="m-0 text-[15px] text-ink-2">
      Serves 4<VisuallyHidden> people</VisuallyHidden>
    </p>
  );
}
