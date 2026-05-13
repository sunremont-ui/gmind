# Lumen Design System

Lumen is an Apple- and Google-inspired design system. It blends Apple's precision (clean grids, soft glass surfaces, restrained color, SF-style typography) with Google Material's expressive type scale and tactile, gradient-forward accents. The system ships with **light and dark themes**, a layered **gradient language**, and a complete component set including **audio/video players, tree views, and analytics dashboards**.

> Source brief: requested by the user — "design system in the style of Apple and Google, must use gradients and a dark-theme variant, work through audio/video player and tree structure design, all kinds of UI components so the next steps can make more precise changes, plus dashboards and charts for analytics." No external Figma or codebase was attached; this system was built from scratch to match the brief, and all decisions below should be considered an opening proposal — iterate freely.

---

## Index

| File / folder | What it is |
|---|---|
| `README.md` | This file — vibe, content rules, visual foundations, iconography. |
| `colors_and_type.css` | All design tokens (color, type, spacing, radius, shadow) for light + dark. |
| `fonts/` | Webfonts (Inter, JetBrains Mono — see *Type substitutions*). |
| `assets/` | Logo marks, brand glyphs, sample imagery. |
| `preview/` | Specimen cards rendered into the Design System tab. |
| `ui_kits/lumen-app/` | Reference UI kit — dashboard app with sidebar, charts, players, tree. |
| `SKILL.md` | Cross-compatible Agent Skill manifest. |

---

## Content fundamentals

**Voice.** Calm, confident, useful. Apple's restraint ("It just works.") meets Google's plain-spokenness ("Get more done."). No hype, no exclamation points, no jokes that depend on tone-of-voice to land. We trust the user to be smart.

**Person.** Second person ("you"), present tense, active voice. The product is named when it acts ("Lumen syncs across your devices"); otherwise we say "you" not "we" or "users."

**Casing.**
- **Sentence case** for buttons, menu items, headings, dialog titles. *"Save changes"* not *"Save Changes"*.
- **Title Case** is reserved for proper nouns and product names.
- ALL-CAPS is used sparingly — only for tiny eyebrow labels (10–11px, +1.5 tracking).

**Length.** Short. A button is a verb (`Save`, `Continue`, `Add to library`). A heading is a noun phrase or a clear claim (`Your week at a glance`, not `Welcome to your dashboard!`). Body copy answers a question in 1–2 sentences before offering a "Learn more" link.

**Numbers, units, ranges.** Always with a non-breaking space before units (`12 GB`, `48 ms`). Use en-dash for ranges (`Mon–Fri`, `9–11 AM`). Time uses `h` and `m` (`2h 14m`), not "hours and minutes."

**Examples (good ↔ avoid).**
- ✅ "Tap to start. Lumen will pick up where you left off." ↔ ❌ "🎉 Welcome back, superstar! Let's keep crushing it."
- ✅ "Storage almost full. Free up 2.4 GB to keep syncing." ↔ ❌ "Uh oh — looks like we're running out of space!"
- ✅ "Connect a source" ↔ ❌ "Connect Your First Source!"

**Emoji.** Not in product UI. Allowed in support content and changelogs only when they carry information (✅/⚠️/⏸). Never decorative.

**Localization.** Copy is written so it survives ~30% expansion. Avoid puns, idioms, and metaphors that don't translate.

---

## Visual foundations

**Type.** Inter Variable as the system sans (a free near-equivalent to SF Pro Text/Display — see *Type substitutions* below). JetBrains Mono for code, numbers in dense tables, and timestamps in players. The display scale is *expressive* (Material-style 56/48/36 step) but defaults to tight tracking and 1.05–1.1 line-height for headings, 1.5 for body. Numerals use `font-variant-numeric: tabular-nums` everywhere data lines up.

**Color.** A neutral scale that runs true-gray (no warm or cool cast) gives the surface a calm, Apple-like feel. The accent is **Lumen Indigo** (`#5B6CFF`) which pairs with **Aurora** (gradient: indigo → violet → coral) and **Tide** (gradient: cyan → teal). Semantic colors (success/warning/danger/info) are saturated but not neon. Dark theme uses a near-black surface (`#0A0A0F`) layered with elevated tonal surfaces (Material 3 elevation logic) rather than translucent whites.

**Gradients.** Gradients are central. Three roles:
1. **Aurora** — hero/marquee surfaces, primary CTAs at large size, brand moments. `linear-gradient(135deg, #5B6CFF 0%, #8B5CF6 50%, #EC4899 100%)`.
2. **Tide** — secondary brand surface, charts, "media" contexts. `linear-gradient(135deg, #06B6D4 0%, #0EA5E9 100%)`.
3. **Mesh** — soft ambient backgrounds for empty states / dashboards. Multi-radial blurs at low opacity over the base surface.
   Gradients never appear on small UI (≤32px) — they read as muddy. Buttons under 40px tall use solid `--color-primary`.

