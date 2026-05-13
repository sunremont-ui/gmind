function HeroBanner() {
  return (
    <section className="lds-keep" style={{
      borderRadius: 16, padding: 28,
      background: "linear-gradient(135deg, #3B5BD9 0%, #6B5BC9 50%, #C04A8C 100%)",
      color: "#fff", position: "relative", overflow: "hidden",
      boxShadow: "0 8px 24px rgba(60,80,200,0.30)",
    }}>
      <div style={{ position: "absolute", inset: 0,
        background: "radial-gradient(at 90% 0%, rgba(255,255,255,0.25) 0px, transparent 40%), radial-gradient(at 0% 100%, rgba(0,0,0,0.18) 0px, transparent 40%)",
        pointerEvents: "none" }} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ flex: 1 }}>
          <div className="lds-eyebrow" style={{ color: "rgba(255,255,255,0.8)" }}>This week</div>
          <div style={{ font: "600 32px/1.1 'Inter'", letterSpacing: "-0.02em", marginTop: 8 }}>Your week, in motion</div>
          <div style={{ font: "400 15px/1.5 'Inter'", marginTop: 6, opacity: 0.92, maxWidth: 460 }}>
            Streaming hours are up 12.4% over last week. Three new tracks are trending with first-time listeners.
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button style={{ background: "#fff", color: "#15151B", border: 0, borderRadius: 10, padding: "0 16px", height: 40, font: "600 14px 'Inter'", cursor: "pointer" }}>Open report</button>
            <button style={{ background: "rgba(255,255,255,0.32)", color: "#fff", border: "1px solid rgba(255,255,255,0.55)", borderRadius: 10, padding: "0 16px", height: 40, font: "600 14px 'Inter'", cursor: "pointer", backdropFilter: "blur(8px)" }}>Share with team</button>
          </div>
        </div>
        <div style={{ width: 220, height: 140, position: "relative" }}>
          <div style={{ position:"absolute", inset:0, background:"rgba(255,255,255,0.28)", border:"1px solid rgba(255,255,255,0.45)", borderRadius:14, backdropFilter:"blur(8px)", padding:14, display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
            <div style={{ font: "500 11px 'Inter'", letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.85 }}>Plays today</div>
            <div style={{ font: "600 32px/1 'Inter'", letterSpacing: "-0.02em", fontFeatureSettings: '"tnum"' }}>128 410</div>
            <svg viewBox="0 0 200 36" preserveAspectRatio="none" style={{ width: "100%", height: 32 }}>
              <path d="M0 28 L25 22 L50 24 L75 14 L100 18 L125 8 L150 10 L175 4 L200 6" stroke="#fff" strokeWidth="2" fill="none" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
window.HeroBanner = HeroBanner;
