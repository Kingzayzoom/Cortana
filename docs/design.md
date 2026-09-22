# Visual design

A bright clinical workspace: white surfaces, pale blue separation, navy type. The orb carries all of the colour. Tokens are defined in `src/app/styles/base.css`.

## Palette

| Role              | Token            | Value                  |
| ----------------- | ---------------- | ---------------------- |
| Workspace         | `--background`   | `oklch(1 0 0)`         |
| Pale blue surface | `--surface-blue` | `oklch(.964 .018 258)` |
| Navy text         | `--ink`          | `oklch(.245 .063 266)` |
| Secondary text    | `--muted`        | `oklch(.495 .042 262)` |
| Primary blue      | `--blue`         | `oklch(.535 .228 263)` |
| Borders           | `--line`         | `oklch(.925 .021 259)` |

The orb mixes `#7896d6`, `#ff14b9` and `#af38ff` with cyan ribbons. Its states reflect connection and audio level only; it never implies emotion or a clinical judgement.

## Layout

Inter, 400 to 700, bundled locally. A 232 px sidebar, the main column, and a 326 px right rail on wide screens. Below 960 px the round panel moves under the hero; below 700 px the sidebar becomes a drawer with a focus trap and an inert background. Conversation controls stay above the fold at laptop and phone sizes.

## Behaviour

- Status is always stated in text, never by colour alone.
- Every control has focus, hover and disabled states.
- Reduced motion freezes the orb and removes transitions.
- The text preview is labelled as a preview; there is no fake waveform or invented speech activity.
- Dialogs (evidence, consent) use Radix for focus management.

`npm run test:a11y` runs an axe WCAG 2.1 AA scan of every view.
