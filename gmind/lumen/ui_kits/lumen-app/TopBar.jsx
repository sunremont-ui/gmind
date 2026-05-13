function TopBar({ theme, setTheme }) {
  return (
    <header style={{
      height: 56, flexShrink: 0,
      display: "flex", alignItems: "center", gap: 12,
      padding: "0 24px",
      borderBottom: "1px solid var(--color-border)",
      background: "color-mix(in oklab, var(--color-bg-elevated) 80%, transparent)",
      backdropFilter: "blur(18px) saturate(180%)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, font: "500 13px 'Inter'", color: "var(--color-fg-muted)" }}>
        <span>Workspace</span>
        <i data-lucide="chevron-right" style={{ width: 14, height: 14 }} />
        <span style={{ color: "var(--color-fg)", fontWeight: 600 }}>Overview</span>
      </div>
      <div style={{ flex: 1, maxWidth: 480, marginLeft: "auto", marginRight: "auto", position: "relative" }}>
        <i data-lucide="search" style={{ width: 16, height: 16, color: "var(--color-fg-subtle)", position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
        <input placeholder="Search tracks, sessions, people…" style={{
          width: "100%", height: 36,
          background: "var(--color-surface-3)",
          border: "1px solid var(--color-border)", borderRadius: 10,
          padding: "0 12px 0 36px", font: "400 14px 'Inter'", color: "var(--color-fg)", outline: "none",
        }} />
        <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", padding: "2px 6px", border: "1px solid var(--color-border)", borderRadius: 5, font: "500 11px 'JetBrains Mono'", color: "var(--color-fg-subtle)" }}>⌘K</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} style={iconBtn} aria-label="Toggle theme">
          <i data-lucide={theme === "dark" ? "sun" : "moon"} style={{ width: 18, height: 18 }} />
        </button>
        <button style={iconBtn} aria-label="Notifications">
          <i data-lucide="bell" style={{ width: 18, height: 18 }} />
          <span style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 999, background: "#EC4899", border: "2px solid var(--color-bg-elevated)" }} />
        </button>
        <button style={{ ...iconBtn, position: "relative", padding: 0, border: 0, width: 36, height: 36, borderRadius: 999, background: "linear-gradient(135deg,#5B6CFF,#EC4899)", color: "#fff", font: "600 12px 'Inter'" }}>AR</button>
      </div>
    </header>
  );
}
const iconBtn = {
  position: "relative",
  width: 36, height: 36, display: "grid", placeItems: "center",
  background: "transparent", color: "var(--color-fg)",
  border: "1px solid var(--color-border)", borderRadius: 10,
  cursor: "pointer",
};
window.TopBar = TopBar;