**Spacing.** 4-pt base, geometric scale (4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 64). Layouts breathe; default container padding is 24, dialog padding is 32, dashboard tile padding is 20.

**Backgrounds.** Light mode is `#F7F7F8` (a hair off-white) so cards (`#FFFFFF`) lift cleanly. Dark mode is `#0A0A0F` with elevated cards at `#15151B`. Full-bleed photography is used in marketing surfaces only — warm, slightly desaturated, gentle film-grain feel; never stock-photo glossy.

**Animation.** All transitions use a custom Apple-ish ease, `cubic-bezier(0.32, 0.72, 0, 1)`, at 200ms (state changes) or 320ms (layout/page changes). No bounces on UI affordances. Material-style "tonal surface ripple" is replaced with a Lumen-specific *soft scale*: pressed elements scale to `0.98` and slightly darken the surface.

**Hover.** On interactive surfaces, a 6% black overlay (light mode) / 6% white overlay (dark mode) is added on hover; opacity, never color shifts. Links underline on hover, not color-shift.

**Press.** `transform: scale(0.98)` + the hover overlay deepens to 10%. Duration 120ms in, 240ms out.

**Borders.** 1px solid neutrals everywhere; for dividers, use `--border-subtle` (≈ `rgba(0,0,0,0.06)` light / `rgba(255,255,255,0.08)` dark). Cards on the surface use a 1px hairline plus a soft shadow — never one or the other alone.

**Shadows.** A 5-step elevation system (`xs/sm/md/lg/xl`), all using two layers (a tight ambient shadow + a longer soft shadow) — Apple-style, no big diffuse drop shadows. Inner shadow is reserved for pressed inputs and inset wells.

**Radii.** 4 (chips), 8 (inputs/menus), 12 (cards), 16 (large cards / sheets), 20 (modals), 28 (full sheets). Avoid full-pill radii outside of badges/chips.

**Capsules vs. protection gradients.** Floating elements over imagery use a *protection gradient* (subtle dark vignette at top/bottom) rather than a solid capsule background — Apple-like. Dropped pills and badges use solid surfaces with hairline borders, not gradients.

**Transparency & blur.** Used intentionally: navigation bars over scroll content (`backdrop-filter: blur(18px) saturate(180%)`), modal scrims, "frosted" dropdowns. Never used for static content — content surfaces are opaque so they read crisply on any background.

**Imagery vibe.** Warm, a touch desaturated, fine grain, cinematic crop. Cool blues and indigos when the context is technical (code, analytics); warm earth tones when the context is human (profiles, library covers).

**Cards.** Opaque surface + 1px hairline + `--shadow-sm` + 12px radius. Hover lifts to `--shadow-md` and the border tints toward the primary by ~8%. No left-border-only-accent cards.

**Layout rules.** A 12-column grid at 1280 design width with 24px gutters and 80px outer margins. Persistent sidebar is 256px (240 collapsed). Top app bar is 56px. Status / context bar is 32px. Mobile uses a single column with 16px outer margin.

---

## Iconography

Lumen uses **Lucide** as its icon set — clean, geometric, consistent 1.5px stroke, free, and CDN-available. We use it via `lucide@latest` from unpkg. Icons are rendered at 20px in body context, 24px in toolbars, and 16px in dense tables; stroke remains 1.5px regardless of size (we do *not* scale stroke with size — Lucide's defaults are the design intent). Icon color inherits from `currentColor` so they always pick up the surrounding text color.

> **Substitution flag.** The brief did not include a custom icon set. Lucide is used as the closest CDN match to the Apple-system / Material-symbols-rounded sensibility (1.5px stroke, geometric, friendly). If you want a native set later, drop it into `assets/icons/` and update this section.

We do **not** use emoji as UI icons. We do not use unicode chars (✓, ✗, ★) in place of icons; instead use the Lucide equivalents (`check`, `x`, `star`). We do not draw inline SVGs ad-hoc — if an icon is missing from Lucide, request it as a real SVG asset and place it in `assets/icons/`.

The brand mark itself is a custom SVG, stored in `assets/lumen-logo.svg` (mark) and `assets/lumen-wordmark.svg` (mark + wordmark).

---

## Type substitutions

- **Inter Variable** is used in place of SF Pro Text / SF Pro Display. Inter's metrics, x-height, and rhythm are the closest open-source match. If the project later acquires a license for SF Pro or Roboto Flex, swap in `colors_and_type.css` (`--font-sans`).
- **JetBrains Mono** is used in place of SF Mono / Roboto Mono. Same reasoning — it's the closest match available under an open license.

> **Action for the user:** if you'd like to swap to licensed fonts, drop the `.woff2` files into `fonts/` and update `--font-sans` / `--font-mono` in `colors_and_type.css`.
