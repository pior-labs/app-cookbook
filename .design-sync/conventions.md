## How to build with the Cookbook design system

This is a household cookbook app's design system: the theme tokens come from
`@pior-labs/design-system`, the control vocabulary from the Cookbook app
itself. Everything below is the real shipped contract - no other conventions
are implied.

### Setup

**Styling needs no provider.** The token values are defined on `:root` (the
`bloom` theme), so components are styled the moment `styles.css` is loaded.
Do not wrap things in a provider just to get colour.

Two things do need a wrapper:

- **Anything that navigates** - `ButtonLink`, `Breadcrumb`, `AppShell` - renders
  a react-router `<Link>` and throws outside a router. `Routes`, `Route`,
  `Link`, `NavLink` and `Outlet` are re-exported from this library; import them
  from here, never from `react-router-dom`, or you get a second router instance
  with an empty context.
- **Theme switching** - `ThemeSwitcher`, `ThemePicker` and `useTheme` need
  `ThemeProvider`. It writes `data-theme` onto `<html>` and persists the choice.
  The two themes are `bloom` (warm light, the default) and `slate` (cool
  neutral); you can also set `data-theme="slate"` directly with no provider.

`AppShell` is a layout route, not a component you nest by hand: give it child
routes and it renders them through `<Outlet />`.

### The styling idiom

**Tailwind v4 utilities over semantic tokens.** Never hardcode a colour and
never invent a palette - the whole app reskins by swapping `data-theme`, and a
literal hex breaks that. Use these families (all real `--color-*` entries in
the design system's `@theme` block, and all emitted in the shipped CSS):

| Role | Utilities |
|---|---|
| Text | `text-ink` (primary), `text-ink-2` (secondary), `text-ink-3` (muted), `text-cream` (on dark) |
| Surfaces | `bg-cream` (page), `bg-frost` (glass), `bg-card`, `bg-ink` (the one solid action) |
| Accent | `text-accent`, `bg-accent`, `bg-accent-soft`, `accent-1` / `accent-2` / `accent-3` (the brand trio) |
| Status | `destructive`, `good`, `good-soft`, `warn`, `warn-soft` |
| shadcn-compatible | `background`, `foreground`, `card`, `muted`, `muted-foreground`, `border`, `border-soft`, `primary`, `primary-soft` |
| Type | `font-serif` (Fraunces - headings), body is Outfit by default, `font-mono` (eyebrows and labels) |

Opacity modifiers are idiomatic and emitted: `bg-ink/10`, `border-frost/80`,
`bg-frost/55`. Compound values that would be unreadable inline are CSS custom
properties instead - use them with arbitrary-value syntax, e.g.
`shadow-[var(--cb-action-shadow)]`, `bg-[var(--cb-menu-bg)]`,
`text-[var(--cb-danger-ink-strong)]`. The `theme-glass` class is the app's
frosted-glass material; `Panel` already applies it.

Three exported helpers let you match a control's styling on your own element
rather than restating it: `buttonClass(variant, size, className)`,
`chipClass(active, className)` and `chipLabelClass(active)`. `focusRing` is the
focus-visible class string every interactive element uses - add it to any
custom control so focus stays consistent.

### Where the truth lives

Read `styles.css` and its imports for the token values, and each component's
`<Name>.prompt.md` and `<Name>.d.ts` for its API and intended use. The
`guidelines/` folder holds the design concept docs behind the visual language.

### A typical screen

```jsx
<Panel>
  <Eyebrow>Weeknight</Eyebrow>
  <SectionHeading sub="Serves 4, ready in 35 minutes">Lemon and dill orzo</SectionHeading>
  <p className="mt-3 mb-0 text-[15px] text-ink-2">
    Keep the pan moving once the stock is in, or the orzo catches.
  </p>
  <div className="mt-5 flex justify-end gap-2.5">
    <Button variant="quiet">Cancel</Button>
    <Button variant="primary">Save recipe</Button>
  </div>
</Panel>
```

One `primary` action per screen; everything else is `ghost` or `quiet`.
`danger` is reserved for the single irreversible action.
