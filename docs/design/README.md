# Login design concepts

Login concepts for Pior Labs Cookbook, built as showcases so a direction can be
chosen before promoting one into the real login flow. Each is a single sign-on
page (there is one central SSO provider), and each is built entirely on the
`@pior-labs/design-system` tokens so it re-skins with the active theme.

**Concept 7, "The Index, Lit", is the current sign-in screen.** It lives with
the rest of the shipped UI (`login/LoginScreen.tsx`, `login/login.css`), and the
design study renders that component in slot 4 so the showcase can never drift
from the real screen. See [A second round](#a-second-round-designslogin1-4).

## Round one: the gallery

| # | Concept | Document | Component |
|---|---------|----------|-----------|
| 1 | Ticket Stub | [01-ticket-stub.md](01-ticket-stub.md) | `TicketLogin` |
| 2 | Frosted Recipe Card | [02-frosted-recipe-card.md](02-frosted-recipe-card.md) | `FrostedCardLogin` |
| 3 | Pinned Recipe Card | [03-pinned-recipe-card.md](03-pinned-recipe-card.md) | `PinboardCardLogin` |

Concept 2 was chosen out of this round and was the sign-in screen until concept
7 replaced it. It moved back into the gallery when that happened, so all three
of round one are now gallery-only records of what was considered.

## Where the code lives

All under `packages/web/src/login/`:

- `LoginScreen.tsx` + `login.css` - the shipped sign-in screen (concept 7).
- `SessionLoading.tsx` - the session-restore screen that precedes it. It is the
  sign-in screen with the band still empty - same mesh, same drifting index,
  same cut in the same place, sized to the same height - so only the contents of
  the band change when the session answer arrives.
- `IndexColumns.tsx` + `index-columns.css` - the drifting index listing, shared
  by the sign-in screen and the design study. Structure and motion only; the
  `--ix-*` properties let each set how loud the wall is.
- `index-content.ts` - the listing itself. **It is decoration, not data.** The
  sign-in screen is pre-authentication, so it cannot know what is in the book,
  and a private household's dish names must not be readable by anyone who loads
  the login URL. Nothing on the screen counts the listing or attributes it to
  the household.
- `useSignInFlow.ts` - the single-SSO sign-in flow, shared by the screen and
  every concept.
- `variants.tsx` - round one's concepts and the `LOGIN_VARIANTS` list.
- `LoginGallery.tsx` - the showcase shell: variant switcher, theme switcher,
  keyboard navigation, and deep-link handling.
- `parts.tsx` - shared pieces: `SignInButton`, `AuthError`, `Seal`, `ArrowIcon`.
- `login-gallery.css` - styling for the gallery chrome and all three round-one
  concepts, 100% derived from design-system tokens.

The gallery is a non-invasive overlay. Open it at `/?login-gallery`, and
deep-link a specific concept and theme with `/?login-gallery&v=1&theme=bloom`
(`v` is 1-3, `theme` is `bloom` or `slate`). Arrow keys and number keys 1-3 also
switch concepts.

## A second round: /designs/login/1-4

Four later concepts, added because the shipped card was not the only thing the
product could be. They live at `/designs/login/1` through `/4` and are reachable
signed in or out.

| # | Concept | Route | Component | The idea |
|---|---------|-------|-----------|----------|
| 4 | The Index | `/designs/login/1` | `IndexWall` | The household's whole index drifts floor to ceiling in mono behind a band cut edge to edge through it. You can see exactly what you are outside of. |
| 5 | Cookbook Facts | `/designs/login/2` | `FactsPanel` | The nutrition facts panel, stating the book instead of a serving. Hierarchy is rule weight alone; the "% daily value" column becomes each section's share of the index. |
| 6 | Low Flame | `/designs/login/3` | `LowFlame` | A gas ring drawn in CSS, burning low in a dark kitchen. The sign-in button is the ignition: hover, focus and submitting raise the flame. |
| 7 | **The Index, Lit (chosen)** | `/designs/login/4` | `LoginScreen` | Concept 4 with the house lights on: the design system's drifting mesh under the page at a third of its default, and a glass band that saturates what passes behind it, so the bloom gathers in the cut. |

Concepts 1-3 are all paper artefacts - a ticket, a recipe card, a pinned card.
Concepts 4-6 deliberately leave that family: one typographic, one structural,
one atmospheric. Concept 7 is a variant of 4 rather than a fifth direction: the
composition is identical on purpose, so the two can be compared on the light
alone.

**Concept 7 was chosen and is now the sign-in screen**, so slot 4 renders the
real `LoginScreen` rather than a copy of it. Its copy diverged from concept 4's
on promotion: the study's eyebrow counts the listing behind it, which a real
pre-authentication screen cannot honestly do (see `login/index-content.ts`), so
the shipped screen reads "Household access" instead.

### Where that code lives

All under `packages/web/src/designs/`:

- `LoginDesigns.tsx` - the path match, the concept list and the study chrome
  (concept switcher and theme toggle, parked at low opacity so it never reads
  as page content).
- `IndexWall.tsx`, `FactsPanel.tsx`, `LowFlame.tsx` and one CSS file each.
  Concept 7 has no file here: slot 4 renders `login/LoginScreen.tsx`.
- Concepts 4 and 7 share `login/IndexColumns.tsx` and `login/index-content.ts`,
  which moved into `login/` when concept 7 shipped.

`FactsPanel`'s figures are invented. They are internally consistent and read as
real household numbers, which is the point of the panel - but if that concept is
ever promoted, they are the piece that needs real data behind them.

`App` resolves `/designs/login/*` before the auth branches, the way it already
does for `?login-gallery`, so a concept can be opened in the state it is
designed for. The module is lazy: its CSS and the two extra type families it
sets (Archivo Narrow, requested at runtime rather than from `index.html`) never
reach the bundle the rest of the app loads. IBM Plex Mono was study-only too
until concept 7 shipped; it now sits in `index.html` with the other faces.

Each concept drives the real `useSignInFlow`, so its button actually starts the
hand-off to Pior Labs Auth - a login concept that cannot be pressed cannot be
judged. Nothing here is wired into the sign-in gate; `LoginScreen` is still what
an unauthenticated visitor gets.

## Beyond the login screen

The chosen concept sets the language for the authenticated app, applied as
*ambient shell, solid content*:

- the drifting mesh is rendered once for every authenticated screen (`App`) at
  `--blob-opacity: 0.35`, and the sign-in screen runs it lower still at 0.26 -
  both well under the design system's 0.8 default, because on either side of the
  door it is atmosphere rather than colour under the words;
- the application topbar is glass over it, the same material as the sign-in
  card;
- page content sits on its own wash and every card, panel, and field stays
  opaque - a recipe is read while cooking, and text over moving colour is not;
- the theme picker appears both on the sign-in screen and in the topbar.

The recipe-card cues the authenticated app inherited from concept 2 - the
divider tab, the margin rule - are not repeated on recipe screens, and the
drifting index is the sign-in screen's alone.

## Shared foundations

These apply to every concept, so the individual documents do not repeat them.

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

Five families, loaded in `packages/web/index.html`:

- **Fraunces** - serif display, used for headlines.
- **Outfit** - sans, used for body and buttons.
- **IBM Plex Mono** - mono, used for the sign-in screen's index listing,
  eyebrows and notes.
- **Caveat** - handwritten display, used for recipe scraps.
- **Kalam** - handwritten body, used for scrap notes.

Round one's concepts use the system mono stack for eyebrows, serials and meta
rows; the design study adds Archivo Narrow at runtime for concept 5 only.

### Sign-in

Every concept shows one button, "Continue with Pior Labs", wired through
`useSignInFlow` to `startSignIn`. There is no email/password or alternate
provider by design - the central SSO handles the actual login. Errors surface
inline above the button via `AuthError`.

### Quality floor

All of them are responsive to mobile, keep visible keyboard focus, and respect
`prefers-reduced-motion` (entrance and ambient animation are disabled).
