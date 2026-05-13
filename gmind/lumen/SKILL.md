---
name: lumen-design
description: Use this skill to generate well-branded interfaces and assets for Lumen, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

Key files:
- `README.md` — voice/tone, visual foundations, iconography, type substitutions.
- `colors_and_type.css` — all design tokens (color, type, spacing, radius, shadow, motion) for light + dark.
- `assets/lumen-logo.svg`, `assets/lumen-wordmark.svg` — brand marks.
- `preview/` — specimen cards covering colors, type, spacing, components, players, charts.
- `ui_kits/lumen-app/` — reference dashboard with reusable JSX components (Sidebar, TopBar, HeroBanner, StatTile, AreaChart, TopTracks, FileTree, AudioDock, VideoTile).
