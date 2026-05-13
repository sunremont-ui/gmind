function Sidebar({ active = "Overview", collapsed = false }) {
  const sections = [
    { label: "Workspace", items: [
      { id: "Overview", icon: "layout-dashboard" },
      { id: "Library",   icon: "library" },
      { id: "Sessions",  icon: "audio-waveform" },
      { id: "Releases",  icon: "rocket" },
    ]},
    { label: "Insights", items: [
      { id: "Analytics", icon: "trending-up" },
      { id: "Listeners", icon: "users" },
      { id: "Revenue",   icon: "wallet" },
    ]},
    { label: "Settings", items: [
      { id: "Team",      icon: "user-round" },
      { id: "Billing",   icon: "credit-card" },
      { id: "Settings",  icon: "settings" },
    ]},
  ];
  return (
    <aside style={{
      width: collapsed ? 72 : 256, flexShrink: 0,
      background: "var(--color-bg-elevated)",
      borderRight: "1px solid var(--color-border)",
      display: "flex", flexDirection: "column",
      padding: "16px 12px", gap: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 6px" }}>
        <img src="../../assets/lumen-logo.svg" width={28} height={28} alt="" />
        {!collapsed && <span style={{ font: "700 16px/1 'Inter'", letterSpacing: "-0.01em" }}>Lumen</span>}
      </div>
      <button style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "var(--color-surface-3)", color: "var(--color-fg)",
        border: "1px solid var(--color-border)", borderRadius: 10,
        padding: "8px 10px", font: "500 13px 'Inter'", cursor: "pointer", justifyContent: "space-between",
      }}>
        <span style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--gradient-aurora)" }} />
          {!collapsed && "Studio · prod"}
        </span>
        {!collapsed && <i data-lucide="chevrons-up-down" style={{ width: 14, height: 14, color: "var(--color-fg-muted)" }} />}
      </button>

      {sections.map(s => (
        <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {!collapsed && <div className="lds-eyebrow" style={{ padding: "6px 10px 4px" }}>{s.label}</div>}
          {s.items.map(it => (
            <a key={it.id} className={`nav-item ${active === it.id ? "nav-active" : ""}`} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px", borderRadius: 8,
              font: "500 14px 'Inter'", color: "var(--color-fg)",
              background: active === it.id ? "var(--color-primary-soft)" : "transparent",
              cursor: "pointer", textDecoration: "none",
            }}>
              <i data-lucide={it.icon} style={{ width: 18, height: 18, color: active === it.id ? "var(--color-primary)" : "var(--color-fg-muted)" }} />
              {!collapsed && <span style={{ color: active === it.id ? "var(--color-primary)" : "var(--color-fg)", fontWeight: active === it.id ? 600 : 500 }}>{it.id}</span>}
            </a>
          ))}
        </div>
      ))}

      <div style={{ flex: 1 }} />

      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: 10, borderRadius: 10,
        background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
      }}>
        <div style={{ width: 32, height: 32, borderRadius: 999, background: "linear-gradient(135deg,#5B6CFF,#EC4899)", color: "#fff", display: "grid", placeItems: "center", font: "600 12px 'Inter'" }}>AR</div>
        {!collapsed && <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "600 13px 'Inter'", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Aria Reyes</div>
          <div style={{ font: "400 11px 'Inter'", color: "var(--color-fg-muted)" }}>Owner · Pro</div>
        </div>}
        {!collapsed && <i data-lucide="ellipsis-vertical" style={{ width: 16, height: 16, color: "var(--color-fg-muted)" }} />}
      </div>
    </aside>
  );
}
window.Sidebar = Sidebar;
