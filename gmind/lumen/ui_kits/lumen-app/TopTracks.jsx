function TopTracks() {
  const rows = [
    { rank: "01", title: "Aurora — slow take", artist: "Marin",        plays: "128 412", delta: "+12.4%", up: true,  grad: "linear-gradient(135deg,#5B6CFF,#EC4899)", path: "M0 14 L12 10 L24 12 L36 6 L48 8 L60 4 L72 6 L80 2", color: "#5B6CFF" },
    { rank: "02", title: "Late drift, vol. III", artist: "Hollow Frame",plays: "96 002",  delta: "+4.1%",  up: true,  grad: "linear-gradient(135deg,#06B6D4,#0EA5E9)", path: "M0 12 L12 8 L24 14 L36 10 L48 11 L60 8 L72 9 L80 5",  color: "#06B6D4" },
    { rank: "03", title: "Polaris",              artist: "Vela",        plays: "71 488",  delta: "−1.8%",  up: false, grad: "linear-gradient(135deg,#F59E0B,#EC4899)", path: "M0 6 L12 8 L24 7 L36 12 L48 9 L60 13 L72 11 L80 14", color: "#EC4899" },
    { rank: "04", title: "Northern lights",      artist: "Ostraal",     plays: "58 220",  delta: "+8.6%",  up: true,  grad: "linear-gradient(135deg,#10B981,#06B6D4)", path: "M0 10 L12 12 L24 8 L36 9 L48 6 L60 7 L72 4 L80 3",   color: "#10B981" },
  ];
  return (
    <div style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: 14, padding: 20, boxShadow: "var(--shadow-sm)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div className="lds-eyebrow">Top tracks</div>
        <a style={{ font: "600 13px 'Inter'", color: "var(--color-primary)", textDecoration: "none", cursor: "pointer" }}>View all ›</a>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", font: "400 13px 'Inter'", color: "var(--color-fg)" }}>
        <thead>
          <tr style={{ textAlign: "left" }}>
            {["#","Track","Plays","Δ","Trend"].map((h,i) => (
              <th key={h} style={{ padding: "8px 6px", borderBottom: "1px solid var(--color-border)", color: "var(--color-fg-muted)", font: "600 11px 'Inter'", letterSpacing: "0.06em", textTransform: "uppercase", textAlign: i === 2 || i === 3 ? "right" : "left" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.rank}>
              <td style={{ padding: "12px 6px", color: "var(--color-fg-subtle)", fontFamily: "'JetBrains Mono'" }}>{r.rank}</td>
              <td style={{ padding: "12px 6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 7, background: r.grad }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.title}</div>
                    <div style={{ color: "var(--color-fg-muted)", fontSize: 12 }}>{r.artist}</div>
                  </div>
                </div>
              </td>
              <td style={{ padding: "12px 6px", textAlign: "right", fontFamily: "'JetBrains Mono'", fontFeatureSettings: '"tnum"' }}>{r.plays}</td>
              <td style={{ padding: "12px 6px", textAlign: "right", color: r.up ? "var(--color-success-500)" : "var(--color-danger-500)", fontWeight: 600 }}>{r.delta}</td>
              <td style={{ padding: "12px 6px" }}>
                <svg viewBox="0 0 80 18" preserveAspectRatio="none" style={{ width: 80, height: 18 }}>
                  <path d={r.path} stroke={r.color} strokeWidth="1.5" fill="none" />
                </svg>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
window.TopTracks = TopTracks;
