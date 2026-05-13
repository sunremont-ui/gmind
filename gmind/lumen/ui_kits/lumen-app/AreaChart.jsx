function AreaChart() {
  return (
    <div style={{
      background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)",
      borderRadius: 14, padding: 20, boxShadow: "var(--shadow-sm)",
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="lds-eyebrow">Streaming hours · last 7 days</div>
          <div style={{ font: "600 26px/1.1 'Inter'", letterSpacing: "-0.02em", fontFeatureSettings: '"tnum"', marginTop: 4 }}>412 805 h</div>
        </div>
        <div style={{ display: "inline-flex", background: "var(--color-surface-3)", padding: 3, borderRadius: 8 }}>
          {["7d","30d","All"].map((t,i) => (
            <div key={t} style={{ padding: "4px 10px", borderRadius: 6, font: "600 12px 'Inter'", background: i === 0 ? "var(--color-bg-elevated)" : "transparent", color: i === 0 ? "var(--color-fg)" : "var(--color-fg-muted)", boxShadow: i === 0 ? "var(--shadow-xs)" : "none" }}>{t}</div>
          ))}
        </div>
      </div>
      <svg viewBox="0 0 700 220" preserveAspectRatio="none" style={{ width: "100%", height: 220 }}>
        <defs>
          <linearGradient id="kitAreaA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5B6CFF" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#5B6CFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="kitAreaB" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EC4899" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#EC4899" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="50" x2="700" y2="50" stroke="var(--color-border)" />
        <line x1="0" y1="110" x2="700" y2="110" stroke="var(--color-border)" />
        <line x1="0" y1="170" x2="700" y2="170" stroke="var(--color-border)" />
        <path d="M0 150 L100 130 L200 145 L300 110 L400 125 L500 90 L600 100 L700 80 L700 220 L0 220 Z" fill="url(#kitAreaB)" />
        <path d="M0 150 L100 130 L200 145 L300 110 L400 125 L500 90 L600 100 L700 80" stroke="#EC4899" strokeWidth="2" fill="none" />
        <path d="M0 170 L100 130 L200 140 L300 80 L400 95 L500 60 L600 75 L700 40 L700 220 L0 220 Z" fill="url(#kitAreaA)" />
        <path d="M0 170 L100 130 L200 140 L300 80 L400 95 L500 60 L600 75 L700 40" stroke="#5B6CFF" strokeWidth="2.5" fill="none" />
        <circle cx="500" cy="60" r="6" fill="var(--color-bg-elevated)" stroke="#5B6CFF" strokeWidth="2.5" />
      </svg>
    </div>
  );
}
window.AreaChart = AreaChart;
