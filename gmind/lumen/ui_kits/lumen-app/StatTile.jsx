function StatTile({ label, value, delta, deltaDir = "up", trend, accent }) {
  const positive = deltaDir === "up";
  return (
    <div className={accent ? "lds-stat-accent" : ""} style={{
      flex: 1, padding: 18, borderRadius: 14,
      background: accent ? "linear-gradient(135deg, #3B5BD9 0%, #6B5BC9 50%, #C04A8C 100%)" : "var(--color-bg-elevated)",
      color: accent ? "#fff" : "var(--color-fg)",
      border: accent ? "0" : "1px solid var(--color-border)",
      boxShadow: accent ? "0 8px 24px rgba(60,80,200,0.30)" : "var(--shadow-sm)",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ font: "500 12px 'Inter'", color: accent ? "rgba(255,255,255,0.85)" : "var(--color-fg-muted)" }}>{label}</div>
      <div style={{ font: "600 26px/1.1 'Inter'", letterSpacing: "-0.02em", fontFeatureSettings: '"tnum"' }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, font: "600 12px 'Inter'", color: accent ? "rgba(255,255,255,0.95)" : (positive ? "var(--color-success-500)" : "var(--color-danger-500)") }}>
        <i data-lucide={positive ? "arrow-up-right" : "arrow-down-right"} style={{ width: 12, height: 12 }} />
        {delta}
      </div>
      {trend && (
        <svg viewBox="0 0 100 24" preserveAspectRatio="none" style={{ width: "100%", height: 24, marginTop: 2 }}>
          <path d={trend} stroke={accent ? "rgba(255,255,255,0.9)" : "var(--color-primary)"} strokeWidth="1.5" fill="none" />
        </svg>
      )}
    </div>
  );
}
window.StatTile = StatTile;
