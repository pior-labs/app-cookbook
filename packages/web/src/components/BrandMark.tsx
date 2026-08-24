// The Cookbook seal: a bowl in ink with three wisps of steam in the theme's
// accent tones. Built from the same primitives as the finance tracker's mark -
// three accents around an ink anchor - so the Pior Labs apps read as siblings,
// but the form belongs to a kitchen rather than a ledger.
export function BrandMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M10 13.5C8.2 10.8 11.8 9.4 10 5.5"
        stroke="var(--cb-mark-1)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M16 14C14.2 10.6 17.8 8.8 16 4"
        stroke="var(--cb-mark-2)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M22 13.5C20.2 10.8 23.8 9.4 22 5.5"
        stroke="var(--cb-mark-3)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* The bowl. A hair wider than a half-disc so it sits like a vessel
          rather than a slice. */}
      <path d="M3.5 17.5H28.5C28.5 24.4036 22.8513 29 16 29C9.14873 29 3.5 24.4036 3.5 17.5Z" fill="var(--cb-mark-core-border)" />
      <path
        d="M3.5 17.5H28.5"
        stroke="var(--cb-mark-core-border)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Mark plus wordmark, the pairing that appears in the sidebar, the mobile bar,
// and the mobile navigation overlay.
export function Wordmark({ size = 34, textClass = 'text-[22px]' }: { size?: number; textClass?: string }) {
  return (
    <>
      <BrandMark size={size} />
      <span className={`font-serif ${textClass} font-medium italic tracking-tight`}>Cookbook</span>
    </>
  );
}
