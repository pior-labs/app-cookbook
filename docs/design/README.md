# Login design concepts

Three login concepts for Pior Labs Cookbook, built as a showcase gallery so a
direction can be chosen before promoting one into the real login flow. Each is a
single sign-on page (there is one central SSO provider), and each is built
entirely on the `@pior-labs/design-system` tokens so it re-skins with the active
theme.

| # | Concept | Document | Component |
|---|---------|----------|-----------|
| 1 | Ticket Stub | [01-ticket-stub.md](01-ticket-stub.md) | `TicketLogin` |
| 2 | Frosted Recipe Card | [02-frosted-recipe-card.md](02-frosted-recipe-card.md) | `FrostedCardLogin` |
| 3 | Pinned Recipe Card | [03-pinned-recipe-card.md](03-pinned-recipe-card.md) | `PinboardCardLogin` |

## Where the code lives

All under `packages/web/src/login/`:

- `variants.tsx` - the three concept components and the `LOGIN_VARIANTS` list.
- `LoginGallery.tsx` - the showcase shell: variant switcher, theme switcher,
  keyboard navigation, and deep-link handling.
- `parts.tsx` - shared pieces: `useSignInFlow`, `SignInButton`, `AuthError`,
  `Seal`, and `MeshBackdrop`.
- `login-gallery.css` - all styling, 100% derived from design-system tokens.

The gallery is a non-invasive overlay; the current `LoginScreen` is untouched.
Open it at `/?login-gallery`, and deep-link a specific concept and theme with
`/?login-gallery&v=1&theme=bloom` (`v` is 1-3, `theme` is `bloom` or `slate`).
Arrow keys and number keys 1-3 also switch concepts.

## Shared foundations

These apply to all three concepts, so the individual documents do not repeat
them.

### Themes

The design system ships two themes, applied with `data-theme` on the document
root and switched live by the gallery:

- **Bloom** - warm light. Cream surfaces, terracotta primary (`#c96442`), soft
  pistachio / peach / lavender accents.
- **Slate** - cool neutral. Cool grey surfaces, blue primary (`#3b6ea5`), muted
  blue-grey accents.

Every concept reads its surfaces, text, borders, accents, and shadows from
semantic tokens, so switching the theme reskins the whole page with no
concept-specific overrides. Nothing hardcodes a palette.

### Semantic tokens in use

`--background`, `--foreground`, `--card`, `--muted`, `--border`,
`--border-soft`, `--primary`, `--primary-foreground`, `--accent-1/2/3`,
`--accent-soft`, `--destructive`, and the glass tokens `--glass-bg`,
`--glass-border`, `--glass-shadow`. Radii come from `--radius` (14px) and
`--radius-sm` (10px).

### Typography

Four families from the design system, loaded in `packages/web/index.html`:

- **Fraunces** - serif display, used for headlines.
- **Outfit** - sans, used for body and buttons.
- **Caveat** - handwritten display, used for recipe scraps.
- **Kalam** - handwritten body, used for scrap notes.

Monospace labels use the system mono stack for eyebrows, serials, and meta rows.

### Sign-in

Every concept shows one button, "Continue with Pior Labs", wired through
`useSignInFlow` to `startSignIn`. There is no email/password or alternate
provider by design - the central SSO handles the actual login. Errors surface
inline above the button via `AuthError`.

### Quality floor

All three are responsive to mobile, keep visible keyboard focus, and respect
`prefers-reduced-motion` (entrance and ambient animation are disabled).
