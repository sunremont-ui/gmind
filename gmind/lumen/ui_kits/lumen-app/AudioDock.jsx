function AudioDock({ playing, setPlaying }) {
  return (
    <div style={{
      position: "sticky", bottom: 16, marginTop: 16,
      background: "color-mix(in oklab, var(--color-bg-elevated) 92%, transparent)",
      backdropFilter: "blur(18px) saturate(180%)",
      border: "1px solid var(--color-border)",
      borderRadius: 14, padding: "10px 14px",
      boxShadow: "var(--shadow-lg)",
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <button onClick={() => setPlaying(!playing)} style={{
        width: 40, height: 40, borderRadius: 999,
        background: "var(--color-fg)", color: "var(--color-bg)", border: 0, cursor: "pointer",
        display: "grid", placeItems: "center",
      }}>
        <i data-lucide={playing ? "pause" : "play"} style={{ width: 16, height: 16, fill: "currentColor" }} />
      </button>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: "linear-gradient(135deg,#5B6CFF,#EC4899)" }} />
      <div style={{ minWidth: 0, flex: "0 1 200px" }}>
        <div style={{ font: "600 14px 'Inter'", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Aurora — slow take</div>
        <div style={{ font: "400 12px 'Inter'", color: "var(--color-fg-muted)" }}>Marin · Ambient</div>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 11, color: "var(--color-fg-muted)" }}>1:24</span>
        <div style={{ flex: 1, height: 4, borderRadius: 999, background: "var(--color-surface-3)", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: 4, width: "38%", borderRadius: 999, background: "linear-gradient(90deg,#5B6CFF,#EC4899)" }} />
          <div style={{ position: "absolute", left: "38%", top: "50%", width: 12, height: 12, borderRadius: 999, background: "var(--color-bg-elevated)", border: "2px solid var(--color-primary)", transform: "translate(-50%,-50%)" }} />
        </div>
        <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 11, color: "var(--color-fg-subtle)" }}>3:42</span>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <button style={dockIcon}><i data-lucide="shuffle" style={{ width: 16, height: 16 }} /></button>
        <button style={dockIcon}><i data-lucide="repeat" style={{ width: 16, height: 16 }} /></button>
        <button style={dockIcon}><i data-lucide="volume-2" style={{ width: 16, height: 16 }} /></button>
        <button style={dockIcon}><i data-lucide="list-music" style={{ width: 16, height: 16 }} /></button>
      </div>
    </div>
  );
}
const dockIcon = {
  width: 32, height: 32, display: "grid", placeItems: "center",
  background: "transparent", color: "var(--color-fg-muted)",
  border: 0, borderRadius: 8, cursor: "pointer",
};
window.AudioDock = AudioDock;
