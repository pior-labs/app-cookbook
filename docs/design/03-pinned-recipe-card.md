# Concept 3 - Pinned Recipe Card

The recipe card pinned to a kitchen corkboard, surrounded by handwritten recipe
scraps. It is the warmest, most personal of the three: the same recipe card as
concept 2, but grounded in a tactile, lived-in board instead of floating glass.

See [shared foundations](README.md#shared-foundations) for themes, tokens,
typography, and the sign-in flow common to all three concepts.

## At a glance

- **Archetype:** collage on a board, with a pinned card at center.
- **Type system:** Fraunces + Outfit on the card; Caveat + Kalam on the scraps.
- **Signature:** a corkboard of pinned handwritten scraps around a pinned recipe
  card.
- **Mood:** homely, hand-made, personal.

## Layout and structure

A dotted board fills the page; the recipe card is pinned at the center with a few
handwritten scraps tucked around it.

```
  . . . . . . . . . . . . . . . . . . . . . . . .
  . [lemon pasta] .    (pin)      . [sunday soup] .
  .  scrap (accent-2)  +--------+   scrap (accent-1)
  . . . . . . . . . . .| COOKBOOK|. . . . . . . . .
  .                    | recipe  | .              .
  .                    | card    | .              .
  .  [buy: basil..]    +--------+  .              .
  .  scrap (accent-3) . . . . . . . . . . . . . . .
```

- **Board:** the `--muted` surface with a dotted grid (a radial-gradient of
  `--foreground` at ~12%, on a 22px cell). The board container centers its
  contents.
- **Scraps:** three rotated sticky notes filled with `--accent-2`, `--accent-1`,
  and `--accent-3`, each with a small themed pin (a `--primary` radial dot) and
  a soft offset shadow. Titles are set in **Caveat**, bodies in **Kalam**. They
  are decorative (`aria-hidden`) and hidden on small screens.
- **Main card:** the shared solid recipe card (`.v-card__sheet`) - the same
  "Cookbook" tab, red margin rule, ruled lines, and Fraunces headline as concept
  2, but on an opaque `--card` surface with an `--accent-3` offset shadow. It is
  lifted above the scraps (`z-index: 3`) and held to the board by a pin at
  top-center.
- **Content:** the `Seal` and "Pior Labs" wordmark, a "Household access" eyebrow
  in `--destructive`, the Fraunces headline with "kitchen." in primary italic,
  an Outfit body paragraph, the SSO button, and a note.

## Typography

- Card headline: **Fraunces**, weight 500; emphasized word italic in `--primary`.
- Card body and button: **Outfit**.
- Scrap titles: **Caveat**; scrap bodies: **Kalam**.
- Tab and eyebrow: monospace, uppercase.

## Color and tokens

| Element | Token |
|---------|-------|
| Board surface | `--muted` |
| Board dots | `--foreground` at ~12% |
| Scrap fills | `--accent-1`, `--accent-2`, `--accent-3` |
| Pins | `--primary` |
| Card surface | `--card` |
| Card border | `--border` |
| Card shadow | `--accent-3` offset |
| Margin rule | `--destructive` |
| Eyebrow | `--destructive` |
| Headline emphasis | `--primary` |
| Button | `--primary` on `--primary-foreground` |

The accent-filled scraps and primary pins all come from the theme, so the board
warms up in Bloom and cools down in Slate along with the card.

## Motion

The card runs a single `lv-rise` entrance. The scraps are static. Nothing loops.

## Copy

Card copy matches concept 2:

- Eyebrow: "Household access"
- Headline: "Welcome back to the kitchen."
- Body: "Your household cookbook - every recipe you've saved, the notes that make
  them yours, and whatever you decide to make tonight."
- Button: "Continue with Pior Labs"
- Note: "Private by design. Only approved household accounts can enter."

Scrap copy (decorative):

- "lemon pasta" / "zest + garlic, off the heat"
- "sunday soup" / "double it, freeze half"
- "buy: basil, lemons, good bread"

## Responsive

Below 780px the scraps are hidden and the recipe card centers on the board on its
own, so the sign-in stays uncluttered on small screens.

## Implementation

- Component: `PinboardCardLogin` in `packages/web/src/login/variants.tsx`.
- Styles: the `.v-pcard` block, the `.v-notes__board` / `.v-notes__scrap*` /
  `.v-notes__pin*` board blocks, and the shared `.v-card__*` recipe-card blocks
  in `packages/web/src/login/login-gallery.css`.
- Preview: `/?login-gallery&v=3` (add `&theme=slate` for the cool theme).

## Notes

The shared `.v-card__*` classes (tab, head, title, body) are also used by
concept 2. Changing them affects both concepts.
