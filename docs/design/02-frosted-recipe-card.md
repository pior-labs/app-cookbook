# Concept 2 - Frosted Recipe Card

The household recipe index card, made airy. The tactile recipe-card identity -
divider tab, margin rule, ruled lines - is preserved, but the card is rendered
as frosted glass and floated over the design system's drifting mesh and grain.
It pairs the package's ambient atmosphere with a familiar, homely object.

See [shared foundations](README.md#shared-foundations) for themes, tokens,
typography, and the sign-in flow common to all three concepts.

## At a glance

- **Archetype:** centered card over a full-bleed ambient backdrop.
- **Type system:** Fraunces display + Outfit body, monospace for the tab and
  eyebrow.
- **Signature:** a ruled recipe card rendered in glass - tab and margin rule
  included - over a living mesh.
- **Mood:** calm, soft, contemporary.

## Layout and structure

A frosted card centered over the mesh backdrop.

```
   ~ drifting pastel mesh + grain, full bleed ~

            [ COOKBOOK ]  (tab)
        +---------------------------+
        | (C) Pior Labs             |
        | HOUSEHOLD ACCESS          |
        | Welcome back to           |
        | the *kitchen.*            |
        | Your household cookbook...|
        | [ Continue with Pior Labs]|
        | Private by design...      |
        +---------------------------+
```

- **Backdrop:** `MeshBackdrop` renders the design system's `theme-mesh` (five
  slow-drifting blobs colored from `--accent-1/2/3` and companions) plus
  `theme-grain`, from the package's `effects.css`. It is fully theme-reactive:
  warm pastels in Bloom, cool tones in Slate.
- **Card:** a glass sheet using `--glass-bg`, `--glass-border`, and a
  backdrop blur/saturate, at `--radius`, max width 468px. Its shadow layers the
  package `--glass-shadow` under a soft `9px 11px 0` offset in `--accent-3`.
- **Recipe-card cues, kept on glass:**
  - a "Cookbook" divider tab at the top-left, tinted with a translucent
    `--accent-1` and its own small blur so it belongs to the glass;
  - a red left **margin rule** (a `::before`, in `--destructive`);
  - faint horizontal **ruled lines** (an `::after` repeating gradient at about
    9% of `--foreground`), kept low so the frosted surface still reads.
- **Content:** the `Seal` and "Pior Labs" wordmark, a "Household access" eyebrow
  in `--destructive`, the Fraunces headline with "kitchen." set in primary
  italic, an Outfit body paragraph, the SSO button, and a note.

## Typography

- Headline: **Fraunces**, weight 500; the emphasized word is italic in
  `--primary`.
- Body: **Outfit**.
- Tab and eyebrow: monospace, uppercase.

## Color and tokens

| Element | Token |
|---------|-------|
| Card surface | `--glass-bg` |
| Card border | `--glass-border` |
| Card shadow | `--glass-shadow` + `--accent-3` offset |
| Tab | translucent `--accent-1` |
| Margin rule | `--destructive` |
| Ruled lines | `--foreground` at ~9% |
| Eyebrow | `--destructive` |
| Headline emphasis | `--primary` |
| Button | `--primary` on `--primary-foreground` |

The glass tokens and the mesh both come from the theme, so the frost tint and
the drifting colors change together when the theme flips.

## Motion

Two layers, both reduced-motion aware:

- **Ambient:** the mesh blobs drift continuously (the package's `theme-drift`).
- **Entrance:** the card runs `lv-rise` once.

Under `prefers-reduced-motion`, both are disabled.

## Copy

- Eyebrow: "Household access"
- Headline: "Welcome back to the kitchen."
- Body: "Your household cookbook - every recipe you've saved, the notes that make
  them yours, and whatever you decide to make tonight."
- Button: "Continue with Pior Labs"
- Note: "Private by design. Only approved household accounts can enter."

## Responsive

The card holds its max width and centers on all sizes; the mesh is full-bleed at
every breakpoint. No layout changes are needed.

## Implementation

- Component: `FrostedCardLogin` in `packages/web/src/login/variants.tsx`.
- Backdrop: `MeshBackdrop` in `packages/web/src/login/parts.tsx`.
- Styles: the `.v-fcard*` block plus the shared `.v-card__*` recipe-card blocks
  in `packages/web/src/login/login-gallery.css`. The glass and mesh classes come
  from `@pior-labs/design-system/effects.css`, imported in
  `packages/web/src/index.css`.
- Preview: `/?login-gallery&v=2` (add `&theme=slate` for the cool theme).

## Notes

The shared `.v-card__*` classes (tab, head, title, body) are also used by
concept 3. Changing them affects both concepts.
