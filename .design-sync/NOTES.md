# design-sync notes - app-cookbook

## What is actually being synced

This repo is an **application**, not a design system. The synced system is
deliberately a combination of two homes:

- **Tokens and theming** from the installed `@pior-labs/design-system` (1.0.1),
  whose own repo is the sibling `../package-design-system`. That package ships
  *only* tokens + `ThemeProvider` - it has no visual components.
- **The control vocabulary** from `packages/web/src` (`components/ui.tsx` and
  friends), which is where the real Buttons, fields and page furniture live.

`.design-sync/ds-entry.tsx` is the barrel that states that combined surface.
It is the `entry` in the config, and it is the only place the public surface is
declared. **Adding a component means editing three things**: the barrel,
`componentSrcMap`, and `dtsPropsFor`.

## Gotchas that cost time

- **`@types/react` resolution.** With `entry` under `.design-sync/`, the
  converter resolves `PKG_DIR` to the **repo root**, and its DTS resolver only
  walks *upward* from there - so it never finds `packages/web/node_modules/@types/react`.
  Without it every emitted props body comes out as `[key: string]: unknown`.
  `buildCmd` symlinks `@types/react` and `@types/react-dom` into the root
  `node_modules` to bridge this. `node_modules` is gitignored, so this is
  re-created on every run by design - do not "clean it up".
- **There is no `dist`, so there is no `.d.ts` tree.** Component props are
  hand-written in `cfg.dtsPropsFor`, transcribed from `packages/web/src/components/ui.tsx`.
  This is the documented escape hatch, but it does not track the source.
- **`cssEntry` is compiled, not authored.** `.design-sync/ds-styles.css` is a
  Tailwind v4 entry; `buildCmd` compiles it to `.design-sync/.cache/ds-styles.built.css`,
  which is what `cssEntry` points at. **Always run `buildCmd` before
  `package-build.mjs`** - otherwise new utility classes used by a preview have
  no CSS.
- **The safelist matters.** Tailwind only emits classes it finds in scanned
  sources, so utilities the app never happens to use (`bg-accent`,
  `text-destructive`) would be missing and any design built with them would
  render unstyled. The `@source inline(...)` block in `ds-styles.css` emits the
  whole `--color-*` palette. It takes the stylesheet from ~100 KB to ~350 KB,
  which is the intended trade.
- **Provider chain.** `cfg.provider` is `PreviewProviders` from the barrel:
  `ThemeProvider > MemoryRouter > AuthProvider > CookModeProvider`. `AppShell`
  calls `useAuth`, which *throws* without `AuthProvider` - that was the one
  render failure in the first pass.
- **The session shim.** `AuthProvider` fetches `/api/auth/get-session`, which no
  preview has. `ds-entry.tsx` answers that single request locally so `AppShell`
  previews show a real account name instead of "Account"/"?". It is scoped to
  that one path and is preview-only.
- **Fonts are remote by design.** The app loads Fraunces/Outfit/Caveat/Kalam
  from Google Fonts via a `<link>` in `packages/web/index.html`. Rendered
  designs only receive the `styles.css` import closure, so `ds-styles.css`
  repeats that as an `@import url(...)`.
- **Environment.** `pnpm` prints a benign `${GITHUB_TOKEN}` warning from
  `.npmrc` (the DS package is on GitHub Packages); the lockfile installs fine
  from cache. playwright **1.62.1** matches the already-cached chromium build
  1234 - no browser download is needed.

## Known render warns

- `[FONT_REMOTE]` on Outfit/Fraunces/Caveat/Kalam - expected, see above. Not new.
- `IconButton` `Tones`: `default` and `danger` are identical at rest; the tone
  only changes the hover state. Graded good deliberately.

## Re-sync risks

- **`dtsPropsFor` does not track the source.** If anyone changes a prop in
  `packages/web/src/components/ui.tsx`, the emitted contract silently goes
  stale. Re-read `ui.tsx` against the config on any sync that follows UI work.
  The durable fix is giving the components a real build that emits `.d.ts`.
- **The barrel enumerates the surface.** New components under
  `packages/web/src/components/` will NOT appear until added to
  `ds-entry.tsx` + `componentSrcMap` + `dtsPropsFor`.
- **The session shim is tied to `AuthProvider`'s current endpoint.** If that
  path changes, `AppShell` previews quietly fall back to an empty account.
- **The safelist is the DS 1.0.1 palette.** Bumping `@pior-labs/design-system`
  can add `--color-*` entries that the `@source inline(...)` block does not
  list; re-read its `@theme` block after any version bump.
- **Tokens come from the installed package**, not from `../package-design-system`
  source. A local change in that sibling repo is invisible here until it is
  published and the dependency bumped.
- The build assumes node 20 + pnpm 10.8.1, and fetches fonts from Google Fonts
  at render time (the headless render check needs network).
