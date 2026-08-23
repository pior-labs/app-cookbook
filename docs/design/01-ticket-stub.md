# Concept 1 - Ticket Stub

An admission pass. The page reads as a single ticket: a brand-story panel on the
left and a sign-in stub on the right, divided by a perforated seam with punched
notches. The framing casts signing in as "your seat at the household table."

See [shared foundations](README.md#shared-foundations) for themes, tokens,
typography, and the sign-in flow common to all three concepts.

## At a glance

- **Archetype:** horizontal two-panel card (split editorial).
- **Type system:** Fraunces display + Outfit body, monospace for labels.
- **Signature:** the perforated seam, punched notch cut-outs, and a serial
  number.
- **Mood:** composed, editorial, a little ceremonial.

## Layout and structure

A single card centered in the viewport, laid out as a three-column grid:
`minmax(0, 1.35fr)` brand panel, a `1px` seam, and a `minmax(280px, 0.85fr)`
stub. Max width 860px. The card is a solid `--card` surface with a 1px
`--border` and a hard offset shadow (`12px 14px 0 var(--primary)`) that reads
terracotta in Bloom and blue in Slate.

```
+----------------------------o----------------------+
|  ADMIT ONE                 :   No. 0417-COOK       |
|                            :                       |
|  A table set for           :   YOUR SEAT           |
|  your household.           :   One tap to your     |
|                            :   recipes.            |
|  Every recipe the house... :   [ Continue with ... ]|
|                            :   Approved household..|
|  COOKBOOK    PIOR LABS     :                       |
+----------------------------o----------------------+
        brand panel        seam         stub
```

- **Brand panel:** a soft diagonal wash mixing `--accent-3` into `--accent-2`
  over the card. Holds the "Admit one" eyebrow, the Fraunces headline, a lede,
  and a monospace meta row ("Cookbook / Pior Labs").
- **Seam:** a vertical dashed rule in `--border-soft`, with two notch circles
  filled with `--background` punched into the top and bottom edges to create the
  torn-ticket bite.
- **Stub:** a monospace serial ("No. 0417-COOK") pinned to the top, a "Your
  seat" eyebrow in `--primary`, a Fraunces subtitle, the SSO button, and a note.

## Typography

- Headline and subtitle: **Fraunces**, weight 500, tight tracking.
- Body and lede: **Outfit**.
- Eyebrows, serial, and meta row: monospace, uppercase, wide tracking.

## Color and tokens

| Element | Token |
|---------|-------|
| Card surface | `--card` |
| Card border | `--border` |
| Offset shadow | `--primary` |
| Brand wash | `--accent-3` mixed into `--accent-2` |
| Seam dashes | `--border-soft` |
| Notch fill | `--background` |
| Stub eyebrow | `--primary` |
| Button | `--primary` on `--primary-foreground` |

Because the offset shadow and stub accents pull from `--primary`, the whole
ticket shifts warm-to-cool with the theme without any per-theme rules.

## Motion

The card runs a single `lv-rise` entrance (fade and rise). Nothing loops.

## Copy

- Eyebrow: "Admit one"
- Headline: "A table set for your household."
- Lede: "Every recipe the house cooks from, kept in one shared book. This pass is
  yours."
- Meta: "Cookbook" / "Pior Labs"
- Serial: "No. 0417-COOK"
- Stub eyebrow: "Your seat"
- Subtitle: "One tap to your recipes."
- Button: "Continue with Pior Labs"
- Note: "Approved household accounts only."

## Responsive

Below 780px the grid collapses to a single column. The seam rotates to a
horizontal dashed rule between the stacked panels, and the notches move to the
left and right edges so the perforation still reads.

## Implementation

- Component: `TicketLogin` in `packages/web/src/login/variants.tsx`.
- Styles: the `.v-ticket*` block in `packages/web/src/login/login-gallery.css`.
- Preview: `/?login-gallery&v=1` (add `&theme=slate` for the cool theme).
