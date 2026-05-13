function VideoTile() {
  return (
    <div style={{
      borderRadius: 14, overflow: "hidden", position: "relative", height: 220,
      background: `radial-gradient(at 30% 30%, rgba(91,108,255,0.55) 0px, transparent 55%), radial-gradient(at 70% 70%, rgba(236,72,153,0.45) 0px, transparent 55%), #15151B`,
      border: "1px solid var(--color-border)", boxShadow: "var(--shadow-sm)",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: 14, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(180deg,rgba(0,0,0,0.55),transparent)" }}>
        <div>
          <div style={{ font: "600 15px 'Inter'", letterSpacing: "-0.01em" }}>Northern lights, ep 02</div>
          <div style={{ font: "400 11px 'Inter'", opacity: 0.7 }}>Lumen Originals · 4K</div>
        </div>
        <span style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.18)", font: "600 11px 'Inter'", letterSpacing: "0.04em" }}>4K</span>
      </div>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        <button style={{ width: 60, height: 60, borderRadius: 999, background: "rgba(255,255,255,0.18)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.30)", cursor: "pointer", color: "#fff", display: "grid", placeItems: "center" }}>
          <i data-lucide="play" style={{ width: 22, height: 22, fill: "currentColor" }} />
        </button>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 14, color: "#fff", background: "linear-gradient(0deg,rgba(0,0,0,0.65),transparent)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 3, borderRadius: 999, background: "rgba(255,255,255,0.20)", position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: 0, height: 3, width: "42%", borderRadius: 999, background: "#fff" }} />
          </div>
          <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 11, opacity: 0.85 }}>12:14 / 28:50</span>
        </div>
      </div>
    </div>
  );
}
window.VideoTile = VideoTile;
