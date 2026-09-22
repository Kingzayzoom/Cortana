# Cortana visual system

The primary reference is the supplied `Cortana visualization.png`. A healthcare professional uses the product for a brief learning pause at a laptop in a bright clinical workspace. The surface is white, with pale blue separation and restrained navy typography. The orb carries the luminous, expressive color.

## Palette

The user's blue clinical palette takes precedence over the design skill's unrelated generated seed.

| Role              | CSS token              |
| ----------------- | ---------------------- |
| White workspace   | `oklch(1 0 0)`         |
| Pale blue surface | `oklch(.964 .018 258)` |
| Navy text         | `oklch(.245 .063 266)` |
| Secondary text    | `oklch(.495 .042 262)` |
| Primary blue      | `oklch(.535 .228 263)` |
| Borders           | `oklch(.925 .021 259)` |

The orb uses the user's `#7896d6`, `#ff14b9`, `#af38ff` inspiration with cyan ribbons and soft white reflections. The surface remains spherical; state changes do not imply emotion or diagnosis.

## Typography and structure

Locally bundled Inter, weights 400–700. A two-line 47px hero on desktop, 38px on phones; navy first line and solid blue “conversation.” One intentionally tracked action-sequence eyebrow. Normal labels use sentence case and readable secondary text. Headlines keep letter spacing at or above −0.04em.

232px desktop sidebar, 326px right rail, main content with controlled 35px inset. Card radii around 18px follow the user's reference. Most surfaces use a thin border without broad shadows. Only the orb and the primary start action have noticeable atmospheric light. Conversation controls remain above the initial fold at tested laptop and phone sizes.

Below 960px, the round panel moves under the hero. Below 700px, the sidebar becomes a keyboard-accessible drawer with focus trapping and inert background. Phones use one content column without shrinking the desktop layout wholesale.

## Interaction

Radix dialogs provide evidence and consent focus management. All navigation has working routes. Control states come from actual lesson/SDK events. The active-session provider lives in the root layout. Preview is labeled and silent; no fake waveform or random speech energy is present.

Reduced motion freezes the orb and minimizes transitions. Visible status text carries state without relying on color alone. Every button has focus, hover and disabled treatment. Automated accessibility scans of the six main views are part of verification.
