# Lumen App — UI kit

A reference dashboard implementation that ties the design tokens together: sidebar navigation, top bar, gradient hero, KPI tiles, area chart, top-tracks table, audio player dock, file tree, and a video tile. Light + dark themes via the toggle in the top bar.

## Files
- `index.html` — main entry; assembles the full app shell.
- `Sidebar.jsx` — nav with workspace switcher, primary/secondary sections, footer profile.
- `TopBar.jsx` — search, theme toggle, notifications, avatar.
- `HeroBanner.jsx` — Aurora-gradient marquee with CTA.
- `StatTile.jsx` — KPI tile (number + delta + sparkline).
- `AreaChart.jsx` — two-series gradient area chart.
- `TopTracks.jsx` — data table with sparklines.
- `FileTree.jsx` — collapsible tree.
- `AudioDock.jsx` — pinned audio player at the bottom.
- `VideoTile.jsx` — featured video card with overlay chrome.

## Approach
Components are intentionally simple — no real state management, no real data. They consume design tokens from `../../colors_and_type.css` and lean on Lucide icons via CDN. The point is to show how the system reads when the parts are composed.

> No external Figma or codebase was provided; the screens were designed against the brief. Treat as an opening proposal — iterate via Tweaks or by editing the JSX directly.
